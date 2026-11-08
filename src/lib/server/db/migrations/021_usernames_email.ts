import { db } from '../connection';
import type { Migration } from '../migrate';

/**
 * Usernames become non-unique display names. The Citizen ID (SIB-XXXXXXXX)
 * remains the unique public identifier, and an optional unique email can be
 * used for sign-in.
 *
 * SQLite cannot drop a column-level UNIQUE constraint with ALTER TABLE, so
 * this migration rebuilds the users table while preserving every existing
 * column and row.
 */
export const migration: Migration = {
	id: '021_usernames_email',
	disableForeignKeys: true,
	up() {
		db.exec(`
            CREATE TABLE users_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                avatar TEXT DEFAULT NULL,
                privacy TEXT DEFAULT 'PRIVATE',
                discord_username TEXT DEFAULT NULL,
                discord_id TEXT DEFAULT NULL,
                citizen_id TEXT,
                role TEXT DEFAULT 'USER',
                bio TEXT DEFAULT NULL,
                credits INTEGER DEFAULT 0,
                last_login_date DATE DEFAULT NULL,
                last_scan_date DATE DEFAULT NULL,
                email TEXT DEFAULT NULL
            );

            INSERT INTO users_new (
                id, username, password, avatar, privacy, discord_username,
                discord_id, citizen_id, role, bio, credits, last_login_date,
                last_scan_date, email
            )
            SELECT
                id, username, password, avatar, privacy, discord_username,
                discord_id, citizen_id, role, bio, credits, last_login_date,
                last_scan_date, NULL
            FROM users;

            DROP TABLE users;
            ALTER TABLE users_new RENAME TO users;
        `);

		// Public profile / lookup identifier.
		try {
			db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'users_new');");
			db.exec(
				"INSERT INTO sqlite_sequence (name, seq) SELECT 'users', COALESCE(MAX(id), 0) FROM users;"
			);
		} catch {
			/* sqlite_sequence may not exist on a brand-new database */
		}
		db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_citizen_id ON users(citizen_id);');
		// Non-unique because several citizens may share a display name.
		db.exec('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);');
		// Case-insensitive uniqueness, while still allowing many NULL emails.
		db.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
            ON users(email COLLATE NOCASE)
            WHERE email IS NOT NULL;
        `);
	}
};
