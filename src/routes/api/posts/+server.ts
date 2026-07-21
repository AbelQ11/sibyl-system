import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { getLatestCC } from '$lib/server/repositories/statsRepository';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
    try {
        const user = getAuthUser(cookies.get('session'));
        const userId = user ? user.id : -1;

        const posts = db.prepare(`
            SELECT p.id, p.content, p.is_censored, p.created_at, p.image_url,
                   u.username, u.avatar, u.citizen_id, u.role,
                   (SELECT COUNT(*) FROM post_likes WHERE postId = p.id) as likeCount,
                   (SELECT COUNT(*) FROM post_comments WHERE postId = p.id) as commentCount,
                   EXISTS(SELECT 1 FROM post_likes WHERE postId = p.id AND userId = ?) as isLikedByMe
            FROM posts p
            JOIN users u ON p.authorId = u.id
            ORDER BY p.created_at DESC
            LIMIT 50
        `).all(userId);

        return json(posts.map(p => ({
            ...p,
            isLikedByMe: Boolean(p.isLikedByMe)
        })));
    } catch (e) {
        console.error('Failed to get posts', e);
        return json({ error: 'Failed to fetch posts' }, { status: 500 });
    }
};

const STRESS_WORDS = [
    'hate', 'kill', 'stress', 'pain', 'die', 'murder', 'blood', 
    'angry', 'rage', 'fuck', 'shit', 'bitch', 'ass', 'death', 'suffer', 'destroy'
];

function censorText(text: string): { censored: string; wasCensored: boolean } {
    let wasCensored = false;
    let words = text.split(/\b/);
    
    for (let i = 0; i < words.length; i++) {
        if (words[i].trim() === '') continue;
        
        const lower = words[i].toLowerCase();
        if (STRESS_WORDS.includes(lower)) {
            words[i] = '████';
            wasCensored = true;
        } else if (Math.random() < 0.15) { 
            /** Random redaction (15% chance per word) to simulate mental clouding */
            /** only applied if their CC is between 100-300 */
            words[i] = '████';
            wasCensored = true;
        }
    }
    
    return { censored: words.join(''), wasCensored };
}

export const POST: RequestHandler = async ({ request, cookies }) => {
    const user = getAuthUser(cookies.get('session'));
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || !body.content || typeof body.content !== 'string') {
        return json({ error: 'Invalid content' }, { status: 400 });
    }
    
    const content = body.content.trim();
    if (content.length === 0 || content.length > 500) {
        return json({ error: 'Content must be between 1 and 500 characters' }, { status: 400 });
    }

    let imageUrl = null;
    if (body.image_url) {
        if (typeof body.image_url !== 'string') {
            return json({ error: 'Invalid image data' }, { status: 400 });
        }
        if (body.image_url.length > 5000000) { /** ~5MB base64 limit */
            return json({ error: 'Image exceeds 4MB limit' }, { status: 400 });
        }
        imageUrl = body.image_url;
    }

    try {
        const cc = getLatestCC(user.id);
        
        let finalContent = content;
        let isCensored = 0;

        if (user.role !== 'ADMIN') {
            if (cc > 300) {
                return json({ error: 'ENFORCEMENT ACTION REQUIRED. POSTING PRIVILEGES REVOKED.' }, { status: 403 });
            }

            if (cc >= 100) {
                const result = censorText(content);
                finalContent = result.censored;
                isCensored = result.wasCensored ? 1 : 0;
            }
        }

        const stmt = db.prepare(`
            INSERT INTO posts (authorId, content, original_content, is_censored, image_url)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        const info = stmt.run(user.id, finalContent, content, isCensored, imageUrl);

        const newPost = db.prepare(`
            SELECT p.id, p.content, p.is_censored, p.created_at, p.image_url,
                   u.username, u.avatar, u.citizen_id, u.role,
                   0 as likeCount,
                   0 as commentCount,
                   0 as isLikedByMe
            FROM posts p
            JOIN users u ON p.authorId = u.id
            WHERE p.id = ?
        `).get(info.lastInsertRowid);

        return json({ ...newPost, isLikedByMe: false });
    } catch (e) {
        console.error('Failed to create post', e);
        return json({ error: 'Failed to create post' }, { status: 500 });
    }
};
