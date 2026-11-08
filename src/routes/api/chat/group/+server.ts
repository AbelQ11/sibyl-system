import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { getLatestCC } from '$lib/server/repositories/statsRepository';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const user = getAuthUser(cookies.get('session'));
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		let query = `
            SELECT g.*, 
                   (SELECT COUNT(*) FROM chat_group_members WHERE groupId = g.id) as memberCount,
                   1 as isMember
            FROM chat_groups g
            JOIN chat_group_members cgm ON g.id = cgm.groupId
            WHERE cgm.userId = ?
        `;
		let params: any[] = [user.id];

		if (user.role === 'ADMIN') {
			query = `
                SELECT g.*, 
                       (SELECT COUNT(*) FROM chat_group_members WHERE groupId = g.id) as memberCount,
                       (SELECT 1 FROM chat_group_members WHERE groupId = g.id AND userId = ?) as isMember
                FROM chat_groups g
            `;
			params = [user.id];
		}

		const groups = db.prepare(query).all(...params) as any[];
		return json({ groups: groups.map((g) => ({ ...g, isMember: Boolean(g.isMember) })) });
	} catch (e: any) {
		console.error('Group list error:', e);
		return json({ error: 'Server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const user = getAuthUser(cookies.get('session'));
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json().catch(() => null);
		const action = body?.action;
		const currentCC = getLatestCC(user.id);

		if (action === 'CREATE') {
			const name = typeof body?.name === 'string' ? body.name.trim() : '';
			const maxCC = Number(body?.maxCC ?? 100);

			if (!name) return json({ error: 'Group name required' }, { status: 400 });
			if (name.length > 50)
				return json({ error: 'Group name must be 50 characters or less' }, { status: 400 });
			if (!Number.isFinite(maxCC) || maxCC < 0 || maxCC > 999) {
				return json({ error: 'maxCC must be between 0 and 999' }, { status: 400 });
			}

			const existingMembership = db
				.prepare('SELECT 1 FROM chat_group_members WHERE userId = ?')
				.get(user.id);
			if (existingMembership) {
				return json(
					{ error: 'You are already a member of a division. You can only belong to one.' },
					{ status: 403 }
				);
			}

			if (user.role !== 'ADMIN' && currentCC > maxCC) {
				return json({ error: 'Your CC exceeds the max CC you are trying to set' }, { status: 403 });
			}

			const info = db
				.prepare('INSERT INTO chat_groups (name, maxCC, inspectorId) VALUES (?, ?, ?)')
				.run(name, maxCC, user.id);
			const groupId = info.lastInsertRowid;

			db.prepare(
				"INSERT INTO chat_group_members (groupId, userId, role) VALUES (?, ?, 'CITIZEN')"
			).run(groupId, user.id);

			return json({ success: true, groupId, name, maxCC });
		}

		if (action === 'JOIN') {
			const groupId = Number(body?.groupId);
			if (!Number.isInteger(groupId) || groupId <= 0) {
				return json({ error: 'Invalid group' }, { status: 400 });
			}

			const group = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(groupId) as any;
			if (!group) return json({ error: 'Group not found' }, { status: 404 });

			if (user.role !== 'ADMIN' && currentCC > group.maxCC) {
				return json(
					{
						error: `Access Denied: Your Crime Coefficient (${Math.round(currentCC)}) exceeds the group threshold (${group.maxCC}).`
					},
					{ status: 403 }
				);
			}

			const existingMembership = db
				.prepare('SELECT 1 FROM chat_group_members WHERE userId = ?')
				.get(user.id);
			if (existingMembership) {
				return json(
					{ error: 'You are already a member of a division. You can only belong to one.' },
					{ status: 403 }
				);
			}

			try {
				db.prepare('INSERT INTO chat_group_members (groupId, userId) VALUES (?, ?)').run(
					groupId,
					user.id
				);
			} catch (e: any) {
				if (String(e?.message).includes('UNIQUE constraint')) {
					return json({ error: 'Already a member' }, { status: 400 });
				}
				throw e;
			}

			return json({ success: true, group });
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (e: any) {
		console.error('Group action error:', e);
		return json({ error: 'Server error' }, { status: 500 });
	}
};
