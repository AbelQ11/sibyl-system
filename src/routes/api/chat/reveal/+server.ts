import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Reveals a Read-Once message exactly once. The sender may re-read their own
 * message; any other participant receives the text and the message is deleted
 * for everyone else. This prevents /api/chat/messages from exposing the
 * plaintext before this explicit action.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const user = getAuthUser(cookies.get('session'));
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json().catch(() => null);
		const messageId = Number(body?.messageId);
		if (!Number.isInteger(messageId) || messageId <= 0) {
			return json({ error: 'Missing message ID' }, { status: 400 });
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

		if (isSender) {
			return json({
				success: true,
				text: message.text,
				attachment: message.attachment,
				deleted: false
			});
		}

		let participantIds: number[] = [];
		if (message.groupId) {
			const members = db
				.prepare('SELECT userId FROM chat_group_members WHERE groupId = ?')
				.all(message.groupId) as { userId: number }[];
			participantIds = members.map((m) => m.userId);
			if (!participantIds.includes(message.senderId)) participantIds.push(message.senderId);
		} else {
			participantIds = [message.senderId, message.receiverId].filter(
				(id): id is number => typeof id === 'number'
			);
		}

		db.prepare('DELETE FROM chat_messages WHERE id = ?').run(messageId);

		// Keep the message visible for the revealing user, remove it elsewhere.
		const others = participantIds.filter((id) => id !== user.id);
		if (others.length > 0) {
			chatStore.broadcast({ type: 'message_deleted', messageId }, others);
		}

		return json({
			success: true,
			text: message.text,
			attachment: message.attachment,
			deleted: true
		});
	} catch (e: any) {
		console.error('Read-Once reveal error:', e);
		return json({ error: 'Server error' }, { status: 500 });
	}
};
