import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request, cookies }) => {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(sessionId) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { messageId, text } = await request.json();
        if (!messageId || !text || !text.trim()) return json({ error: 'Missing message ID or text' }, { status: 400 });

        const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId) as any;
        if (!msg) return json({ error: 'Message not found' }, { status: 404 });

        /** Only sender can edit the message */
        if (msg.senderId !== user.id) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        /** Update DB */
        db.prepare('UPDATE chat_messages SET text = ?, is_edited = 1 WHERE id = ?').run(text.trim(), messageId);

        /** Fetch updated message */
        const updatedMsg = db.prepare(`
            SELECT m.*, 
                   u.username as senderName, u.role as senderRole, u.avatar as senderAvatar,
                   (SELECT cc FROM userStats WHERE userId = u.id ORDER BY created_at DESC LIMIT 1) as senderCC,
                   g.name as groupName
            FROM chat_messages m
            JOIN users u ON m.senderId = u.id
            LEFT JOIN chat_groups g ON m.groupId = g.id
            WHERE m.id = ?
        `).get(messageId) as any;

        /** Ensure is_edited is treated as boolean */
        if (updatedMsg) {
            updatedMsg.isReadOnce = Boolean(updatedMsg.isReadOnce);
            updatedMsg.read = Boolean(updatedMsg.read);
            updatedMsg.is_edited = Boolean(updatedMsg.is_edited);
        }

        /** Broadcast edit */
        let memberIds: number[] | undefined;
        if (msg.groupId) {
            const groupMembers = db.prepare(`SELECT userId FROM chat_group_members WHERE groupId = ?`).all(msg.groupId) as any[];
            memberIds = groupMembers.map(m => m.userId);
        } else if (msg.receiverId) {
            memberIds = [msg.senderId, msg.receiverId];
        }

        chatStore.broadcast({ type: 'message_edited', message: updatedMsg }, memberIds);

        return json({ success: true, message: updatedMsg });
    } catch (e: any) {
        console.error('Edit message error:', e);
        return json({ error: 'Server error' }, { status: 500 });
    }
};
