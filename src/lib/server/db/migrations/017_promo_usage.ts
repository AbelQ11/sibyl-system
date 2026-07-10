import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '017_promo_usage',
    up() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS promo_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                promoId INTEGER NOT NULL,
                used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(userId, promoId),
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(promoId) REFERENCES promo_codes(id) ON DELETE CASCADE
            );
        `);
    }
};
