import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies }) => {
    const user = getAuthUser(cookies.get('session'));
    if (!user) return { users: [] };

    const query = url.searchParams.get('q') || '';
    const userId = user.id;

    try {
        const users = db.prepare(`
            SELECT u.id, u.username, u.avatar, u.citizen_id, u.privacy,
                   r.id as requestId, r.status as requestStatus, r.senderId as requestSenderId
            FROM users u
            LEFT JOIN friend_requests r ON 
                (r.senderId = ? AND r.receiverId = u.id) OR 
                (r.senderId = u.id AND r.receiverId = ?)
            WHERE u.id != ? AND u.role != 'ADMIN' AND (u.username LIKE ? OR u.citizen_id LIKE ?)
            LIMIT 40
        `).all(userId, userId, userId, `%${query}%`, `%${query}%`) as {
            id: number;
            username: string;
            avatar: string | null;
            citizen_id: string;
            privacy: string;
            requestId: number | null;
            requestStatus: string | null;
            requestSenderId: number | null;
        }[];

        return { users, query };
    } catch (err) {
        console.error('Failed to query community directory:', err);
        return { users: [], query, error: 'Failed to search citizen directory' };
    }
};
