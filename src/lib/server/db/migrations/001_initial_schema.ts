import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '001_initial_schema',
    up() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            );
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS userStats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                cc REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS friend_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                senderId INTEGER NOT NULL,
                receiverId INTEGER NOT NULL,
                status TEXT DEFAULT 'PENDING',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(senderId) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(receiverId) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(senderId, receiverId)
            );
        `);
    }
};
