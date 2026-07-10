import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '007_chat_tables',
    up() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS chat_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                maxCC INTEGER NOT NULL,
                inspectorId INTEGER NOT NULL,
                discord_role_id TEXT,
                discord_channel_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(inspectorId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS chat_group_members (
                groupId INTEGER NOT NULL,
                userId INTEGER NOT NULL,
                role TEXT DEFAULT 'CITIZEN',
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (groupId, userId),
                FOREIGN KEY(groupId) REFERENCES chat_groups(id) ON DELETE CASCADE,
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                senderId INTEGER NOT NULL,
                receiverId INTEGER,
                groupId INTEGER,
                text TEXT NOT NULL,
                isReadOnce BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(senderId) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(receiverId) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(groupId) REFERENCES chat_groups(id) ON DELETE CASCADE
            );
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS chat_message_reactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                messageId INTEGER NOT NULL,
                userId INTEGER NOT NULL,
                emoji TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(messageId) REFERENCES chat_messages(id) ON DELETE CASCADE,
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(messageId, userId, emoji)
            );
        `);
    }
};
