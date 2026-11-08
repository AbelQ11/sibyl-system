import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Legacy self-destruct endpoint. New clients use /api/chat/reveal, which
 * returns the text once. This endpoint remains for compatibility and still
 * enforces that only a participant can delete the message.
 */
export const DELETE: RequestHandler = async ({ request, cookies }) => {
	const user = getAuthUser(cookies.get('session'));
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json().catch(() => null);
		const messageId = Number(body?.messageId);
		if (!Number.isInteger(messageId) || messageId <= 0) {
			return json({ error: 'Message ID is required' }, { status: 400 });
		}

		const message = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId) as any;
		if (!message) return json({ error: 'Message not found' }, { status: 404 });
		if (!message.isReadOnce)
			return json({ error: 'Message is not a Read-Once message' }, { status: 400 });

		const isSender = message.senderId === user.id;
		const isReceiver = message.receiverId === user.id;
		const isGroupMember = message.groupId
			? Boolean(
					db
						.prepare('SELECT 1 FROM chat_group_members WHERE groupId = ? AND userId = ?')
						.get(message.groupId, user.id)
				)
			: false;

		if (!isSender && !isReceiver && !isGroupMember) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		let targetUserIds: number[] | undefined;
		if (message.receiverId) {
			targetUserIds = [message.senderId, message.receiverId];
		} else if (message.groupId) {
			const members = db
				.prepare('SELECT userId FROM chat_group_members WHERE groupId = ?')
				.all(message.groupId) as { userId: number }[];
			targetUserIds = members.map((m) => m.userId);
			if (!targetUserIds.includes(message.senderId)) targetUserIds.push(message.senderId);
		}

		db.prepare('DELETE FROM chat_messages WHERE id = ?').run(messageId);
		chatStore.broadcast({ type: 'message_deleted', messageId }, targetUserIds);

		return json({ success: true });
	} catch (e: any) {
		console.error('Error decrypting message:', e);
		return json({ error: 'Server error' }, { status: 500 });
	}
};
