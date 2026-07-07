import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ request, cookies }) => {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(sessionId) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { messageId } = await request.json();
        if (!messageId) return json({ error: 'Missing message ID' }, { status: 400 });

        const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId) as any;
        if (!msg) return json({ error: 'Message not found' }, { status: 404 });

        /** Only ADMIN or the sender can delete the message */
        if (msg.senderId !== user.id && user.role !== 'ADMIN') {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        /** Hard delete */
        db.prepare('DELETE FROM chat_messages WHERE id = ?').run(messageId);

        /** Broadcast delete */
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
