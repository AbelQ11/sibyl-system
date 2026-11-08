import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const configuredPath = process.env.DATABASE_PATH?.trim();
const legacyProductionPath = '/home/ubuntu/sibyl-system/citizen.db';

const dbPath = configuredPath
	? path.resolve(configuredPath)
	: fs.existsSync('/home/ubuntu/sibyl-system')
		? legacyProductionPath
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
		// SQLite disables foreign keys by default. Without this, every
		// ON DELETE CASCADE clause in the schema is silently ignored.
		instance.pragma('foreign_keys = ON');
		globalThis.__db = instance;
	}
	return globalThis.__db;
}

export const db = getDatabase();
