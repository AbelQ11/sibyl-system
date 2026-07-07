import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';

export async function GET({ cookies }) {
    const sessionId = cookies.get('session');
    if (!sessionId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = parseInt(sessionId);

        const userRole = db.prepare(`SELECT role FROM users WHERE id = ?`).get(userId) as { role: string };

        let friends;
        if (userRole.role === 'ADMIN') {
            /** Admins are friends with everyone */
            friends = db.prepare(`
                SELECT u.id, u.username, u.avatar, u.citizen_id, u.role,
                       (SELECT cc FROM userStats WHERE userId = u.id ORDER BY id DESC LIMIT 1) as last_cc
                FROM users u
                WHERE u.id != ?
            `).all(userId) as { id: number, username: string, avatar: string | null, citizen_id: string, role: string, last_cc: number | null }[];
        } else {
            /** Regular users get their accepted friends + all Admins */
            friends = db.prepare(`
                SELECT u.id, u.username, u.avatar, u.citizen_id, u.role,
                       (SELECT cc FROM userStats WHERE userId = u.id ORDER BY id DESC LIMIT 1) as last_cc
                FROM users u
                LEFT JOIN friend_requests r ON (r.receiverId = u.id AND r.senderId = ?) OR (r.senderId = u.id AND r.receiverId = ?)
                WHERE (r.status = 'ACCEPTED' OR u.role = 'ADMIN') AND u.id != ?
            `).all(userId, userId, userId) as { id: number, username: string, avatar: string | null, citizen_id: string, role: string, last_cc: number | null }[];
        }

        const incoming = db.prepare(`
            SELECT r.id as requestId, u.id as senderId, u.username, u.avatar, u.citizen_id
            FROM users u
            JOIN friend_requests r ON r.senderId = u.id
            WHERE r.receiverId = ? AND r.status = 'PENDING'
        `).all(userId) as { requestId: number, senderId: number, username: string, avatar: string | null, citizen_id: string }[];

        const outgoing = db.prepare(`
            SELECT r.id as requestId, u.id as receiverId, u.username, u.avatar, u.citizen_id
            FROM users u
            JOIN friend_requests r ON r.receiverId = u.id
            WHERE r.senderId = ? AND r.status = 'PENDING'
        `).all(userId) as { requestId: number, receiverId: number, username: string, avatar: string | null, citizen_id: string }[];

        return json({ friends, incoming, outgoing });
    } catch (err: any) {
        console.error('Failed to get friends list:', err);
        return json({ error: 'Failed to retrieve compliance network data' }, { status: 500 });
    }
}

export async function POST({ request, cookies }) {
    const sessionId = cookies.get('session');
    if (!sessionId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetIdentifier } = await request.json();
    if (!targetIdentifier) {
        return json({ error: 'Missing target identifier' }, { status: 400 });
    }

    try {
        const userId = parseInt(sessionId);

        const target = db.prepare(`
            SELECT id, username, role FROM users 
            WHERE username = ? OR citizen_id = ?
        `).get(targetIdentifier, targetIdentifier) as { id: number, username: string, role: string } | undefined;

        if (!target || target.role === 'ADMIN') {
            return json({ error: 'NET_ERR_NOT_FOUND' }, { status: 404 });
        }

        if (target.id === userId) {
            return json({ error: 'NET_ERR_SELF' }, { status: 400 });
        }

        const existing = db.prepare(`
            SELECT id, status FROM friend_requests 
            WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)
        `).get(userId, target.id, target.id, userId) as { id: number, status: string } | undefined;

        if (existing) {
            return json({ error: 'NET_ERR_DUPLICATE' }, { status: 400 });
        }

        db.prepare('INSERT INTO friend_requests (senderId, receiverId, status) VALUES (?, ?, ?)')
          .run(userId, target.id, 'PENDING');

        /** Broadcast notification */
        chatStore.broadcast({
            type: 'notification',
            receiverId: target.id,
            title: 'NEW COMPLIANCE NETWORK REQUEST',
            message: `Citizen ${sessionId} has sent you a friend request.`
        });

        return json({ success: true, code: 'NET_SUCCESS_SENT' });
    } catch (err: any) {
        console.error('Failed to send request:', err);
        return json({ error: 'Failed to initiate sync request' }, { status: 500 });
    }
}

export async function PUT({ request, cookies }) {
    const sessionId = cookies.get('session');
    if (!sessionId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = await request.json();
    if (!requestId) {
        return json({ error: 'Missing request identifier' }, { status: 400 });
    }

    try {
        const userId = parseInt(sessionId);

        const req = db.prepare('SELECT id, receiverId FROM friend_requests WHERE id = ?').get(requestId) as { id: number, receiverId: number } | undefined;
        if (!req || req.receiverId !== userId) {
            return json({ error: 'Request not found or unauthorized' }, { status: 403 });
        }

        db.prepare("UPDATE friend_requests SET status = 'ACCEPTED' WHERE id = ?").run(requestId);

        return json({ success: true, code: 'NET_SUCCESS_ACCEPTED' });
    } catch (err: any) {
        console.error('Failed to accept request:', err);
        return json({ error: 'Failed to accept sync request' }, { status: 500 });
    }
}

export async function DELETE({ request, cookies }) {
    const sessionId = cookies.get('session');
    if (!sessionId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId, friendId } = await request.json();

    try {
        const userId = parseInt(sessionId);

        if (requestId) {
            const req = db.prepare('SELECT id, senderId, receiverId FROM friend_requests WHERE id = ?').get(requestId) as { id: number, senderId: number, receiverId: number } | undefined;
            if (!req || (req.senderId !== userId && req.receiverId !== userId)) {
                return json({ error: 'Request not found or unauthorized' }, { status: 403 });
            }
            db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
        } else if (friendId) {
            db.prepare(`
                DELETE FROM friend_requests 
                WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)
            `).run(userId, friendId, friendId, userId);
        } else {
            return json({ error: 'Missing identifier parameters' }, { status: 400 });
        }

        return json({ success: true, code: 'NET_SUCCESS_DECLINED' });
    } catch (err: any) {
        console.error('Failed to delete sync link:', err);
        return json({ error: 'Failed to delete request/sync link' }, { status: 500 });
    }
}
