import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { getAuthUser } from '$lib/server/auth';
import { getLatestCC } from '$lib/server/repositories/statsRepository';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const user = getAuthUser(cookies.get('session'));
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json().catch(() => null);
		const groupId = Number(body?.groupId);
		const friendId = Number(body?.friendId);

		if (
			!Number.isInteger(groupId) ||
			groupId <= 0 ||
			!Number.isInteger(friendId) ||
			friendId <= 0
		) {
			return json({ error: 'Missing groupId or friendId' }, { status: 400 });
		}

		const group = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(groupId) as any;
		if (!group) return json({ error: 'Division not found' }, { status: 404 });

		if (user.role !== 'ADMIN') {
			const isMember = db
				.prepare('SELECT role FROM chat_group_members WHERE groupId = ? AND userId = ?')
				.get(groupId, user.id) as { role: string } | undefined;
			if (!isMember) {
				return json({ error: 'You are not a member of this division' }, { status: 403 });
			}
		}

		const target = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(friendId) as
			{ id: number; username: string; role: string } | undefined;
		if (!target) return json({ error: 'Citizen not found' }, { status: 404 });

		if (user.role !== 'ADMIN' && target.role !== 'ADMIN') {
			const isFriend = db
				.prepare(
					`
                SELECT 1 FROM friend_requests 
                WHERE status = 'ACCEPTED' AND 
                ((senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?))
            `
				)
				.get(user.id, friendId, friendId, user.id);
			if (!isFriend) {
				return json(
					{ error: 'Can only invite approved compliance network members' },
					{ status: 403 }
				);
			}
		}

		const friendCC = getLatestCC(friendId);
		if (friendCC > group.maxCC) {
			return json(
				{
					error: `Cannot invite: Citizen's CC (${Math.round(friendCC)}) exceeds group limit (${group.maxCC}).`
				},
				{ status: 400 }
			);
		}

		const friendExistingMembership = db
			.prepare('SELECT 1 FROM chat_group_members WHERE userId = ?')
			.get(friendId);
		if (friendExistingMembership) {
			return json(
				{ error: 'Citizen is already a member of a division. They can only belong to one.' },
				{ status: 400 }
			);
		}

		const existingRequest = db
			.prepare(
				`
            SELECT 1 FROM group_requests
            WHERE groupId = ? AND userId = ? AND status = 'PENDING'
        `
			)
			.get(groupId, friendId);
		if (existingRequest) {
			return json(
				{ error: 'Citizen already has a pending invite for this division' },
				{ status: 400 }
			);
		}

		db.prepare(
			'INSERT INTO group_requests (groupId, userId, senderId, status) VALUES (?, ?, ?, ?)'
		).run(groupId, friendId, user.id, 'PENDING');

		chatStore.broadcast({
			type: 'notification',
			receiverId: friendId,
			title: 'DIVISION INVITE',
			message: `${user.username.toUpperCase()} has invited you to join ${group.name.toUpperCase()}`
		});

		return json({ success: true, message: 'Invite request dispatched' });
	} catch (e: any) {
		console.error('Invite error:', e);
		return json({ error: 'Server error' }, { status: 500 });
	}
};
