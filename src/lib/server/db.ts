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
`
);
console.log('Successfully initialized chat_message_reactions table in citizen.db');

/** 15. Economy and Cosmetics Update */
try {
    db.exec("ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 0;");
    console.log("Successfully added 'credits' column to users table.");
} catch (e) {}

try {
    db.exec("ALTER TABLE users ADD COLUMN last_login_date DATE DEFAULT NULL;");
    console.log("Successfully added 'last_login_date' column to users table.");
} catch (e) {}

try {
    db.exec("ALTER TABLE users ADD COLUMN last_scan_date DATE DEFAULT NULL;");
    console.log("Successfully added 'last_scan_date' column to users table.");
} catch (e) {}

db.exec(`
    CREATE TABLE IF NOT EXISTS cosmetics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        css_rules TEXT DEFAULT NULL
    );
`);
console.log('Successfully initialized cosmetics table in citizen.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS user_cosmetics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        cosmeticId INTEGER NOT NULL,
        equipped BOOLEAN DEFAULT 0,
        purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(cosmeticId) REFERENCES cosmetics(id) ON DELETE CASCADE,
        UNIQUE(userId, cosmeticId)
    );
`);
console.log('Successfully initialized user_cosmetics table in citizen.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS promo_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        credits_reward INTEGER NOT NULL,
        max_uses INTEGER NOT NULL DEFAULT 1,
        current_uses INTEGER NOT NULL DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    );
`);
console.log('Successfully initialized promo_codes table in citizen.db');

/** Seed default cosmetics */
try {
    const existingCosmetics = db.prepare('SELECT COUNT(*) as count FROM cosmetics').get() as { count: number };
    if (existingCosmetics.count === 0) {
        const seedStmt = db.prepare('INSERT INTO cosmetics (type, name, price, value, description) VALUES (?, ?, ?, ?, ?)');
        
        // Avatar Borders (200)
        seedStmt.run('avatar_border', 'Neon Glow', 200, 'neon-glow', 'A bright cyan neon border around your avatar.');
        seedStmt.run('avatar_border', 'Hacker Matrix', 200, 'hacker-matrix', 'A trailing green matrix data stream border.');
        seedStmt.run('avatar_border', 'Nyan Cat', 200, 'nyan-cat', 'A rainbow trail wrapped around your avatar. Nyan!');
        seedStmt.run('avatar_border', 'Vaporwave Sun', 200, 'vaporwave-sun', 'A retro 80s neon pink and cyan border with scanlines.');
        seedStmt.run('avatar_border', 'Plasma Shield', 200, 'plasma-shield', 'An organic, pulsing sci-fi electric blue energy ring.');

        // Name Effects (300)
        seedStmt.run('name_effect', 'System Glitch', 300, 'effect-glitch', 'Username occasionally distorts with digital artifacts.');
        seedStmt.run('name_effect', 'Cyber Gradient', 300, 'effect-gradient', 'A sleek cyan-to-purple gradient on your name.');
        seedStmt.run('name_effect', 'Pulse Glow', 300, 'effect-pulse', 'A slow, breathing glow effect on your name.');
        seedStmt.run('name_effect', 'Holographic Shimmer', 300, 'effect-shimmer', 'A shimmering, holographic reflection passes over your name.');
        seedStmt.run('name_effect', 'Dominator Laser', 300, 'effect-laser', 'A sharp, lethal blue laser underline effect.');

        // Interface Themes (1000)
        seedStmt.run('interface_theme', 'Sibyl Default', 0, 'theme-default', 'The standard, pristine cyan interface of the Sibyl System. Free.'); // Give default for free
        seedStmt.run('interface_theme', 'Enforcer Mode', 1000, 'theme-enforcer', 'A crimson-tinted, aggressive interface used by Enforcers.');
        seedStmt.run('interface_theme', 'Inspector Elite', 1000, 'theme-inspector', 'A luxurious gold and white interface for top brass.');
        seedStmt.run('interface_theme', 'Midnight Protocol', 1000, 'theme-midnight', 'A stealthy, high-contrast deep purple and black theme.');
        seedStmt.run('interface_theme', 'Vaporwave Terminal', 1000, 'theme-vaporwave', 'A retro-futuristic pink and cyan aesthetic.');
        
        // Pointer Skins (150)
        seedStmt.run('pointer_skin', 'Crosshair Target', 150, 'pointer-crosshair', 'A tactical crosshair for precision targeting.');
        seedStmt.run('pointer_skin', 'Data Cell', 150, 'pointer-cell', 'A minimal data selection cursor.');
        seedStmt.run('pointer_skin', 'Wait State', 150, 'pointer-wait', 'A perpetual loading hourglass indicator.');
        
        console.log("Successfully seeded 18 initial cosmetics into citizen.db");
    }

    // Migration: forcefully update old cosmetics to new names/values if they still exist in prod db
    db.prepare("UPDATE cosmetics SET name = 'Vaporwave Sun', value = 'vaporwave-sun', description = 'A retro 80s neon pink and cyan border with scanlines.' WHERE value = 'golden-elite'").run();
    db.prepare("UPDATE cosmetics SET name = 'Plasma Shield', value = 'plasma-shield', description = 'An organic, pulsing sci-fi electric blue energy ring.' WHERE value = 'crimson-threat'").run();

    // Migration: Extract hardcoded CSS to db
    const cssUpdates: Record<string, string> = {
        'neon-glow': '.avatar-wrapper.neon-glow { box-shadow: 0 0 10px #00ffff, 0 0 20px #00ffff, inset 0 0 10px #00ffff; border: 2px solid #00ffff; }',
        'hacker-matrix': '.avatar-wrapper.hacker-matrix { border: 2px solid #0f0; overflow: hidden; }\n.avatar-wrapper.hacker-matrix::before { content: ""; position: absolute; top: -100%; left: 0; right: 0; height: 100%; background: linear-gradient(to bottom, transparent, #0f0 80%, #fff 100%); animation: matrix-fall 1.5s linear infinite; opacity: 0.5; z-index: 2; pointer-events: none; }\n@keyframes matrix-fall { to { top: 100%; } }',
        'nyan-cat': '.avatar-wrapper.nyan-cat { position: relative; padding: 4px; border-radius: 50%; overflow: visible; z-index: 1; }\n.avatar-wrapper.nyan-cat::before { content: ""; position: absolute; inset: 0; border-radius: 50%; z-index: -1; background: conic-gradient(red, orange, yellow, green, blue, indigo, violet, red); animation: nyan-spin 2s linear infinite; }\n.avatar-wrapper.nyan-cat .chat-avatar { border-radius: 50%; z-index: 2; position: relative; }\n.avatar-wrapper.nyan-cat::after { content: "🐱"; position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; margin-top: -10px; margin-left: -10px; animation: cat-orbit 1.5s linear infinite; z-index: 3; font-size: 20px; line-height: 20px; text-align: center; }\n@keyframes nyan-spin { 100% { transform: rotate(360deg); } }\n@keyframes cat-orbit { from { transform: rotate(0deg) translateY(-28px) rotate(0deg); } to { transform: rotate(360deg) translateY(-28px) rotate(-360deg); } }',
        'vaporwave-sun': '.avatar-wrapper.vaporwave-sun { border: 3px solid; border-image: linear-gradient(180deg, #ff00ff, #00ffff) 1; box-shadow: 0 0 15px rgba(255, 0, 255, 0.5); position: relative; }\n.avatar-wrapper.vaporwave-sun::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.2) 2px, rgba(0,255,255,0.2) 4px); z-index: 2; }',
        'plasma-shield': '.avatar-wrapper.plasma-shield { padding: 4px; border: 2px solid rgba(0, 150, 255, 0.8); border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; box-shadow: 0 0 10px #0088ff, inset 0 0 10px #0088ff; animation: plasma-morph 3s linear infinite alternate; background: rgba(0, 150, 255, 0.1); }\n@keyframes plasma-morph { 0% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; box-shadow: 0 0 10px #0088ff, inset 0 0 10px #0088ff; } 50% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; box-shadow: 0 0 20px #0088ff, inset 0 0 15px #0088ff; } 100% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; box-shadow: 0 0 10px #0088ff, inset 0 0 10px #0088ff; } }',
        'effect-glitch': '.sender-name.effect-glitch { position: relative; display: inline-block; font-weight: bold; }\n.sender-name.effect-glitch::before, .sender-name.effect-glitch::after { content: attr(data-text); position: absolute; top: 0; left: 0; opacity: 0.8; }\n.sender-name.effect-glitch::before { color: #0ff; z-index: -1; animation: glitch-anim-1 2s infinite linear alternate-reverse; }\n.sender-name.effect-glitch::after { color: #f00; z-index: -2; animation: glitch-anim-2 3s infinite linear alternate-reverse; }\n@keyframes glitch-anim-1 { 0% { clip-path: inset(20% 0 80% 0); transform: translate(-2px, 1px); } 20% { clip-path: inset(60% 0 10% 0); transform: translate(2px, -1px); } 40% { clip-path: inset(40% 0 50% 0); transform: translate(-2px, 2px); } 60% { clip-path: inset(80% 0 5% 0); transform: translate(2px, -2px); } 80% { clip-path: inset(10% 0 70% 0); transform: translate(-1px, 1px); } 100% { clip-path: inset(30% 0 50% 0); transform: translate(1px, -1px); } }\n@keyframes glitch-anim-2 { 0% { clip-path: inset(10% 0 60% 0); transform: translate(2px, -1px); } 20% { clip-path: inset(30% 0 20% 0); transform: translate(-2px, 1px); } 40% { clip-path: inset(70% 0 10% 0); transform: translate(2px, -2px); } 60% { clip-path: inset(20% 0 50% 0); transform: translate(-2px, 2px); } 80% { clip-path: inset(50% 0 30% 0); transform: translate(1px, -1px); } 100% { clip-path: inset(5% 0 80% 0); transform: translate(-1px, 1px); } }',
        'effect-gradient': '.sender-name.effect-gradient { background: linear-gradient(90deg, #00ffff, #ff00ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }',
        'effect-pulse': '.sender-name.effect-pulse { animation: pulseGlow 2s ease-in-out infinite alternate; }\n@keyframes pulseGlow { from { text-shadow: 0 0 5px currentColor; } to { text-shadow: 0 0 20px currentColor, 0 0 30px currentColor; } }',
        'effect-shimmer': '.sender-name.effect-shimmer { background: linear-gradient(90deg, currentColor 0%, #fff 50%, currentColor 100%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 2s linear infinite; }\n@keyframes shimmer { to { background-position: 200% center; } }',
        'effect-laser': '.sender-name.effect-laser { text-decoration: underline; text-decoration-color: #0088ff; text-decoration-style: double; text-shadow: 0 0 5px #0088ff; }',
        'theme-default': '.theme-preview-box.theme-default { --preview-main: #00ffcc; --preview-bg: #050505; --preview-glow: rgba(0,255,204,0.5); }',
        'theme-enforcer': '.theme-preview-box.theme-enforcer { --preview-main: #ff3333; --preview-bg: #0a0000; --preview-glow: rgba(255,51,51,0.5); }\n.app-wrapper.theme-enforcer {\n  --main-color: #ff3333 !important;\n  --main-glow: rgba(255, 51, 51, 0.5) !important;\n  --bg-color: #0a0000 !important;\n}',
        'theme-inspector': '.theme-preview-box.theme-inspector { --preview-main: #ffd700; --preview-bg: #1a1810; --preview-glow: rgba(255,215,0,0.5); }\n.app-wrapper.theme-inspector {\n  --main-color: #ffd700 !important;\n  --main-glow: rgba(255, 215, 0, 0.5) !important;\n  --bg-color: #1a1810 !important;\n}',
        'theme-midnight': '.theme-preview-box.theme-midnight { --preview-main: #9932cc; --preview-bg: #050010; --preview-glow: rgba(153,50,204,0.5); }\n.app-wrapper.theme-midnight {\n  --main-color: #9932cc !important;\n  --main-glow: rgba(153, 50, 204, 0.5) !important;\n  --bg-color: #050010 !important;\n}',
        'theme-vaporwave': '.theme-preview-box.theme-vaporwave { --preview-main: #ff00ff; --preview-bg: #00001a; --preview-glow: rgba(255,0,255,0.5); }\n.app-wrapper.theme-vaporwave {\n  --main-color: #ff00ff !important;\n  --main-glow: rgba(255, 0, 255, 0.5) !important;\n  --bg-color: #00001a !important;\n}',
        'pointer-eliminator': '.pointer-eliminator, .pointer-eliminator * { cursor: url(\'/cursors/lethal-eliminator.svg\') 24 24, crosshair !important; }',
        'pointer-cell': '.pointer-cell, .pointer-cell * { cursor: url(\'/cursors/data-node.svg\') 12 12, cell !important; }',
        'pointer-uplink': '.pointer-uplink, .pointer-uplink * { cursor: url(\'/cursors/neural-uplink.svg\') 16 8, default !important; }',
        'pointer-not-allowed': '.pointer-not-allowed, .pointer-not-allowed * { cursor: url(\'/cursors/restricted-area.svg\') 12 12, not-allowed !important; }',
        'pointer-help': '.pointer-help, .pointer-help * { cursor: url(\'/cursors/dominator-sight.svg\') 16 16, crosshair !important; }'
    };
    
    for (const [val, css] of Object.entries(cssUpdates)) {
        // Only update if it exists and css_rules is null
        db.prepare("UPDATE cosmetics SET css_rules = ? WHERE value = ? AND css_rules IS NULL").run(css, val);
    }

    // Migration: ensure pointer skins exist for existing databases
    const pointerCount = db.prepare("SELECT COUNT(*) as count FROM cosmetics WHERE type = 'pointer_skin'").get() as { count: number };
    if (pointerCount.count === 0) {
        const seedStmt = db.prepare('INSERT INTO cosmetics (type, name, price, value, description, css_rules) VALUES (?, ?, ?, ?, ?, ?)');
        seedStmt.run('pointer_skin', 'Lethal Eliminator', 150, 'pointer-eliminator', 'Target locked. Crime coefficient over 300.', cssUpdates['pointer-eliminator']);
        seedStmt.run('pointer_skin', 'Data Cell', 150, 'pointer-cell', 'A minimal data selection cursor.', cssUpdates['pointer-cell']);
        seedStmt.run('pointer_skin', 'Neural Uplink', 150, 'pointer-uplink', 'A dual-layered holographic chevron for neural navigation.', cssUpdates['pointer-uplink']);
        seedStmt.run('pointer_skin', 'Restricted Area', 150, 'pointer-not-allowed', 'A strict, not-allowed cursor to assert dominance.', cssUpdates['pointer-not-allowed']);
        seedStmt.run('pointer_skin', 'Dominator Sight', 150, 'pointer-help', 'A tactical hexagonal sight used by Enforcers.', cssUpdates['pointer-help']);
        console.log("Migrated pointer skins into citizen.db");
    } else {
        // Force update existing pointer skins to use the new CSS rules that work on app-wrapper
        db.prepare("UPDATE cosmetics SET name = 'Lethal Eliminator', value = 'pointer-eliminator', description = 'Target locked. Crime coefficient over 300.', css_rules = ? WHERE value = 'pointer-crosshair'").run(cssUpdates['pointer-eliminator']);
        db.prepare("UPDATE cosmetics SET css_rules = ? WHERE value = 'pointer-cell'").run(cssUpdates['pointer-cell']);
        db.prepare("UPDATE cosmetics SET name = 'Neural Uplink', value = 'pointer-uplink', description = 'A dual-layered holographic chevron for neural navigation.', css_rules = ? WHERE value = 'pointer-precision'").run(cssUpdates['pointer-uplink']);
        db.prepare("UPDATE cosmetics SET css_rules = ? WHERE value = 'pointer-not-allowed'").run(cssUpdates['pointer-not-allowed']);
        db.prepare("UPDATE cosmetics SET name = 'Dominator Sight', description = 'A tactical hexagonal sight used by Enforcers.', css_rules = ? WHERE value = 'pointer-help'").run(cssUpdates['pointer-help']);
        
        // Remove wait state/progress pointers if they exist
        db.prepare("DELETE FROM cosmetics WHERE value = 'pointer-wait' OR value = 'pointer-progress'").run();
        db.prepare("DELETE FROM user_cosmetics WHERE cosmeticId NOT IN (SELECT id FROM cosmetics)").run(); // Cleanup orphaned references
        
        // Insert new ones if they don't exist yet
        const seedStmt = db.prepare('INSERT INTO cosmetics (type, name, price, value, description, css_rules) SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS(SELECT 1 FROM cosmetics WHERE value = ?)');
        seedStmt.run('pointer_skin', 'Neural Uplink', 150, 'pointer-uplink', 'A dual-layered holographic chevron for neural navigation.', cssUpdates['pointer-uplink'], 'pointer-uplink');
        seedStmt.run('pointer_skin', 'Restricted Area', 150, 'pointer-not-allowed', 'A strict, not-allowed cursor to assert dominance.', cssUpdates['pointer-not-allowed'], 'pointer-not-allowed');
        seedStmt.run('pointer_skin', 'Dominator Sight', 150, 'pointer-help', 'A tactical hexagonal sight used by Enforcers.', cssUpdates['pointer-help'], 'pointer-help');
    }

    // Ghost test account
    const ghost = db.prepare("SELECT id FROM users WHERE username = 'Ghost'").get() as any;
    if (!ghost) {
        try {
            const hash = bcrypt.hashSync('password', 10);
            const insertGhost = db.prepare("INSERT INTO users (username, password, role, credits) VALUES ('Ghost', ?, 'ADMIN', 999999)");
            const info = insertGhost.run(hash);
            const ghostId = info.lastInsertRowid;
            
            // Give all cosmetics
            const allCosmetics = db.prepare("SELECT id FROM cosmetics").all() as any[];
            const stmt = db.prepare("INSERT INTO user_cosmetics (userId, cosmeticId) VALUES (?, ?)");
            for (const c of allCosmetics) {
                stmt.run(ghostId, c.id);
            }
            console.log("Created invisible Ghost test account.");
        } catch (e) {
            console.error("Failed to create Ghost account:", e);
        }
    }

} catch (e) {
    console.error("Failed to seed cosmetics:", e);
}

// Migration: add css_rules column to cosmetics
try {
    db.exec("ALTER TABLE cosmetics ADD COLUMN css_rules TEXT DEFAULT NULL;");
    console.log("Successfully added 'css_rules' column to cosmetics table.");
} catch (e) {}