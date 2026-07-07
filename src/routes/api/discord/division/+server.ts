import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as env_static from '$env/static/private';

export async function GET({ url, request }) {
    const authHeader = request.headers.get('Authorization');
    const botSecret = (env_static as any).SIB_BOT_SECRET;
    if (!botSecret || authHeader !== `Bearer ${botSecret}`) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = url.searchParams.get('query');
    if (!query) return json({ error: 'Missing division query' }, { status: 400 });

    const groupName = query.replace('Division: ', '').trim();

    const group = db.prepare('SELECT id, name, maxCC FROM chat_groups WHERE name COLLATE NOCASE = ?').get(groupName) as any;
    if (!group) return json({ error: 'NOT_FOUND', message: 'Division not found.' }, { status: 404 });

    const memberCountRow = db.prepare('SELECT COUNT(*) as count FROM chat_group_members WHERE groupId = ?').get(group.id) as any;
    const memberCount = memberCountRow ? memberCountRow.count : 0;

    const memberIds = db.prepare('SELECT userId FROM chat_group_members WHERE groupId = ?').all(group.id) as { userId: number }[];
    let totalCC = 0;
    let counted = 0;
    for (const m of memberIds) {
        const stats = db.prepare('SELECT cc FROM userStats WHERE userId = ? ORDER BY created_at DESC LIMIT 1').get(m.userId) as any;
        if (stats) {
            totalCC += stats.cc;
            counted++;
        }
    }
    const averageCC = counted > 0 ? Math.round(totalCC / counted) : 0;

    return json({
        success: true,
        name: group.name,
        maxCC: group.maxCC,
        memberCount,
        averageCC
    });
}
