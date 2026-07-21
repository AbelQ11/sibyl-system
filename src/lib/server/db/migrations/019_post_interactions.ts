import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '019_post_interactions',
    up() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS post_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                postId INTEGER NOT NULL,
                userId INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(postId) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(postId, userId)
            );
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS post_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                postId INTEGER NOT NULL,
                authorId INTEGER NOT NULL,
                content TEXT NOT NULL,
                original_content TEXT NOT NULL,
                is_censored INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(postId) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY(authorId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
    }
};
