import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '016_sessions_table',
    up() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                userId INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);');
    }
};
