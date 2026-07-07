import Database from 'better-sqlite3';
import path from "path";
import fs from 'fs';
import bcrypt from 'bcryptjs';

const dbPath = fs.existsSync('/home/ubuntu/sibyl-system')
    ? '/home/ubuntu/sibyl-system/citizen.db'
    : path.resolve('citizen.db');
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

/** 1. Alter users table to add citizen_id TEXT */
try {
    db.exec('ALTER TABLE users ADD COLUMN citizen_id TEXT;');
    console.log("Successfully added 'citizen_id' column to users table.");
} catch (e) {
}
try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_citizen_id ON users(citizen_id);');
    console.log("Successfully created unique index on users.citizen_id.");
} catch (e) {
}

/** 2. Populate/sanitize citizen_id for users to make sure they match SIB-XXXXXXXX (8 random digits) */
try {
    const allUsers = db.prepare('SELECT id, citizen_id FROM users').all() as { id: number, citizen_id: string | null }[];
    const updateStmt = db.prepare('UPDATE users SET citizen_id = ? WHERE id = ?');
    
    for (const u of allUsers) {
        const isValid = u.citizen_id && /^SIB-\d{8}$/.test(u.citizen_id);
        if (!isValid) {
            let citizenId = '';
            let isUnique = false;
            
            while (!isUnique) {
                let numStr = '';
                for (let i = 0; i < 8; i++) {
                    numStr += Math.floor(Math.random() * 10).toString();
                }
                citizenId = `SIB-${numStr}`;
                const existing = db.prepare('SELECT id FROM users WHERE citizen_id = ?').get(citizenId);
                if (!existing) {
                    isUnique = true;
                }
            }
            updateStmt.run(citizenId, u.id);
            console.log(`[SIBYL ID SANITIZER] Replaced invalid ID for user ID ${u.id} with ${citizenId}`);
        }
    }
} catch (e) {
    console.error('Failed to run citizen_id sanitizer migration:', e);
}

/** 3. Add privacy level column */
try {
    db.exec("ALTER TABLE users ADD COLUMN privacy TEXT DEFAULT 'PRIVATE';");
    console.log("Successfully added 'privacy' column to users table.");
} catch (e) {
}

/** 4. Add discord username column */
try {
    db.exec("ALTER TABLE users ADD COLUMN discord_username TEXT DEFAULT NULL;");
    console.log("Successfully added 'discord_username' column to users table.");
} catch (e) {
}

/** 5. Add discord unique ID column */
try {
    db.exec("ALTER TABLE users ADD COLUMN discord_id TEXT DEFAULT NULL;");
    console.log("Successfully added 'discord_id' column to users table.");
} catch (e) {
}

/** 6. Create friend_requests table */
db.exec(`
    CREATE TABLE IF NOT EXISTS friend_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        senderId INTEGER NOT NULL,
        receiverId INTEGER NOT NULL,
        status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(senderId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(receiverId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(senderId, receiverId)
    );
`);
console.log('Successfully initialized friend_requests table in citizen.db');

/** 7. Add role column to users table */
try {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'USER';");
    console.log("Successfully added 'role' column to users table.");
} catch (e) {
}

/** 7.5 Add bio column to users table */
try {
    db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL;");
    console.log("Successfully added 'bio' column to users table.");
} catch (e) {
}

/** 8. Seed default administrative account */
try {
    const adminExists = db.prepare("SELECT id FROM users WHERE username = ?").get('Makishimadmin');
    if (!adminExists) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync('LrQRaKQYq25epsS4wUgH4mhouXZPFX', salt);
        db.prepare("INSERT INTO users (username, password, citizen_id, role) VALUES (?, ?, ?, ?)").run('Makishimadmin', hash, 'SIB-00000000', 'ADMIN');
        console.log("Successfully seeded admin user 'Makishimadmin' with ID 'SIB-00000000'.");
    }
} catch (e) {
    console.error("Failed to seed administrative account:", e);
}

/** 9. Create chat_groups table */
db.exec(`
    CREATE TABLE IF NOT EXISTS chat_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        maxCC INTEGER NOT NULL,
        inspectorId INTEGER NOT NULL,
        discord_role_id TEXT,
        discord_channel_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(inspectorId) REFERENCES users(id) ON DELETE CASCADE
    );
`);
console.log('Successfully initialized chat_groups table in citizen.db');

/** 10. Create chat_group_members table */
db.exec(`
    CREATE TABLE IF NOT EXISTS chat_group_members (
        groupId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        role TEXT DEFAULT 'CITIZEN',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (groupId, userId),
        FOREIGN KEY(groupId) REFERENCES chat_groups(id) ON DELETE CASCADE,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
`);
console.log('Successfully initialized chat_group_members table in citizen.db');

/** 11. Create chat_messages table */
db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        senderId INTEGER NOT NULL,
        receiverId INTEGER,
        groupId INTEGER,
        text TEXT NOT NULL,
        isReadOnce BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(senderId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(receiverId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(groupId) REFERENCES chat_groups(id) ON DELETE CASCADE
    );
`);
console.log('Successfully initialized chat_messages table in citizen.db');

/** 12. Add replyToId to chat_messages */
try {
    db.exec("ALTER TABLE chat_messages ADD COLUMN replyToId INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL;");
    console.log("Successfully added 'replyToId' column to chat_messages table.");
} catch (e) {}

/** 13. Add attachment to chat_messages */
try {
    db.exec("ALTER TABLE chat_messages ADD COLUMN attachment TEXT DEFAULT NULL;");
    console.log("Successfully added 'attachment' column to chat_messages table.");
} catch (e) {}

/** 14. Create chat_message_reactions table */
db.exec(`
    CREATE TABLE IF NOT EXISTS chat_message_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        messageId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        emoji TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(messageId) REFERENCES chat_messages(id) ON DELETE CASCADE,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(messageId, userId, emoji)
    );
`);
console.log('Successfully initialized chat_message_reactions table in citizen.db');