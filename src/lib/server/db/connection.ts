import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = fs.existsSync('/home/ubuntu/sibyl-system')
    ? '/home/ubuntu/sibyl-system/citizen.db'
    : path.resolve('citizen.db');

declare global {
    var __db: InstanceType<typeof Database> | undefined;
}

function getDatabase(): InstanceType<typeof Database> {
    if (!globalThis.__db) {
        const instance = new Database(dbPath);
        instance.pragma('journal_mode = WAL');
        instance.pragma('synchronous = NORMAL');
        instance.pragma('busy_timeout = 10000');
        instance.pragma('wal_autocheckpoint = 1000');
        globalThis.__db = instance;
    }
    return globalThis.__db;
}

export const db = getDatabase();
