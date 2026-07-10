import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '004_add_privacy',
    up() {
        try { db.exec("ALTER TABLE users ADD COLUMN privacy TEXT DEFAULT 'PRIVATE';"); } catch { /* already exists */ }
    }
};
