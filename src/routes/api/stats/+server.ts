import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export async function GET({ url }) {
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return json({ error: 'No User ID provided' }, { status: 400 });
    }

    try {
        const stats = await db.userStats.findUnique({
            where: { userId: userId }
        });

        if (!stats) {
            return json({ first_cc: 0, last_cc: 0 });
        }

        return json({
            first_cc: stats.first_cc,
            last_cc: stats.last_cc
        });
    } catch (error) {
        return json({ error: 'Database error' }, { status: 500 });
    }
}