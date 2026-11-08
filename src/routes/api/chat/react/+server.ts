import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const user = getAuthUser(cookies.get('session'));
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json().catch(() => null);
		const messageId = Number(body?.messageId);
		const rawEmoji = typeof body?.emoji === 'string' ? body.emoji.trim() : '';

		if (!Number.isInteger(messageId) || messageId <= 0 || !rawEmoji) {
			return json({ error: 'Missing parameters' }, { status: 400 });
		}

		const emoji = Array.from(rawEmoji).slice(0, 2).join('');
		if (Array.from(emoji).length === 0 || Array.from(emoji).length > 2) {
			return json({ error: 'Invalid reaction' }, { status: 400 });
		}

		const message = db
			.prepare('SELECT id, groupId, receiverId, senderId FROM chat_messages WHERE id = ?')
			.get(messageId) as any;
		if (!message) return json({ error: 'Message not found' }, { status: 404 });

		if (user.role !== 'ADMIN') {
			let canSee = false;
			if (message.groupId) {
				canSee = Boolean(
					db
						.prepare('SELECT 1 FROM chat_group_members WHERE groupId = ? AND userId = ?')
						.get(message.groupId, user.id)
				);
			} else if (message.receiverId) {
				canSee = message.senderId === user.id || message.receiverId === user.id;
			} else {
				canSee = true;
			}
			if (!canSee) return json({ error: 'Forbidden' }, { status: 403 });
		}

		const existing = db
			.prepare(
				'SELECT id FROM chat_message_reactions WHERE messageId = ? AND userId = ? AND emoji = ?'
			)
			.get(messageId, user.id, emoji) as any;

		if (existing) {
			db.prepare('DELETE FROM chat_message_reactions WHERE id = ?').run(existing.id);
		} else {
			db.prepare(
				'INSERT INTO chat_message_reactions (messageId, userId, emoji) VALUES (?, ?, ?)'
			).run(messageId, user.id, emoji);
		}

		const rawReactions = db
			.prepare('SELECT emoji, userId FROM chat_message_reactions WHERE messageId = ?')
			.all(messageId) as any[];

		let targetIds: number[] | undefined;
		if (message.groupId) {
			const members = db
				.prepare('SELECT userId FROM chat_group_members WHERE groupId = ?')
				.all(message.groupId) as { userId: number }[];
			targetIds = members.map((m) => m.userId);
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
		console.error('Error toggling reaction:', e);
		return json({ error: 'Server error' }, { status: 500 });
	}
};
