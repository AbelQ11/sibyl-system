import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
    const user = getAuthUser(cookies.get('session')) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        let { messageId, emoji } = await request.json();
        if (!messageId || !emoji) return json({ error: 'Missing parameters' }, { status: 400 });
        emoji = emoji.substring(0, 2);

        const message = db.prepare('SELECT id, groupId, receiverId, senderId FROM chat_messages WHERE id = ?').get(messageId) as any;
        if (!message) return json({ error: 'Message not found' }, { status: 404 });

        const existing = db.prepare('SELECT id FROM chat_message_reactions WHERE messageId = ? AND userId = ? AND emoji = ?').get(messageId, user.id, emoji) as any;

        if (existing) {
            db.prepare('DELETE FROM chat_message_reactions WHERE id = ?').run(existing.id);
        } else {
            db.prepare('INSERT INTO chat_message_reactions (messageId, userId, emoji) VALUES (?, ?, ?)').run(messageId, user.id, emoji);
        }

        const rawReactions = db.prepare('SELECT emoji, userId FROM chat_message_reactions WHERE messageId = ?').all(messageId) as any[];
        
        let targetIds: number[] | undefined = undefined;
        if (message.groupId) {
            const members = db.prepare('SELECT userId FROM chat_group_members WHERE groupId = ?').all(message.groupId) as { userId: number }[];
            targetIds = members.map(m => m.userId);
            if (!targetIds.includes(message.senderId)) targetIds.push(message.senderId);
        } else if (message.receiverId) {
            targetIds = [message.senderId, message.receiverId];
        }

        if (targetIds) {
            chatStore.broadcast({ type: 'reaction', messageId, reactions: rawReactions }, targetIds);
        } else {
            chatStore.broadcast({ type: 'reaction', messageId, reactions: rawReactions });
        }

        return json({ success: true, reactions: rawReactions });
    } catch (e: any) {
        console.error("Error toggling reaction:", e);
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};
