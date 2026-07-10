import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = fs.existsSync('/home/ubuntu/sibyl-system')
    ? '/home/ubuntu/sibyl-system/citizen.db'
    : path.resolve('citizen.db');

export const db = new Database(dbPath);
