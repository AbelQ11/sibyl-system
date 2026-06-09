import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';
import path from "path";

const dbPath = '/home/ubuntu/sibyl-system/citizen.db'
export const db = new Database(dbPath, { verbose: console.log });

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
                                         id INTEGER PRIMARY KEY AUTOINCREMENT,
                                         username TEXT UNIQUE NOT NULL,
                                         password TEXT NOT NULL,
                                         avatar TEXT DEFAULT NULL
    );
`);

try {
    const columns = db.prepare("PRAGMA table_info(userStats)").all() as { name: string }[];
    const hasFirstCc = columns.some(c => c.name === 'first_cc');

    if (hasFirstCc) {
        console.log("[SIBYL DB MIGRATION] Migrating userStats table to support multiple history records...");
        
        db.exec("ALTER TABLE userStats RENAME TO userStats_old;");
        
        db.exec(`
            CREATE TABLE userStats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                cc REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
        
        const oldRecords = db.prepare("SELECT * FROM userStats_old").all() as { userId: any, first_cc: number, last_cc: number }[];
        for (const r of oldRecords) {
            const userRow = db.prepare("SELECT id FROM users WHERE username = ? OR id = ?").get(r.userId, r.userId) as { id: number } | undefined;
            const targetUserId = userRow ? userRow.id : r.userId;
            
            db.prepare("INSERT INTO userStats (userId, cc, created_at) VALUES (?, ?, datetime('now', '-1 day'))").run(targetUserId, r.first_cc);
            if (r.last_cc !== r.first_cc) {
                db.prepare("INSERT INTO userStats (userId, cc, created_at) VALUES (?, ?, datetime('now'))").run(targetUserId, r.last_cc);
            }
        }
        
        db.exec("DROP TABLE userStats_old;");
        console.log("[SIBYL DB MIGRATION] Migration complete!");
    }
} catch (migrationErr) {
    console.error("[SIBYL DB MIGRATION ERROR]:", migrationErr);
}

db.exec(`
    CREATE TABLE IF NOT EXISTS userStats (
                                             id INTEGER PRIMARY KEY AUTOINCREMENT,
                                             userId INTEGER NOT NULL,
                                             cc REAL NOT NULL,
                                             type TEXT DEFAULT 'terminal',
                                             created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                             FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        );
`);

try {
    db.exec('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT NULL;');
    console.log('Successfully applied avatar column patch to citizen.db');
} catch (e) {
}

try {
    db.exec("ALTER TABLE userStats ADD COLUMN type TEXT DEFAULT 'terminal';");
    console.log("Successfully added 'type' column to userStats table in citizen.db");
} catch (e) {
}