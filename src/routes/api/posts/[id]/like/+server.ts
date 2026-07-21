import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, cookies }) => {
    try {
        const user = getAuthUser(cookies.get('session'));
        if (!user) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const postId = parseInt(params.id);
        if (isNaN(postId)) {
            return json({ error: 'Invalid post ID' }, { status: 400 });
        }

        const existingLike = db.prepare(`SELECT id FROM post_likes WHERE postId = ? AND userId = ?`).get(postId, user.id);

        let isLikedByMe = false;
        if (existingLike) {
            db.prepare(`DELETE FROM post_likes WHERE id = ?`).run((existingLike as any).id);
        } else {
            db.prepare(`INSERT INTO post_likes (postId, userId) VALUES (?, ?)`).run(postId, user.id);
            isLikedByMe = true;
        }

        const newLikeCountResult = db.prepare(`SELECT COUNT(*) as count FROM post_likes WHERE postId = ?`).get(postId);
        const newLikeCount = (newLikeCountResult as any).count;

        return json({ success: true, isLikedByMe, likeCount: newLikeCount });
    } catch (e) {
        console.error('Failed to toggle like', e);
        return json({ error: 'Failed to toggle like' }, { status: 500 });
    }
};
