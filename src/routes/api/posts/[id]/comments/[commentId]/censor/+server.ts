import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Censors a comment on a feed post.
 * Only administrators can perform this action.
 */
export const POST: RequestHandler = async ({ params, cookies }) => {
    const user = getAuthUser(cookies.get('session')) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        if (user.role !== 'ADMIN') {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        const commentId = params.commentId;
        const comment = db.prepare('SELECT id, content FROM post_comments WHERE id = ?').get(commentId) as any;
        
        if (!comment) return json({ error: 'Comment not found' }, { status: 404 });

        const words = comment.content.split(/\b/);
        for (let i = 0; i < words.length; i++) {
            if (words[i].trim() !== '' && Math.random() < 0.5) {
                words[i] = '████';
            }
        }
        const redactedText = words.join('');

        db.prepare('UPDATE post_comments SET content = ?, is_censored = 1 WHERE id = ?').run(redactedText, commentId);
        
        return json({ success: true, redactedText });
    } catch (e: any) {
        console.error('Censor comment error:', e);
        return json({ error: 'Server error' }, { status: 500 });
    }
};
