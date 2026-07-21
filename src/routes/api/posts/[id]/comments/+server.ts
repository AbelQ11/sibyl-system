import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { getLatestCC } from '$lib/server/repositories/statsRepository';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
    try {
        const postId = parseInt(params.id);
        if (isNaN(postId)) return json({ error: 'Invalid post ID' }, { status: 400 });

        const comments = db.prepare(`
            SELECT c.id, c.content, c.is_censored, c.created_at, 
                   u.username, u.avatar, u.citizen_id, u.role
            FROM post_comments c
            JOIN users u ON c.authorId = u.id
            WHERE c.postId = ?
            ORDER BY c.created_at ASC
        `).all(postId);

        return json(comments);
    } catch (e) {
        console.error('Failed to get comments', e);
        return json({ error: 'Failed to fetch comments' }, { status: 500 });
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
            words[i] = '████';
            wasCensored = true;
        }
    }
    
    return { censored: words.join(''), wasCensored };
}

export const POST: RequestHandler = async ({ request, cookies, params }) => {
    const user = getAuthUser(cookies.get('session'));
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const postId = parseInt(params.id);
    if (isNaN(postId)) return json({ error: 'Invalid post ID' }, { status: 400 });

    const body = await request.json().catch(() => null);
    if (!body || !body.content || typeof body.content !== 'string') {
        return json({ error: 'Invalid content' }, { status: 400 });
    }
    
    const content = body.content.trim();
    if (content.length === 0 || content.length > 500) {
        return json({ error: 'Content must be between 1 and 500 characters' }, { status: 400 });
    }

    try {
        const postExists = db.prepare(`SELECT id FROM posts WHERE id = ?`).get(postId);
        if (!postExists) return json({ error: 'Post not found' }, { status: 404 });

        const cc = getLatestCC(user.id);
        
        if (cc > 300) {
            return json({ error: 'ENFORCEMENT ACTION REQUIRED. COMMENTING PRIVILEGES REVOKED.' }, { status: 403 });
        }

        let finalContent = content;
        let isCensored = 0;

        if (cc >= 100) {
            const result = censorText(content);
            finalContent = result.censored;
            isCensored = result.wasCensored ? 1 : 0;
        }

        const stmt = db.prepare(`
            INSERT INTO post_comments (postId, authorId, content, original_content, is_censored)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        const info = stmt.run(postId, user.id, finalContent, content, isCensored);

        const newComment = db.prepare(`
            SELECT c.id, c.content, c.is_censored, c.created_at, 
                   u.username, u.avatar, u.citizen_id, u.role
            FROM post_comments c
            JOIN users u ON c.authorId = u.id
            WHERE c.id = ?
        `).get(info.lastInsertRowid);

        return json(newComment);
    } catch (e) {
        console.error('Failed to create comment', e);
        return json({ error: 'Failed to create comment' }, { status: 500 });
    }
};
