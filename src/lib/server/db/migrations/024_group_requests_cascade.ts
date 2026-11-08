import { db } from '../connection';
import type { Migration } from '../migrate';

/**
 * Rebuild group_requests with ON DELETE CASCADE so deleting a user or a
 * division cannot leave dangling requests (and cannot block the delete).
 */
export const migration: Migration = {
	id: '024_group_requests_cascade',
	disableForeignKeys: true,
	up() {
		db.exec(`
            CREATE TABLE group_requests_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                groupId INTEGER NOT NULL,
                userId INTEGER NOT NULL,
                senderId INTEGER NOT NULL,
                status TEXT DEFAULT 'PENDING',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(groupId) REFERENCES chat_groups(id) ON DELETE CASCADE,
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(senderId) REFERENCES users(id) ON DELETE CASCADE
            );

            INSERT INTO group_requests_new (id, groupId, userId, senderId, status, created_at)
            SELECT id, groupId, userId, senderId, status, created_at FROM group_requests;

            DROP TABLE group_requests;
            ALTER TABLE group_requests_new RENAME TO group_requests;
        `);

		db.exec(
			'CREATE INDEX IF NOT EXISTS idx_group_requests_group_status ON group_requests(groupId, status);'
		);
	}
};
