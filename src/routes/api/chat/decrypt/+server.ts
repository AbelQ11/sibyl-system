import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Deletes a read-once (classified) message immediately after decryption.
 * Enforces the self-destruct mechanism for secure communications.
 *
 * @param request - The HTTP request containing the target messageId.
 * @param cookies - The request cookies used for session authentication.
 * @returns JSON response indicating successful secure deletion.
 */
export const DELETE: RequestHandler = async ({ request, cookies }) => {
    if (!getAuthUser(cookies.get('session'))) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { messageId } = body;

        if (!messageId) {
            return json({ error: 'Message ID is required' }, { status: 400 });
        }


        const message = db.prepare(`SELECT * FROM chat_messages WHERE id = ?`).get(messageId) as any;
        
        if (!message) {
            return json({ error: 'Message not found' }, { status: 404 });
        }

        if (!message.isReadOnce) {
            return json({ error: 'Message is not a Read-Once message' }, { status: 400 });
        }


        db.prepare(`DELETE FROM chat_messages WHERE id = ?`).run(messageId);


        let targetUserIds = undefined;
        if (message.receiverId) {
            targetUserIds = [message.senderId, message.receiverId];
        } else if (message.groupId) {
            const members = db.prepare(`SELECT userId FROM chat_group_members WHERE groupId = ?`).all(message.groupId) as any[];
            targetUserIds = members.map(m => m.userId);
            if (!targetUserIds.includes(message.senderId)) targetUserIds.push(message.senderId);
        }

        chatStore.broadcast({ type: 'message_deleted', messageId }, targetUserIds);

        return json({ success: true });

    } catch (e: any) {
        console.error("Error decrypting message:", e);
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};
