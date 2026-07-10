import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '008_add_reply_attachment',
    up() {
        try { db.exec('ALTER TABLE chat_messages ADD COLUMN replyToId INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL;'); } catch { /* already exists */ }
        try { db.exec('ALTER TABLE chat_messages ADD COLUMN attachment TEXT DEFAULT NULL;'); } catch { /* already exists */ }
    }
};
