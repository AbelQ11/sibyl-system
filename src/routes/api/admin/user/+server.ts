import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser, resolvePublicUser } from '$lib/server/auth';

/**
 * All admin/user management routes.
 * Admin identity is verified via session cookie + role check.
 */

function getAdminUser(token: string | undefined) {
	const user = getAuthUser(token);
	if (!user || user.role !== 'ADMIN') return null;
	return user;
}

function findTarget(target: unknown): {
	user?: { id: number; username: string };
	ambiguous?: boolean;
} {
	if (typeof target === 'number' && Number.isInteger(target) && target > 0) {
		const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(target) as
			{ id: number; username: string } | undefined;
		return { user };
	}

	if (typeof target === 'string' && /^\d+$/.test(target)) {
		const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(Number(target)) as
			{ id: number; username: string } | undefined;
		if (user) return { user };
	}

	if (typeof target !== 'string' || target.trim().length === 0) return {};

	const resolution = resolvePublicUser(target);
	if (resolution.ambiguous) return { ambiguous: true };
	if (!resolution.user) return {};

	const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(resolution.user.id) as
		{ id: number; username: string } | undefined;
	return { user };
}

export async function PUT({ request, cookies }) {
	try {
		const admin = getAdminUser(cookies.get('session'));
		if (!admin) return json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });

		const body = await request.json().catch(() => null);
		const targetUserId = body?.targetUserId;
		const newCredits = body?.newCredits;

		if (!targetUserId || newCredits === undefined) {
			return json({ error: 'Missing parameters.' }, { status: 400 });
		}

		const credits = Number(newCredits);
		if (!Number.isInteger(credits) || credits < 0 || credits > 1_000_000_000) {
			return json({ error: 'Credits must be a non-negative integer.' }, { status: 400 });
		}

		const target = findTarget(targetUserId);
		if (target.ambiguous)
			return json(
				{ error: 'Multiple citizens share that username. Use the Citizen ID.' },
				{ status: 409 }
			);
		if (!target.user)
			return json({ error: 'Target citizen not found in registry.' }, { status: 404 });

		db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(credits, target.user.id);
		return json({
			success: true,
			message: `Credits for ${target.user.username} updated to ${credits}.`
		});
	} catch (error: any) {
		console.error('Admin user PUT error:', error);
		return json({ error: 'Internal system error' }, { status: 500 });
	}
}

export async function POST({ request, cookies }) {
	try {
		const admin = getAdminUser(cookies.get('session'));
		if (!admin) return json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });

		const body = await request.json().catch(() => null);
		const { targetUserId, action, cosmeticId } = body || {};

		if (!targetUserId || !action) return json({ error: 'Missing parameters.' }, { status: 400 });

		const target = findTarget(targetUserId);
		if (target.ambiguous)
			return json(
				{ error: 'Multiple citizens share that username. Use the Citizen ID.' },
				{ status: 409 }
			);
		if (!target.user)
			return json({ error: 'Target citizen not found in registry.' }, { status: 404 });

		if (action === 'GRANT_COSMETIC') {
			const cosmetic = Number(cosmeticId);
			if (!Number.isInteger(cosmetic) || cosmetic <= 0) {
				return json({ error: 'Missing cosmeticId.' }, { status: 400 });
			}
			if (!db.prepare('SELECT 1 FROM cosmetics WHERE id = ?').get(cosmetic)) {
				return json({ error: 'Cosmetic not found.' }, { status: 404 });
			}
			try {
				db.prepare(
					'INSERT INTO user_cosmetics (userId, cosmeticId, equipped) VALUES (?, ?, 0)'
				).run(target.user.id, cosmetic);
				return json({ success: true, message: `Cosmetic granted to ${target.user.username}.` });
			} catch (e: any) {
				if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
					return json({ error: 'User already owns this cosmetic.' }, { status: 400 });
				}
				throw e;
			}
		}

		return json({ error: 'Invalid action.' }, { status: 400 });
	} catch (error: any) {
		console.error('Admin user POST error:', error);
		return json({ error: 'Internal system error' }, { status: 500 });
	}
}

export async function DELETE({ request, cookies }) {
	try {
		const admin = getAdminUser(cookies.get('session'));
		if (!admin) return json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });

		const body = await request.json().catch(() => null);
		const { targetUserId, action, cosmeticId } = body || {};

		if (!targetUserId || !action) return json({ error: 'Missing parameters.' }, { status: 400 });

		const target = findTarget(targetUserId);
		if (target.ambiguous)
			return json(
				{ error: 'Multiple citizens share that username. Use the Citizen ID.' },
				{ status: 409 }
			);
		if (!target.user)
			return json({ error: 'Target citizen not found in registry.' }, { status: 404 });

		const resolvedUserId = target.user.id;
		const targetUsername = target.user.username;

		if (resolvedUserId === admin.id && action === 'ERASE_ACCOUNT') {
			return json({ error: 'You cannot erase your own admin account.' }, { status: 400 });
		}

		if (action === 'ERASE_DATA') {
			db.prepare('DELETE FROM userStats WHERE userId = ?').run(resolvedUserId);
			return json({
				success: true,
				message: `All telemetry data for ${targetUsername} has been erased.`
			});
		}

		if (action === 'ERASE_ACCOUNT') {
			db.transaction(() => {
				// Tables whose foreign keys do not cascade must be removed first.
				db.prepare(
					`
                    DELETE FROM group_requests
                    WHERE userId = ? OR senderId = ?
                       OR groupId IN (SELECT id FROM chat_groups WHERE inspectorId = ?)
                `
				).run(resolvedUserId, resolvedUserId, resolvedUserId);
				// Every other child table uses ON DELETE CASCADE with foreign_keys=ON.
				db.prepare('DELETE FROM users WHERE id = ?').run(resolvedUserId);
			})();
			return json({
				success: true,
				message: `Citizen ${targetUsername} has been completely erased from the Sibyl System.`
			});
		}

		if (action === 'TOGGLE_PRIVACY') {
			const currentPrivacy = (
				db.prepare('SELECT privacy FROM users WHERE id = ?').get(resolvedUserId) as any
			)?.privacy;
			const newPrivacy = currentPrivacy === 'PRIVATE' ? 'PUBLIC' : 'PRIVATE';
			db.prepare('UPDATE users SET privacy = ? WHERE id = ?').run(newPrivacy, resolvedUserId);
			return json({
				success: true,
				message: `Privacy for ${targetUsername} has been toggled to ${newPrivacy}.`
			});
		}

		if (action === 'REVOKE_COSMETIC') {
			const cosmetic = Number(cosmeticId);
			if (!Number.isInteger(cosmetic) || cosmetic <= 0) {
				return json({ error: 'Missing cosmeticId.' }, { status: 400 });
			}
			db.prepare('DELETE FROM user_cosmetics WHERE userId = ? AND cosmeticId = ?').run(
				resolvedUserId,
				cosmetic
			);
			return json({ success: true, message: `Cosmetic revoked from ${targetUsername}.` });
		}

		return json({ error: 'Invalid action.' }, { status: 400 });
	} catch (error: any) {
		console.error('Admin user management error:', error);
		return json({ error: 'Internal system error' }, { status: 500 });
	}
}
