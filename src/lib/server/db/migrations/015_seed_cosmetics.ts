import { db } from '../connection';
import type { Migration } from '../migrate';

const CSS_RULES: Record<string, string> = {
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
    'pointer-eliminator': ".pointer-eliminator, .pointer-eliminator * { cursor: url('/cursors/lethal-eliminator.svg') 24 24, crosshair !important; }",
    'pointer-cell': ".pointer-cell, .pointer-cell * { cursor: url('/cursors/data-node.svg') 12 12, cell !important; }",
    'pointer-uplink': ".pointer-uplink, .pointer-uplink * { cursor: url('/cursors/neural-uplink.svg') 16 8, default !important; }",
    'pointer-not-allowed': ".pointer-not-allowed, .pointer-not-allowed * { cursor: url('/cursors/restricted-area.svg') 12 12, not-allowed !important; }",
    'pointer-help': ".pointer-help, .pointer-help * { cursor: url('/cursors/dominator-sight.svg') 16 16, crosshair !important; }"
};

export const migration: Migration = {
    id: '015_seed_cosmetics',
    up() {
        const existingCount = (db.prepare('SELECT COUNT(*) as count FROM cosmetics').get() as { count: number }).count;

        if (existingCount === 0) {
            const stmt = db.prepare('INSERT INTO cosmetics (type, name, price, value, description, css_rules) VALUES (?, ?, ?, ?, ?, ?)');

            // Avatar Borders
            stmt.run('avatar_border', 'Neon Glow', 200, 'neon-glow', 'A bright cyan neon border around your avatar.', CSS_RULES['neon-glow']);
            stmt.run('avatar_border', 'Hacker Matrix', 200, 'hacker-matrix', 'A trailing green matrix data stream border.', CSS_RULES['hacker-matrix']);
            stmt.run('avatar_border', 'Nyan Cat', 200, 'nyan-cat', 'A rainbow trail wrapped around your avatar. Nyan!', CSS_RULES['nyan-cat']);
            stmt.run('avatar_border', 'Vaporwave Sun', 200, 'vaporwave-sun', 'A retro 80s neon pink and cyan border with scanlines.', CSS_RULES['vaporwave-sun']);
            stmt.run('avatar_border', 'Plasma Shield', 200, 'plasma-shield', 'An organic, pulsing sci-fi electric blue energy ring.', CSS_RULES['plasma-shield']);

            // Name Effects
            stmt.run('name_effect', 'System Glitch', 300, 'effect-glitch', 'Username occasionally distorts with digital artifacts.', CSS_RULES['effect-glitch']);
            stmt.run('name_effect', 'Cyber Gradient', 300, 'effect-gradient', 'A sleek cyan-to-purple gradient on your name.', CSS_RULES['effect-gradient']);
            stmt.run('name_effect', 'Pulse Glow', 300, 'effect-pulse', 'A slow, breathing glow effect on your name.', CSS_RULES['effect-pulse']);
            stmt.run('name_effect', 'Holographic Shimmer', 300, 'effect-shimmer', 'A shimmering, holographic reflection passes over your name.', CSS_RULES['effect-shimmer']);
            stmt.run('name_effect', 'Dominator Laser', 300, 'effect-laser', 'A sharp, lethal blue laser underline effect.', CSS_RULES['effect-laser']);

            // Interface Themes
            stmt.run('interface_theme', 'Sibyl Default', 0, 'theme-default', 'The standard, pristine cyan interface of the Sibyl System. Free.', CSS_RULES['theme-default']);
            stmt.run('interface_theme', 'Enforcer Mode', 1000, 'theme-enforcer', 'A crimson-tinted, aggressive interface used by Enforcers.', CSS_RULES['theme-enforcer']);
            stmt.run('interface_theme', 'Inspector Elite', 1000, 'theme-inspector', 'A luxurious gold and white interface for top brass.', CSS_RULES['theme-inspector']);
            stmt.run('interface_theme', 'Midnight Protocol', 1000, 'theme-midnight', 'A stealthy, high-contrast deep purple and black theme.', CSS_RULES['theme-midnight']);
            stmt.run('interface_theme', 'Vaporwave Terminal', 1000, 'theme-vaporwave', 'A retro-futuristic pink and cyan aesthetic.', CSS_RULES['theme-vaporwave']);

            // Pointer Skins
            stmt.run('pointer_skin', 'Lethal Eliminator', 150, 'pointer-eliminator', 'Target locked. Crime coefficient over 300.', CSS_RULES['pointer-eliminator']);
            stmt.run('pointer_skin', 'Data Cell', 150, 'pointer-cell', 'A minimal data selection cursor.', CSS_RULES['pointer-cell']);
            stmt.run('pointer_skin', 'Neural Uplink', 150, 'pointer-uplink', 'A dual-layered holographic chevron for neural navigation.', CSS_RULES['pointer-uplink']);
            stmt.run('pointer_skin', 'Restricted Area', 150, 'pointer-not-allowed', 'A strict, not-allowed cursor to assert dominance.', CSS_RULES['pointer-not-allowed']);
            stmt.run('pointer_skin', 'Dominator Sight', 150, 'pointer-help', 'A tactical hexagonal sight used by Enforcers.', CSS_RULES['pointer-help']);
        } else {
            // Idempotent updates for cosmetic renames / CSS sync
            for (const [val, css] of Object.entries(CSS_RULES)) {
                db.prepare('UPDATE cosmetics SET css_rules = ? WHERE value = ? AND css_rules IS NULL').run(css, val);
            }
            db.prepare("UPDATE cosmetics SET name = 'Vaporwave Sun', value = 'vaporwave-sun', description = 'A retro 80s neon pink and cyan border with scanlines.' WHERE value = 'golden-elite'").run();
            db.prepare("UPDATE cosmetics SET name = 'Plasma Shield', value = 'plasma-shield', description = 'An organic, pulsing sci-fi electric blue energy ring.' WHERE value = 'crimson-threat'").run();
            db.prepare("DELETE FROM cosmetics WHERE value = 'pointer-wait' OR value = 'pointer-progress'").run();
            db.prepare("DELETE FROM user_cosmetics WHERE cosmeticId NOT IN (SELECT id FROM cosmetics)").run();

            const insertIfMissing = db.prepare('INSERT INTO cosmetics (type, name, price, value, description, css_rules) SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS(SELECT 1 FROM cosmetics WHERE value = ?)');
            insertIfMissing.run('pointer_skin', 'Lethal Eliminator', 150, 'pointer-eliminator', 'Target locked. Crime coefficient over 300.', CSS_RULES['pointer-eliminator'], 'pointer-eliminator');
            insertIfMissing.run('pointer_skin', 'Neural Uplink', 150, 'pointer-uplink', 'A dual-layered holographic chevron for neural navigation.', CSS_RULES['pointer-uplink'], 'pointer-uplink');
            insertIfMissing.run('pointer_skin', 'Restricted Area', 150, 'pointer-not-allowed', 'A strict, not-allowed cursor to assert dominance.', CSS_RULES['pointer-not-allowed'], 'pointer-not-allowed');
            insertIfMissing.run('pointer_skin', 'Dominator Sight', 150, 'pointer-help', 'A tactical hexagonal sight used by Enforcers.', CSS_RULES['pointer-help'], 'pointer-help');
        }
    }
};
