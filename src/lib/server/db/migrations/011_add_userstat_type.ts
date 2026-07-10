import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '011_add_userstat_type',
    up() {
        try { db.exec("ALTER TABLE userStats ADD COLUMN type TEXT DEFAULT 'terminal';"); } catch { /* already exists */ }
    }
};
