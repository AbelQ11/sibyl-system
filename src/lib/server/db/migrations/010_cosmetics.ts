import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '010_cosmetics',
    up() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS cosmetics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                price INTEGER NOT NULL,
                value TEXT NOT NULL,
                description TEXT,
                css_rules TEXT DEFAULT NULL
            );
        `);

        // Ensure css_rules column exists on pre-existing DBs
        try { db.exec('ALTER TABLE cosmetics ADD COLUMN css_rules TEXT DEFAULT NULL;'); } catch { /* already exists */ }

        db.exec(`
            CREATE TABLE IF NOT EXISTS user_cosmetics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                cosmeticId INTEGER NOT NULL,
                equipped BOOLEAN DEFAULT 0,
                purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(cosmeticId) REFERENCES cosmetics(id) ON DELETE CASCADE,
                UNIQUE(userId, cosmeticId)
            );
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS promo_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                credits_reward INTEGER NOT NULL,
                max_uses INTEGER NOT NULL DEFAULT 1,
                current_uses INTEGER NOT NULL DEFAULT 0,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
            );
        `);
    }
};
