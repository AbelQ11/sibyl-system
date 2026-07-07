import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(sessionId) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { avatar, groupId } = await request.json();

        if (!groupId || !avatar) {
            return json({ error: 'Missing avatar or groupId' }, { status: 400 });
        }

        const group = db.prepare('SELECT inspectorId FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return json({ error: 'Division not found' }, { status: 404 });

        if (user.role !== 'ADMIN' && group.inspectorId !== user.id) {
            return json({ error: 'Only the Division Inspector can update the avatar' }, { status: 403 });
        }

        db.prepare('UPDATE chat_groups SET avatar = ? WHERE id = ?').run(avatar, groupId);

        return json({ success: true });
    } catch (e: any) {
        console.error('Group avatar update error:', e);
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};
