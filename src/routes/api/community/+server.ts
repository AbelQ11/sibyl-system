import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export async function GET({ url, cookies }) {
    const sessionId = cookies.get('session');
    if (!sessionId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = url.searchParams.get('query') || '';

    try {
        const userId = parseInt(sessionId);

        /** Fetch users matching query (excluding current user) joined with active/pending request status */
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

        return json({ users });
    } catch (err) {
        console.error('Failed to query community directory:', err);
        return json({ error: 'Failed to search citizen directory' }, { status: 500 });
    }
}
