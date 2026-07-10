import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '002_add_avatar',
    up() {
        try { db.exec('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT NULL;'); } catch { /* already exists */ }
    }
};
