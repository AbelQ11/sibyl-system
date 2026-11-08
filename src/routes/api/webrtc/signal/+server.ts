import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const ALLOWED_SIGNAL_TYPES = new Set(['offer', 'answer', 'ice-candidate', 'join-ping', 'end-call']);

export const POST: RequestHandler = async ({ request, cookies }) => {
	const user = getAuthUser(cookies.get('session'));
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json().catch(() => null);
		const { targetId, targetGroupId, signalType, signalData } = body || {};

		if (!ALLOWED_SIGNAL_TYPES.has(signalType) || !signalData) {
			return json({ error: 'Missing or invalid signal data' }, { status: 400 });
		}

		if (typeof signalData !== 'object') {
			return json({ error: 'Invalid signal payload' }, { status: 400 });
		}

		if (JSON.stringify(signalData).length > 100_000) {
			return json({ error: 'Signal payload too large' }, { status: 400 });
		}

		const payload = {
			type: 'webrtc_signal',
			senderId: user.id,
			senderName: user.username,
			signalType,
			signalData,
			targetGroupId
		};

		if (targetId) {
			const targetUserId = Number(targetId);
			if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
				return json({ error: 'Invalid target user' }, { status: 400 });
			}

			const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(targetUserId) as
				{ id: number; role: string } | undefined;
			if (!target) return json({ error: 'Target user not found' }, { status: 404 });

			if (user.role !== 'ADMIN' && target.role !== 'ADMIN') {
				const isFriend = db
					.prepare(
						`
                    SELECT 1 FROM friend_requests
                    WHERE status = 'ACCEPTED' AND (
                        (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)
                    )
                `
					)
					.get(user.id, targetUserId, targetUserId, user.id);
				if (!isFriend) {
					return json({ error: 'Calls require an accepted compliance link' }, { status: 403 });
				}
			}

			chatStore.broadcast(payload, [targetUserId]);
		} else if (targetGroupId) {
			const groupId = Number(targetGroupId);
			if (!Number.isInteger(groupId) || groupId <= 0) {
				return json({ error: 'Invalid target division' }, { status: 400 });
			}

			const group = db.prepare('SELECT id FROM chat_groups WHERE id = ?').get(groupId);
			if (!group) return json({ error: 'Division not found' }, { status: 404 });

			if (user.role !== 'ADMIN') {
				const isMember = db
					.prepare('SELECT 1 FROM chat_group_members WHERE groupId = ? AND userId = ?')
					.get(groupId, user.id);
				if (!isMember) {
					return json({ error: 'Not a member of this division' }, { status: 403 });
				}
			}

			const members = db
				.prepare('SELECT userId FROM chat_group_members WHERE groupId = ? AND userId != ?')
				.all(groupId, user.id) as { userId: number }[];
			const memberIds = members.map((m) => m.userId);
			if (memberIds.length > 0) {
				chatStore.broadcast(payload, memberIds);
			}
		} else {
			return json({ error: 'Missing call target' }, { status: 400 });
		}

		return json({ success: true });
	} catch (e: any) {
		console.error('Error sending WebRTC signal:', e);
		return json({ error: 'Server error' }, { status: 500 });
	}
};
