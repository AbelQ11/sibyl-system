import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Hard deletes a specific chat message from the database.
 * Deletion is restricted to the original sender or an Administrator.
 * Broadcasts a deletion event to all connected clients upon success.
 *
 * @param request - The HTTP request containing the target messageId.
 * @param cookies - The request cookies used for session authentication.
 * @returns JSON response indicating success or a forbidden error.
 */
export const DELETE: RequestHandler = async ({ request, cookies }) => {
    const user = getAuthUser(cookies.get('session')) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { messageId } = await request.json();
        if (!messageId) return json({ error: 'Missing message ID' }, { status: 400 });

        const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId) as any;
        if (!msg) return json({ error: 'Message not found' }, { status: 404 });


        if (msg.senderId !== user.id && user.role !== 'ADMIN') {
            return json({ error: 'Forbidden' }, { status: 403 });
        }


        db.prepare('DELETE FROM chat_messages WHERE id = ?').run(messageId);


        let memberIds: number[] | undefined;
        if (msg.groupId) {
            const groupMembers = db.prepare(`SELECT userId FROM chat_group_members WHERE groupId = ?`).all(msg.groupId) as any[];
            memberIds = groupMembers.map(m => m.userId);
        } else if (msg.receiverId) {
            memberIds = [msg.senderId, msg.receiverId];
        }

        chatStore.broadcast({ type: 'message_deleted', messageId }, memberIds);

        return json({ success: true });
    } catch (e: any) {
        console.error('Delete message error:', e);
        return json({ error: 'Server error' }, { status: 500 });
    }
};
