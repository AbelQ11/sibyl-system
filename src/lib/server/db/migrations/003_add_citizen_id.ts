import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '003_add_citizen_id',
    up() {
        try { db.exec('ALTER TABLE users ADD COLUMN citizen_id TEXT;'); } catch { /* already exists */ }
        try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_citizen_id ON users(citizen_id);'); } catch { /* already exists */ }

        // Populate citizen_id for any users missing it
        const allUsers = db.prepare('SELECT id, citizen_id FROM users').all() as { id: number; citizen_id: string | null }[];
        const updateStmt = db.prepare('UPDATE users SET citizen_id = ? WHERE id = ?');

        for (const u of allUsers) {
            const isValid = u.citizen_id && /^SIB-\d{8}$/.test(u.citizen_id);
            if (!isValid) {
                let citizenId = '';
                let isUnique = false;
                while (!isUnique) {
                    let numStr = '';
                    for (let i = 0; i < 8; i++) numStr += Math.floor(Math.random() * 10).toString();
                    citizenId = `SIB-${numStr}`;
                    if (!db.prepare('SELECT id FROM users WHERE citizen_id = ?').get(citizenId)) isUnique = true;
                }
                updateStmt.run(citizenId, u.id);
            }
        }
    }
};
