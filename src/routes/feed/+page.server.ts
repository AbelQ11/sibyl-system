import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { getLatestCC } from '$lib/server/repositories/statsRepository';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, fetch }) => {
    const user = getAuthUser(cookies.get('session'));
    if (!user) throw redirect(302, '/auth');

    const statsCheck = db.prepare(`SELECT id FROM userStats WHERE userId = ? LIMIT 1`).get(user.id);
    if (!statsCheck) {
        throw redirect(302, '/');
    }

    const cc = getLatestCC(user.id);

    const postsRes = await fetch('/api/posts');
    const posts = await postsRes.json();

    return {
        cc,
        posts: Array.isArray(posts) ? posts : []
    };
};
