import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '013_group_requests',
    up() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS group_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                groupId INTEGER NOT NULL,
                userId INTEGER NOT NULL,
                senderId INTEGER NOT NULL,
                status TEXT DEFAULT 'PENDING',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(groupId) REFERENCES chat_groups(id),
                FOREIGN KEY(userId) REFERENCES users(id),
                FOREIGN KEY(senderId) REFERENCES users(id)
            );
        `);
    }
};
