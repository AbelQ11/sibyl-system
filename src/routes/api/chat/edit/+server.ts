import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Updates the text content of an existing chat message.
 * Only the original sender is permitted to edit their own messages.
 * Broadcasts an edit event to all connected clients.
 *
 * @param request - The HTTP request containing the messageId and new text.
 * @param cookies - The request cookies used for session authentication.
 * @returns JSON response indicating success or a forbidden error.
 */
export const PUT: RequestHandler = async ({ request, cookies }) => {
    const user = getAuthUser(cookies.get('session')) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { messageId, text } = await request.json();
        if (!messageId || !text || !text.trim()) return json({ error: 'Missing message ID or text' }, { status: 400 });

        const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId) as any;
        if (!msg) return json({ error: 'Message not found' }, { status: 404 });


        if (msg.senderId !== user.id) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }


        db.prepare('UPDATE chat_messages SET text = ?, is_edited = 1 WHERE id = ?').run(text.trim(), messageId);


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


        if (updatedMsg) {
            updatedMsg.isReadOnce = Boolean(updatedMsg.isReadOnce);
            updatedMsg.read = Boolean(updatedMsg.read);
            updatedMsg.is_edited = Boolean(updatedMsg.is_edited);
        }


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
