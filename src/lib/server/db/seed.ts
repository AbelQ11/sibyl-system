import { db } from './connection';
import bcrypt from 'bcryptjs';

/**
 * Seeds development-only test accounts.
 * Only runs when NODE_ENV !== 'production'.
 */
export function runDevSeeds(): void {
    if (process.env.NODE_ENV === 'production') return;

    try {
        const ghost = db.prepare("SELECT id FROM users WHERE username = 'Ghost'").get() as any;
        if (!ghost) {
            const hash = bcrypt.hashSync('password', 10);
            const insertGhost = db.prepare("INSERT INTO users (username, password, role, credits) VALUES ('Ghost', ?, 'ADMIN', 999999)");
            const info = insertGhost.run(hash);
            const ghostId = info.lastInsertRowid;

            // Give Ghost all cosmetics
            const allCosmetics = db.prepare('SELECT id FROM cosmetics').all() as any[];
            const stmt = db.prepare('INSERT OR IGNORE INTO user_cosmetics (userId, cosmeticId) VALUES (?, ?)');
            for (const c of allCosmetics) {
                stmt.run(ghostId, c.id);
            }
            console.log('[SIBYL SEED] Created invisible Ghost test account (dev only).');
        }
    } catch (e) {
        console.error('[SIBYL SEED] Failed to create Ghost account:', e);
    }
}
