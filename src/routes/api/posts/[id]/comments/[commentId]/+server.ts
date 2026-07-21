import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Deletes a comment on a feed post.
 * Allowed for the original author or an Administrator.
 */
export const DELETE: RequestHandler = async ({ params, cookies }) => {
    const user = getAuthUser(cookies.get('session')) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const commentId = params.commentId;
        const comment = db.prepare('SELECT authorId FROM post_comments WHERE id = ?').get(commentId) as { authorId: number } | undefined;
        
        if (!comment) return json({ error: 'Comment not found' }, { status: 404 });
        
        if (comment.authorId !== user.id && user.role !== 'ADMIN') {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        db.prepare('DELETE FROM post_comments WHERE id = ?').run(commentId);
        return json({ success: true });
    } catch (e: any) {
        console.error('Delete comment error:', e);
        return json({ error: 'Server error' }, { status: 500 });
    }
};
