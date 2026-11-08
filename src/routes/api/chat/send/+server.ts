import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { getSession } from '$lib/server/session';
import { queryAI } from '$lib/server/aiFallbackEngine';
import { getUserWithCosmetics } from '$lib/server/repositories/userRepository';
import { getLatestCC } from '$lib/server/repositories/statsRepository';
import { insertMessage } from '$lib/server/repositories/messageRepository';
import { moderateMessage } from '$lib/server/moderation';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const MAX_ATTACHMENT_CHARS = 7_000_000;
const ATTACHMENT_RE =
	/^data:(image\/(?:png|jpeg|webp)|audio\/(?:webm|ogg|mpeg|mp4|wav));base64,[A-Za-z0-9+/=\s]+$/;

const SendMessageSchema = z.object({
	text: z
		.string()
		.min(1, 'Message text is required')
		.max(250, 'Message exceeds 250 characters limit'),
	targetType: z.enum(['PUBLIC', 'GROUP', 'PRIVATE', 'GLOBAL']),
	targetId: z.number().int().positive().nullable().optional(),
	isReadOnce: z.boolean().optional().default(false),
	replyToId: z.number().int().positive().nullable().optional(),
	attachment: z.string().max(MAX_ATTACHMENT_CHARS).nullable().optional()
});

function isAcceptedFriend(userId: number, otherId: number): boolean {
	return Boolean(
		db
			.prepare(
				`
        SELECT 1 FROM friend_requests
        WHERE status = 'ACCEPTED' AND (
            (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)
        )
    `
			)
			.get(userId, otherId, otherId, userId)
	);
}

/**
 * Processes and transmits a new chat message.
 * Validates the input payload, enforces slowmode and group membership rules,
 * interacts with the AI fallback engine if necessary, and broadcasts the event
 * via the SSE chat store.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const session = getSession(cookies.get('session'));
	if (!session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const user = getUserWithCosmetics(session.userId);
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const parsed = SendMessageSchema.safeParse(body);
		if (!parsed.success) {
			return json({ error: parsed.error.issues[0].message }, { status: 400 });
		}

		const { text, targetType, targetId, isReadOnce, replyToId, attachment } = parsed.data;

		if (isReadOnce && targetType !== 'PRIVATE' && targetType !== 'GROUP') {
			return json(
				{ error: 'Read-Once is only available for private and division comms' },
				{ status: 400 }
			);
		}

		if (attachment && !ATTACHMENT_RE.test(attachment)) {
			return json({ error: 'Unsupported attachment type or malformed data' }, { status: 400 });
		}

		const cc = getLatestCC(user.id);

		let receiverId: number | null = null;
		let groupId: number | null = null;

		if (targetType === 'PRIVATE') {
			if (!targetId) {
				return json({ error: 'Missing private message recipient' }, { status: 400 });
			}
			receiverId = targetId;

			const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(receiverId) as
				{ id: number; role: string } | undefined;
			if (!target) {
				return json({ error: 'Recipient not found' }, { status: 404 });
			}

			if (receiverId !== user.id && user.role !== 'ADMIN' && target.role !== 'ADMIN') {
				if (!isAcceptedFriend(user.id, receiverId)) {
					return json(
						{ error: 'Private comms require an accepted compliance link' },
						{ status: 403 }
					);
				}
			}
		} else if (targetType === 'GROUP') {
			if (!targetId) {
				return json({ error: 'Missing target division' }, { status: 400 });
			}
			groupId = targetId;

			const group = db.prepare('SELECT id FROM chat_groups WHERE id = ?').get(groupId);
			if (!group) {
				return json({ error: 'Division not found' }, { status: 404 });
			}

			if (user.role !== 'ADMIN') {
				const isMember = db
					.prepare(
						`
                    SELECT 1 FROM chat_group_members WHERE groupId = ? AND userId = ?
                `
					)
					.get(groupId, user.id);
				if (!isMember) {
					return json({ error: 'Not a member of this group' }, { status: 403 });
				}
			}
		} else {
			// Public / global channels use a shared slowmode for non-admins.
			if (user.role !== 'ADMIN') {
				const lastMessage = db
					.prepare(
						`
                    SELECT created_at FROM chat_messages 
                    WHERE senderId = ? AND groupId IS NULL AND receiverId IS NULL 
                    ORDER BY id DESC LIMIT 1
                `
					)
					.get(user.id) as { created_at: string } | undefined;

				if (lastMessage) {
					const createdStr = lastMessage.created_at.includes('T')
						? lastMessage.created_at
						: lastMessage.created_at.replace(' ', 'T') + 'Z';
					const lastMessageTime = new Date(createdStr).getTime();
					const diff = Date.now() - lastMessageTime;
					if (diff < 5000) {
						return json(
							{
								error: `Public comms slowmode active. Please wait ${Math.ceil((5000 - diff) / 1000)} seconds.`
							},
							{ status: 429 }
						);
					}
				}
			}
		}

		let parentMessage:
			| {
					id: number;
					senderId: number;
					receiverId: number | null;
					groupId: number | null;
					isReadOnce: number;
					text: string;
			  }
			| undefined;

		if (replyToId) {
			parentMessage = db
				.prepare(
					`
                SELECT id, senderId, receiverId, groupId, isReadOnce, text
                FROM chat_messages WHERE id = ?
            `
				)
				.get(replyToId) as typeof parentMessage;

			if (!parentMessage) return json({ error: 'Parent message not found' }, { status: 404 });
			if (parentMessage.isReadOnce)
				return json({ error: 'Cannot reply to a classified Read-Once message' }, { status: 403 });

			// A reply preview embeds the parent's text. Only allow it when the
			// sender can already see that message in the same conversation.
			let canReply = user.role === 'ADMIN';
			if (!canReply) {
				if (parentMessage.groupId) {
					canReply = parentMessage.groupId === groupId;
				} else if (parentMessage.receiverId) {
					canReply =
						(parentMessage.senderId === user.id && parentMessage.receiverId === receiverId) ||
						(parentMessage.receiverId === user.id && parentMessage.senderId === receiverId);
				} else {
					canReply = targetType === 'PUBLIC' || targetType === 'GLOBAL';
				}
			}
			if (!canReply) {
				return json({ error: 'Parent message is outside this conversation' }, { status: 403 });
			}
		}

		const messageId = insertMessage(
			user.id,
			text,
			targetType,
			(targetType === 'PRIVATE' ? receiverId : targetType === 'GROUP' ? groupId : null) as
				number | null,
			isReadOnce ? 1 : 0,
			replyToId || null,
			attachment || null
		);

		let groupName = null;
		if (groupId) {
			const group = db.prepare(`SELECT name FROM chat_groups WHERE id = ?`).get(groupId) as
				{ name: string } | undefined;
			if (group) groupName = group.name;
		}

		const senderGroupRow = db
			.prepare(
				`
            SELECT cg.id, cg.name 
            FROM chat_group_members cgm 
            JOIN chat_groups cg ON cgm.groupId = cg.id 
            WHERE cgm.userId = ? LIMIT 1
        `
			)
			.get(user.id) as { id: number; name: string } | undefined;
		const senderGroupName = senderGroupRow ? senderGroupRow.name : null;
		const senderGroupId = senderGroupRow ? senderGroupRow.id : null;

		let replyToMessage = null;
		if (replyToId && parentMessage) {
			const parentSender = db
				.prepare(
					`
                SELECT u.username as senderName, u.citizen_id as senderCitizenId,
                       (SELECT AVG(cc) FROM userStats WHERE userId = u.id) as avgCC
                FROM users u WHERE u.id = ?
            `
				)
				.get(parentMessage.senderId) as
				{ senderName: string; senderCitizenId: string; avgCC: number | null } | undefined;

			if (parentSender) {
				replyToMessage = {
					text: parentMessage.text,
					senderName: parentSender.senderName,
					senderCitizenId: parentSender.senderCitizenId,
					senderAvgCC: Math.round(parentSender.avgCC || 0)
				};
			}
		}

		const senderRow = db.prepare('SELECT citizen_id FROM users WHERE id = ?').get(user.id) as
			{ citizen_id: string } | undefined;

		const messagePayload = {
			id: Number(messageId),
			targetType,
			senderId: user.id,
			senderName: user.username,
			senderCitizenId: senderRow?.citizen_id || null,
			senderNameEffect: user.nameEffect,
			senderAvatar: user.avatar,
			senderAvatarBorder: user.avatarBorder,
			senderCC: cc,
			senderRole: user.role,
			receiverId,
			groupId,
			groupName,
			senderGroupName,
			senderGroupId,
			text,
			isReadOnce: Boolean(isReadOnce),
			replyToId: replyToId || null,
			replyToMessage,
			attachment: attachment || null,
			reactions: [],
			created_at: new Date().toISOString()
		};

		const payloadText = isReadOnce ? '' : text;

		const broadcastTo = (recipientIds?: number[]) => {
			if (!messagePayload.isReadOnce) {
				chatStore.broadcast({ type: 'message', message: messagePayload }, recipientIds);
				return;
			}

			// Sender sees their own message; other participants receive a
			// locked envelope. The text is only released by /api/chat/reveal.
			chatStore.broadcast({ type: 'message', message: messagePayload }, [user.id]);
			const locked = { ...messagePayload, text: payloadText, attachment: null, locked: true };
			const others = recipientIds ? recipientIds.filter((id) => id !== user.id) : undefined;
			if (others === undefined || others.length > 0) {
				chatStore.broadcast({ type: 'message', message: locked }, others);
			}
		};

		if (user.role === 'ADMIN' && targetType === 'GLOBAL') {
			chatStore.broadcast({ type: 'message', message: messagePayload });
		} else if (targetType === 'PRIVATE') {
			broadcastTo([user.id, receiverId as number]);
		} else if (targetType === 'GROUP') {
			const members = db
				.prepare(`SELECT userId FROM chat_group_members WHERE groupId = ?`)
				.all(groupId) as { userId: number }[];
			const memberIds = members.map((m) => m.userId);
			if (!memberIds.includes(user.id)) memberIds.push(user.id);
			broadcastTo(memberIds);
		} else {
			chatStore.broadcast({ type: 'message', message: messagePayload });
			moderateMessage(Number(messageId), text, user.id).catch((err) =>
				console.error('Moderation Daemon Error:', err)
			);
		}

		return json({ success: true, message: messagePayload });
	} catch (e: any) {
		console.error('Error sending message:', e);
		return json({ error: 'Server error' }, { status: 500 });
	}
};
