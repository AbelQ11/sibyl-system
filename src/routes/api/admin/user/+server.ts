import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

/**
 * All admin/user management routes.
 * Admin identity is now verified via session cookie + role check,
 * not by comparing a body-supplied username to an env var.
 */

function getAdminUser(token: string | undefined) {
    const user = getAuthUser(token);
    if (!user || user.role !== 'ADMIN') return null;
    return user;
}

export async function PUT({ request, cookies }) {
    try {
        const admin = getAdminUser(cookies.get('session'));
        if (!admin) return json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });

        const { targetUserId, newCredits } = await request.json();

        if (!targetUserId || newCredits === undefined) {
            return json({ error: 'Missing parameters.' }, { status: 400 });
        }

        const targetUserRow = db.prepare('SELECT id, username FROM users WHERE username = ? OR id = ?').get(targetUserId, targetUserId) as { id: number; username: string } | undefined;
        if (!targetUserRow) return json({ error: 'Target citizen not found in registry.' }, { status: 404 });

        db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(Number(newCredits), targetUserRow.id);
        return json({ success: true, message: `Credits for ${targetUserRow.username} updated to ${newCredits}.` });

    } catch (error: any) {
        console.error("Admin user PUT error:", error);
        return json({ error: 'Internal system error' }, { status: 500 });
    }
}

export async function POST({ request, cookies }) {
    try {
        const admin = getAdminUser(cookies.get('session'));
        if (!admin) return json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });

        const { targetUserId, action, cosmeticId } = await request.json();

        if (!targetUserId || !action) return json({ error: 'Missing parameters.' }, { status: 400 });

        const targetUserRow = db.prepare('SELECT id, username FROM users WHERE username = ? OR id = ?').get(targetUserId, targetUserId) as { id: number; username: string } | undefined;
        if (!targetUserRow) return json({ error: 'Target citizen not found in registry.' }, { status: 404 });

        if (action === 'GRANT_COSMETIC') {
            if (!cosmeticId) return json({ error: 'Missing cosmeticId.' }, { status: 400 });
            try {
                db.prepare('INSERT INTO user_cosmetics (userId, cosmeticId, equipped) VALUES (?, ?, 0)').run(targetUserRow.id, cosmeticId);
                return json({ success: true, message: `Cosmetic granted to ${targetUserRow.username}.` });
            } catch (e: any) {
                if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    return json({ error: 'User already owns this cosmetic.' }, { status: 400 });
                }
                throw e;
            }
        }

        return json({ error: 'Invalid action.' }, { status: 400 });

    } catch (error: any) {
        console.error("Admin user POST error:", error);
        return json({ error: 'Internal system error' }, { status: 500 });
    }
}

export async function DELETE({ request, cookies }) {
    try {
        const admin = getAdminUser(cookies.get('session'));
        if (!admin) return json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });

        const body = await request.json();
        const { targetUserId, action, cosmeticId } = body;

        if (!targetUserId || !action) return json({ error: 'Missing parameters.' }, { status: 400 });

        const targetUserRow = db.prepare('SELECT id, username FROM users WHERE username = ? OR id = ?').get(targetUserId, targetUserId) as { id: number; username: string } | undefined;
        if (!targetUserRow) return json({ error: 'Target citizen not found in registry.' }, { status: 404 });

        if (action === 'ERASE_DATA') {
            db.prepare('DELETE FROM userStats WHERE userId = ?').run(targetUserRow.id);
            return json({ success: true, message: `All telemetry data for ${targetUserRow.username} has been erased.` });

        } else if (action === 'ERASE_ACCOUNT') {
            db.prepare('DELETE FROM userStats WHERE userId = ?').run(targetUserRow.id);
            db.prepare('DELETE FROM friendships WHERE user_id_1 = ? OR user_id_2 = ?').run(targetUserRow.id, targetUserRow.id);
            db.prepare('DELETE FROM users WHERE id = ?').run(targetUserRow.id);
            return json({ success: true, message: `Citizen ${targetUserRow.username} has been completely erased from the Sibyl System.` });

        } else if (action === 'TOGGLE_PRIVACY') {
            const currentPrivacy = (db.prepare('SELECT privacy FROM users WHERE id = ?').get(targetUserRow.id) as any)?.privacy;
            const newPrivacy = currentPrivacy === 'PRIVATE' ? 'PUBLIC' : 'PRIVATE';
            db.prepare('UPDATE users SET privacy = ? WHERE id = ?').run(newPrivacy, targetUserRow.id);
            return json({ success: true, message: `Privacy for ${targetUserRow.username} has been toggled to ${newPrivacy}.` });

        } else if (action === 'REVOKE_COSMETIC') {
            if (!cosmeticId) return json({ error: 'Missing cosmeticId.' }, { status: 400 });
            db.prepare('DELETE FROM user_cosmetics WHERE userId = ? AND cosmeticId = ?').run(targetUserRow.id, cosmeticId);
            return json({ success: true, message: `Cosmetic revoked from ${targetUserRow.username}.` });

        } else {
            return json({ error: 'Invalid action.' }, { status: 400 });
        }

    } catch (error: any) {
        console.error("Admin user management error:", error);
        return json({ error: 'Internal system error' }, { status: 500 });
    }
}
