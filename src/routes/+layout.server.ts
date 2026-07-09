import { db } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: LayoutServerLoad = async ({ cookies }) => {
    const adminAccountId = env.ADMIN_ACCOUNT_ID || 'Makishimadmin';
    const sessionId = cookies.get('session');
    
    if (sessionId) {
        try {
            const user = db.prepare(`
                SELECT u.id, u.username, u.avatar, u.citizen_id, u.privacy, u.discord_username, u.discord_id, u.role, u.bio, u.credits,
                       (SELECT c.value FROM user_cosmetics uc JOIN cosmetics c ON uc.cosmeticId = c.id WHERE uc.userId = u.id AND c.type = 'interface_theme' AND uc.equipped = 1 LIMIT 1) as interface_theme,
                       (SELECT c.value FROM user_cosmetics uc JOIN cosmetics c ON uc.cosmeticId = c.id WHERE uc.userId = u.id AND c.type = 'pointer_skin' AND uc.equipped = 1 LIMIT 1) as pointer_skin
                FROM users u 
                WHERE u.id = ?
            `).get(sessionId) as any;
            if (user) {
                let citizenId = user.citizen_id;
                
                const isValidId = citizenId && /^SIB-\d{8}$/.test(citizenId);
                if (!isValidId) {
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
                    db.prepare('UPDATE users SET citizen_id = ? WHERE id = ?').run(citizenId, user.id);
                    console.log(`[SELF-HEALING ID] Regenerated valid ID ${citizenId} for user ${user.username}`);
                }

                return {
                    adminAccountId,
                    user: {
                        id: user.id,
                        username: user.username,
                        avatar: user.avatar,
                        citizen_id: citizenId,
                        privacy: user.privacy || 'PRIVATE',
                        discord_username: user.discord_username,
                        discord_id: user.discord_id,
                        role: user.role || 'USER',
                        bio: user.bio || '',
                        credits: user.credits || 0,
                        interface_theme: user.interface_theme || 'theme-default',
                        pointer_skin: user.pointer_skin || null
                    }
                };
            }
        } catch (e) {
            console.error('Failed to restore user session from cookie:', e);
        }
    }
    
    return {
        adminAccountId,
        user: null
    };
};
