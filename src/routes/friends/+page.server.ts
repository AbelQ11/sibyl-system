import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { chatStore } from '$lib/server/chatStore';
import { z } from 'zod';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
    const user = getAuthUser(cookies.get('session'));
    if (!user) return { friends: [], incoming: [], outgoing: [] };

    try {
        const userId = user.id;

        let friends;
        if (user.role === 'ADMIN') {
            friends = db.prepare(`
                SELECT u.id, u.username, u.avatar, u.citizen_id, u.role,
                       (SELECT cc FROM userStats WHERE userId = u.id ORDER BY id DESC LIMIT 1) as last_cc
                FROM users u
                WHERE u.id != ?
            `).all(userId) as any[];
        } else {
            friends = db.prepare(`
                SELECT u.id, u.username, u.avatar, u.citizen_id, u.role,
                       (SELECT cc FROM userStats WHERE userId = u.id ORDER BY id DESC LIMIT 1) as last_cc
                FROM users u
                LEFT JOIN friend_requests r ON (r.receiverId = u.id AND r.senderId = ?) OR (r.senderId = u.id AND r.receiverId = ?)
                WHERE (r.status = 'ACCEPTED' OR u.role = 'ADMIN') AND u.id != ?
            `).all(userId, userId, userId) as any[];
        }

        const incoming = db.prepare(`
            SELECT r.id as requestId, u.id as senderId, u.username, u.avatar, u.citizen_id
            FROM users u
            JOIN friend_requests r ON r.senderId = u.id
            WHERE r.receiverId = ? AND r.status = 'PENDING'
        `).all(userId) as any[];

        const outgoing = db.prepare(`
            SELECT r.id as requestId, u.id as receiverId, u.username, u.avatar, u.citizen_id
            FROM users u
            JOIN friend_requests r ON r.receiverId = u.id
            WHERE r.senderId = ? AND r.status = 'PENDING'
        `).all(userId) as any[];

        return { friends, incoming, outgoing };
    } catch (err) {
        console.error('Failed to get friends list:', err);
        return { friends: [], incoming: [], outgoing: [], error: 'Failed to retrieve compliance network data' };
    }
};

const sendRequestSchema = z.object({
    targetIdentifier: z.string().min(1, 'Missing target identifier')
});

const handleRequestSchema = z.object({
    requestId: z.coerce.number()
});

export const actions: Actions = {
    sendRequest: async ({ request, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const parseResult = sendRequestSchema.safeParse(Object.fromEntries(formData));

        if (!parseResult.success) {
            return fail(400, { error: parseResult.error.errors[0].message });
        }

        const { targetIdentifier } = parseResult.data;

        try {
            const target = db.prepare(`
                SELECT id, username, role FROM users 
                WHERE username = ? OR citizen_id = ?
            `).get(targetIdentifier, targetIdentifier) as any;

            if (!target || target.role === 'ADMIN') {
                return fail(404, { error: 'NET_ERR_NOT_FOUND' });
            }

            if (target.id === user.id) {
                return fail(400, { error: 'NET_ERR_SELF' });
            }

            const existing = db.prepare(`
                SELECT id, status FROM friend_requests 
                WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)
            `).get(user.id, target.id, target.id, user.id);

            if (existing) {
                return fail(400, { error: 'NET_ERR_DUPLICATE' });
            }

            db.prepare('INSERT INTO friend_requests (senderId, receiverId, status) VALUES (?, ?, ?)')
              .run(user.id, target.id, 'PENDING');

            chatStore.broadcast({
                type: 'notification',
                receiverId: target.id,
                title: 'NEW COMPLIANCE NETWORK REQUEST',
                message: `Citizen ${user.username} has sent you a friend request.`
            });

            return { success: true, code: 'NET_SUCCESS_SENT' };
        } catch (err) {
            console.error('Failed to send request:', err);
            return fail(500, { error: 'Failed to initiate sync request' });
        }
    },

    acceptRequest: async ({ request, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const parseResult = handleRequestSchema.safeParse(Object.fromEntries(formData));

        if (!parseResult.success) {
            return fail(400, { error: 'Invalid request ID' });
        }

        const { requestId } = parseResult.data;

        try {
            const req = db.prepare('SELECT id, receiverId FROM friend_requests WHERE id = ?').get(requestId) as any;
            if (!req || req.receiverId !== user.id) {
                return fail(403, { error: 'Request not found or unauthorized' });
            }

            db.prepare("UPDATE friend_requests SET status = 'ACCEPTED' WHERE id = ?").run(requestId);

            return { success: true, code: 'NET_SUCCESS_ACCEPTED' };
        } catch (err) {
            return fail(500, { error: 'Failed to accept sync request' });
        }
    },

    declineRequest: async ({ request, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const parseResult = handleRequestSchema.safeParse(Object.fromEntries(formData));

        if (!parseResult.success) {
            return fail(400, { error: 'Invalid request ID' });
        }

        const { requestId } = parseResult.data;

        try {
            const req = db.prepare('SELECT id, senderId, receiverId FROM friend_requests WHERE id = ?').get(requestId) as any;
            if (!req || (req.senderId !== user.id && req.receiverId !== user.id)) {
                return fail(403, { error: 'Unauthorized' });
            }

            db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);

            return { success: true, code: 'NET_SUCCESS_DECLINED' };
        } catch (err) {
            return fail(500, { error: 'Server error' });
        }
    },

    removeFriend: async ({ request, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const friendId = Number(formData.get('friendId'));

        if (!friendId) return fail(400, { error: 'Missing friend ID' });

        try {
            db.prepare(`
                DELETE FROM friend_requests 
                WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)
            `).run(user.id, friendId, friendId, user.id);

            return { success: true, code: 'NET_SUCCESS_DECLINED' };
        } catch (err) {
            return fail(500, { error: 'Server error' });
        }
    }
};
