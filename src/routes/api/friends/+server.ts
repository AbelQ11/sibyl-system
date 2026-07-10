import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
    const user = getAuthUser(cookies.get('session'));
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        let friends = [];
        if (user.role === 'ADMIN') {
            friends = db.prepare(`SELECT id, username, avatar, role FROM users WHERE id != ?`).all(user.id);
        } else {
            friends = db.prepare(`
                SELECT u.id, u.username, u.avatar, u.role
                FROM users u
                JOIN friend_requests r ON (r.receiverId = u.id AND r.senderId = ?) OR (r.senderId = u.id AND r.receiverId = ?)
                WHERE r.status = 'ACCEPTED' AND u.id != ?
                UNION
                SELECT id, username, avatar, role FROM users WHERE role = 'ADMIN'
            `).all(user.id, user.id, user.id);
        }

        return json({ success: true, friends });
    } catch (e) {
        return json({ error: 'Failed to fetch friends' }, { status: 500 });
    }
};
