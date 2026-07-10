import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '012_group_extras',
    up() {
        try { db.exec('ALTER TABLE chat_groups ADD COLUMN bio TEXT DEFAULT "";'); } catch { /* already exists */ }
        try { db.exec('ALTER TABLE chat_groups ADD COLUMN avatar TEXT DEFAULT NULL;'); } catch { /* already exists */ }
    }
};
