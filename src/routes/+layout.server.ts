import { db } from '$lib/server/db';
import { getSession } from '$lib/server/session';
import { generateCitizenId } from '$lib/server/auth';
import { cleanExpiredSessions } from '$lib/server/session';
import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';

cleanExpiredSessions();

export const load: LayoutServerLoad = async ({ cookies }) => {
    const adminAccountId = env.ADMIN_ACCOUNT_ID || 'Makishimadmin';
    const token = cookies.get('session');

    if (token) {
        try {
            const session = getSession(token);
            if (!session) return { adminAccountId, user: null };

            const user = db.prepare(`
                SELECT u.id, u.username, u.avatar, u.citizen_id, u.privacy, u.discord_username, u.discord_id, u.role, u.bio, u.credits,
                       (SELECT c.value FROM user_cosmetics uc JOIN cosmetics c ON uc.cosmeticId = c.id WHERE uc.userId = u.id AND c.type = 'interface_theme' AND uc.equipped = 1 LIMIT 1) as interface_theme,
                       (SELECT c.value FROM user_cosmetics uc JOIN cosmetics c ON uc.cosmeticId = c.id WHERE uc.userId = u.id AND c.type = 'pointer_skin' AND uc.equipped = 1 LIMIT 1) as pointer_skin
                FROM users u
                WHERE u.id = ?
            `).get(session.userId) as any;

            if (user) {
                let citizenId = user.citizen_id;
                if (!citizenId || !/^SIB-\d{8}$/.test(citizenId)) {
                    citizenId = generateCitizenId();
                    db.prepare('UPDATE users SET citizen_id = ? WHERE id = ?').run(citizenId, user.id);
                    console.log(`[SELF-HEALING ID] Regenerated valid ID ${citizenId} for user ${user.username}`);
                }

                const statsCheck = db.prepare(`SELECT id FROM userStats WHERE userId = ? LIMIT 1`).get(user.id);
                const hasScanned = !!statsCheck || user.role === 'ADMIN';

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
                    },
                    hasScanned
                };
            }
        } catch (e) {
            console.error('Failed to restore user session from cookie:', e);
        }
    }

    return { adminAccountId, user: null, hasScanned: false };
};
