import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(sessionId) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { groupId, friendId } = await request.json();
        if (!groupId || !friendId) return json({ error: 'Missing groupId or friendId' }, { status: 400 });

        /** Verify the current user is in the group or ADMIN */
        if (user.role !== 'ADMIN') {
            const isMember = db.prepare('SELECT 1 FROM chat_group_members WHERE groupId = ? AND userId = ?').get(groupId, user.id);
            if (!isMember) {
                return json({ error: 'You are not a member of this division' }, { status: 403 });
            }
        }

        /** Verify the friend is a valid accepted friend */
        const isFriend = db.prepare(`
            SELECT 1 FROM friend_requests 
            WHERE status = 'ACCEPTED' AND 
            ((senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?))
        `).get(user.id, friendId, friendId, user.id);
        
        if (!isFriend && user.role !== 'ADMIN') {
            return json({ error: 'Can only invite approved compliance network members' }, { status: 403 });
        }

        const group = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return json({ error: 'Division not found' }, { status: 404 });

        /** Check friend's CC */
        const stats = db.prepare('SELECT cc FROM userStats WHERE userId = ? ORDER BY created_at DESC LIMIT 1').get(friendId) as any;
        const friendCC = stats ? stats.cc : 0;

        if (friendCC > group.maxCC) {
            return json({ error: `Cannot invite: Citizen's CC (${Math.round(friendCC)}) exceeds group limit (${group.maxCC}).` }, { status: 400 });
        }

        /** Check if friend is already in a group */
        const friendExistingMembership = db.prepare(`SELECT 1 FROM chat_group_members WHERE userId = ?`).get(friendId);
        if (friendExistingMembership) {
            return json({ error: 'Citizen is already a member of a division. They can only belong to one.' }, { status: 400 });
        }

        /** Check for existing pending request */
        const existingRequest = db.prepare(`SELECT 1 FROM group_requests WHERE groupId = ? AND userId = ? AND status = 'PENDING'`).get(groupId, friendId);
        if (existingRequest) {
            return json({ error: 'Citizen already has a pending invite for this division' }, { status: 400 });
        }

        /** Insert into group_requests */
        try {
            db.prepare('INSERT INTO group_requests (groupId, userId, senderId, status) VALUES (?, ?, ?, ?)')
              .run(groupId, friendId, user.id, 'PENDING');
            
            /** Broadcast notification */
            chatStore.broadcast({
                type: 'notification',
                receiverId: friendId,
                title: 'DIVISION INVITE',
                message: `${user.username.toUpperCase()} has invited you to join ${group.name.toUpperCase()}`
            });
        } catch (e: any) {
            throw e;
        }

        return json({ success: true, message: 'Invite request dispatched' });
    } catch (e: any) {
        console.error('Invite error:', e);
        return json({ error: 'Server error' }, { status: 500 });
    }
};
