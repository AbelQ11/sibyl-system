import { db } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
    const sessionId = cookies.get('session');
    
    if (sessionId) {
        try {
            const user = db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(sessionId) as { id: number, username: string, avatar: string | null } | undefined;
            if (user) {
                return {
                    user: {
                        id: user.id,
                        username: user.username,
                        avatar: user.avatar
                    }
                };
            }
        } catch (e) {
            console.error('Failed to restore user session from cookie:', e);
        }
    }
    
    return {
        user: null
    };
};
