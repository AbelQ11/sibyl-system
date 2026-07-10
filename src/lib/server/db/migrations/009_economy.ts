import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '009_economy',
    up() {
        try { db.exec('ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 0;'); } catch { /* already exists */ }
        try { db.exec('ALTER TABLE users ADD COLUMN last_login_date DATE DEFAULT NULL;'); } catch { /* already exists */ }
        try { db.exec('ALTER TABLE users ADD COLUMN last_scan_date DATE DEFAULT NULL;'); } catch { /* already exists */ }
    }
};
