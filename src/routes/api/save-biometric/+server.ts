import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { insertCC } from '$lib/server/repositories/statsRepository';

export async function POST({ request, cookies }) {
    const user = getAuthUser(cookies.get('session'));
    if (!user) {
        return json({ error: 'Unauthorized: Active session required.' }, { status: 401 });
    }

    try {
        const { cc } = await request.json();

        insertCC(user.id, cc, 'biometric');



        return json({ success: true });
    } catch (err: any) {
        console.error('Failed to save biometric scan CC:', err.message);
        return json({ error: 'Database tracking failure' }, { status: 500 });
    }
}
