import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Deletes a public feed post.
 * Allowed for the original author or an Administrator.
 */
export const DELETE: RequestHandler = async ({ params, cookies }) => {
    const user = getAuthUser(cookies.get('session')) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const postId = params.id;
        const post = db.prepare('SELECT authorId FROM posts WHERE id = ?').get(postId) as { authorId: number } | undefined;
        
        if (!post) return json({ error: 'Post not found' }, { status: 404 });
        
        if (post.authorId !== user.id && user.role !== 'ADMIN') {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
        return json({ success: true });
    } catch (e: any) {
        console.error('Delete post error:', e);
        return json({ error: 'Server error' }, { status: 500 });
    }
};
