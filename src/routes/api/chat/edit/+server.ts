import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { getAuthUser } from '$lib/server/auth';
import { moderateMessage } from '$lib/server/moderation';
import type { RequestHandler } from './$types';

/**
 * Updates the text content of an existing chat message.
 * Only the original sender is permitted to edit their own messages.
 * Moderated/redacted messages cannot be restored by editing.
 */
export const PUT: RequestHandler = async ({ request, cookies }) => {
	const user = getAuthUser(cookies.get('session'));
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json().catch(() => null);
		const messageId = Number(body?.messageId);
		const text = typeof body?.text === 'string' ? body.text.trim() : '';

		if (!Number.isInteger(messageId) || messageId <= 0) {
			return json({ error: 'Missing message ID' }, { status: 400 });
		}
		if (!text) return json({ error: 'Missing message text' }, { status: 400 });
		if (text.length > 250)
			return json({ error: 'Message exceeds 250 characters limit' }, { status: 400 });

		const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(messageId) as any;
		if (!msg) return json({ error: 'Message not found' }, { status: 404 });

		if (msg.senderId !== user.id) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		if (msg.is_censored) {
			return json({ error: 'Moderated messages cannot be edited' }, { status: 403 });
		}

		db.prepare('UPDATE chat_messages SET text = ?, is_edited = 1 WHERE id = ?').run(
			text,
			messageId
		);

		const updatedMsg = db
			.prepare(
				`
            SELECT m.*, 
                   u.username as senderName, u.citizen_id as senderCitizenId,
                   u.role as senderRole, u.avatar as senderAvatar,
                   (SELECT cc FROM userStats WHERE userId = u.id ORDER BY id DESC LIMIT 1) as senderCC,
                   g.name as groupName
            FROM chat_messages m
            JOIN users u ON m.senderId = u.id
            LEFT JOIN chat_groups g ON m.groupId = g.id
            WHERE m.id = ?
        `
			)
			.get(messageId) as any;

		if (updatedMsg) {
			updatedMsg.isReadOnce = Boolean(updatedMsg.isReadOnce);
			updatedMsg.read = Boolean(updatedMsg.read);
			updatedMsg.is_edited = Boolean(updatedMsg.is_edited);
			updatedMsg.is_censored = Boolean(updatedMsg.is_censored);
		}

		let memberIds: number[] | undefined;
		if (msg.groupId) {
			const groupMembers = db
				.prepare(`SELECT userId FROM chat_group_members WHERE groupId = ?`)
				.all(msg.groupId) as any[];
			memberIds = groupMembers.map((m) => m.userId);
		} else if (msg.receiverId) {
			memberIds = [msg.senderId, msg.receiverId];
		}

		chatStore.broadcast({ type: 'message_edited', message: updatedMsg }, memberIds);

		// Editing a public message must not bypass the empathy daemon.
		if (!msg.groupId && !msg.receiverId) {
			moderateMessage(messageId, text, user.id).catch((err) =>
				console.error('Moderation Daemon Error:', err)
			);
		}

		return json({ success: true, message: updatedMsg });
	} catch (e: any) {
		console.error('Edit message error:', e);
		return json({ error: 'Server error' }, { status: 500 });
	}
};
