import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as env_static from '$env/static/private';

export async function GET({ url, request, cookies }) {
    const query = url.searchParams.get('query');
    if (!query) {
        return json({ error: 'Missing citizen query identifier' }, { status: 400 });
    }

    const targetUser = db.prepare(
        'SELECT id, username, citizen_id, privacy, discord_id, role, discord_username, avatar FROM users WHERE username = ? OR citizen_id = ?'
    ).get(query, query) as { id: number, username: string, citizen_id: string, privacy: string, discord_id: string | null, role: string, discord_username: string | null, avatar: string | null } | undefined;

    if (!targetUser) {
        return json({ error: 'Citizen not found in database registry' }, { status: 404 });
    }

    const stats = db.prepare('SELECT cc FROM userStats WHERE userId = ? ORDER BY created_at DESC LIMIT 1').get(targetUser.id) as { cc: number } | undefined;
    const cc = stats ? stats.cc : 0;

    const allStats = db.prepare('SELECT cc FROM userStats WHERE userId = ?').all(targetUser.id) as { cc: number }[];
    const averageCC = allStats.length > 0
        ? Math.round(allStats.reduce((sum, item) => sum + item.cc, 0) / allStats.length)
        : cc;

    /**
     * Check authorization:
     * 1. Check if the request carries the shared SIB_BOT_SECRET token
     */
    const authHeader = request.headers.get('Authorization');
    const botSecret = (env_static as any).SIB_BOT_SECRET;
    const isAuthorizedBot = botSecret && authHeader === `Bearer ${botSecret}`;

    /** 2. Check if the requester is logged in as an administrator */
    const sessionId = cookies.get('session');
    let isAdmin = false;
    if (sessionId) {
        const requester = db.prepare('SELECT role FROM users WHERE id = ?').get(parseInt(sessionId)) as { role: string } | undefined;
        isAdmin = requester?.role === 'ADMIN';
    }

    /** 3. Check if the request is from Discord and triggered by a Discord user linked to a SIBYL Admin account */
    const requesterDiscordId = url.searchParams.get('requesterDiscordId');
    let requesterIsAdminOnDiscord = false;
    if (requesterDiscordId) {
        const adminProfiles = db.prepare("SELECT id FROM users WHERE discord_id = ? AND role = 'ADMIN'").all(requesterDiscordId);
        requesterIsAdminOnDiscord = adminProfiles.length > 0;
    }

    /** Evaluate privacy clearance */
    if (targetUser.privacy === 'PUBLIC' || isAdmin || (isAuthorizedBot && requesterIsAdminOnDiscord)) {
        let hue = 'Clear';
        let status = 'Optimal Citizen';
        if (cc > 300) {
            hue = 'Blackened';
            status = 'Lethal Eliminator Target';
        } else if (cc > 100) {
            hue = 'Clouded';
            status = 'Latent Criminal';
        }

        return json({
            success: true,
            username: targetUser.username,
            citizen_id: targetUser.citizen_id,
            discord_id: targetUser.discord_id,
            discord_username: targetUser.discord_username,
            avatar: targetUser.avatar,
            cc,
            average_cc: averageCC,
            hue,
            status,
            role: targetUser.role,
            privacy: targetUser.privacy
        });
    }

    return json({
        error: 'CLASSIFIED_RECORD',
        message: 'Access denied. Citizen psychological telemetry records are classified.',
        privacy: targetUser.privacy
    }, { status: 403 });
}
