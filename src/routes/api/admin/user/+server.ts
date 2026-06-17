import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { env } from '$env/dynamic/private';

export async function DELETE({ request }) {
    try {
        const body = await request.json();
        const { adminId, targetUserId, action } = body;
        
        const adminAccountId = env.ADMIN_ACCOUNT_ID || 'Makishimadmin';

        if (adminId !== adminAccountId) {
            return json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
        }

        if (!targetUserId || !action) {
            return json({ error: 'Missing parameters.' }, { status: 400 });
        }

        const targetUserRow = db.prepare('SELECT id, username FROM users WHERE username = ? OR id = ?').get(targetUserId, targetUserId) as { id: number, username: string } | undefined;

        if (!targetUserRow) {
            return json({ error: 'Target citizen not found in registry.' }, { status: 404 });
        }

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
            
        } else {
            return json({ error: 'Invalid action.' }, { status: 400 });
        }

    } catch (error: any) {
        console.error("Admin user management error:", error);
        return json({ error: 'Internal system error' }, { status: 500 });
    }
}
