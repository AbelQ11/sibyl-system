import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '006_add_role_bio',
    up() {
        try { db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'USER';"); } catch { /* already exists */ }
        try { db.exec('ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL;'); } catch { /* already exists */ }
    }
};
