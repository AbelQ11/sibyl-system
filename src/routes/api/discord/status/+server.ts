import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as env_static from '$env/static/private';

export async function GET({ request }) {
    const authHeader = request.headers.get('Authorization');
    const botSecret = (env_static as any).SIB_BOT_SECRET;
    if (!botSecret || authHeader !== `Bearer ${botSecret}`) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = db.prepare('SELECT cc FROM userStats').all() as { cc: number }[];
    const totalCC = rows.reduce((sum, item) => sum + item.cc, 0);
    const averageCC = rows.length > 0 ? Math.round(totalCC / rows.length) : 0;

    let threatLevel = 'Optimal';
    if (averageCC > 300) threatLevel = 'Critical';
    else if (averageCC > 100) threatLevel = 'Warning';

    const countRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

    return json({
        success: true,
        average_cc: averageCC,
        threat_level: threatLevel,
        citizen_count: countRow ? countRow.count : 0
    });
}
