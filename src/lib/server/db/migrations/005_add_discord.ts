import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '005_add_discord',
    up() {
        try { db.exec('ALTER TABLE users ADD COLUMN discord_username TEXT DEFAULT NULL;'); } catch { /* already exists */ }
        try { db.exec('ALTER TABLE users ADD COLUMN discord_id TEXT DEFAULT NULL;'); } catch { /* already exists */ }
    }
};
