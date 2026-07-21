import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '018_posts_table',
    up() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                authorId INTEGER NOT NULL,
                content TEXT NOT NULL,
                original_content TEXT NOT NULL,
                is_censored INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(authorId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
    }
};
