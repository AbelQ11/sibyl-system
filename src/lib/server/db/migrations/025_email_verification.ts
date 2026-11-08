import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
	id: '025_email_verification',
	up() {
		try {
			db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;');
		} catch {
			/* already exists */
		}

		db.exec(`
            CREATE TABLE IF NOT EXISTS email_verification_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                email TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at DATETIME NOT NULL,
                used_at DATETIME DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

		db.exec(
			'CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(userId);'
		);
	}
};
