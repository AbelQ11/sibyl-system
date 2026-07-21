import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Censors a specific chat message.
 * Only administrators can perform this action.
 * Replaces the message text with a redaction string and broadcasts the edit.
 *
 * @param request - The HTTP request containing the target messageId.
 * @param cookies - The request cookies used for session authentication.
 * @returns JSON response indicating success or a forbidden error.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
    const user = getAuthUser(cookies.get('session')) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        if (user.role !== 'ADMIN') {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        const { messageId } = await request.json();
        if (!messageId) return json({ error: 'Missing message ID' }, { status: 400 });

        const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId) as any;
        if (!msg) return json({ error: 'Message not found' }, { status: 404 });

        const words = msg.text.split(/\b/);
        for (let i = 0; i < words.length; i++) {
            if (words[i].trim() !== '' && Math.random() < 0.5) {
                words[i] = '████';
            }
        }
        const redactedText = words.join('');

        db.prepare('UPDATE chat_messages SET text = ?, isReadOnce = 0 WHERE id = ?').run(redactedText, messageId);

        let memberIds: number[] | undefined;
        if (msg.groupId) {
            const groupMembers = db.prepare(`SELECT userId FROM chat_group_members WHERE groupId = ?`).all(msg.groupId) as any[];
            memberIds = groupMembers.map(m => m.userId);
        } else if (msg.receiverId) {
            memberIds = [msg.senderId, msg.receiverId];
        }

        chatStore.broadcast({ 
            type: 'message_edited', 
            message: { id: messageId, text: redactedText, isReadOnce: false } 
        }, memberIds);

        return json({ success: true });
    } catch (e: any) {
        console.error('Censor message error:', e);
        return json({ error: 'Server error' }, { status: 500 });
    }
};
