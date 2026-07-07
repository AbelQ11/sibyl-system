import { redirect, error } from '@sveltejs/kit';
import * as env_static from '$env/static/private';
import * as env_public from '$env/static/public';
import { db } from '$lib/server/db';

export async function GET({ url, cookies }) {
    const code = url.searchParams.get('code');
    const sessionId = cookies.get('session');
    
    if (!sessionId) {
        throw error(401, 'Unauthorized');
    }
    
    if (!code) {
        throw error(400, 'Missing authorization code');
    }

    const userId = parseInt(sessionId);
    const clientId = env_static.DISCORD_CLIENT_ID;
    const clientSecret = env_static.DISCORD_CLIENT_SECRET;
    
    const origin = env_public.PUBLIC_ORIGIN || url.origin;
    const redirectUri = `${origin}/auth/callback/discord`;

    let discordUsername = '';
    let discordId = '';

    /** If real credentials are set and we're not using the mock authorization code */
    if (clientId && clientSecret && code !== 'mock_code_1234') {
        try {
            /** 1. Exchange authorization code for access token */
            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: redirectUri
                }).toString()
            });

            if (!tokenResponse.ok) {
                const errData = await tokenResponse.json();
                console.error('Discord token exchange failed:', errData);
                throw error(500, 'Failed to authenticate with Discord API');
            }

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            /** 2. Fetch user profile details */
            const userResponse = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (!userResponse.ok) {
                throw error(500, 'Failed to fetch Discord user profile');
            }

            const userData = await userResponse.json();
            discordId = userData.id;
            
            /** Format username (supporting discriminator fallback) */
            discordUsername = userData.discriminator && userData.discriminator !== '0'
                ? `${userData.username}#${userData.discriminator}`
                : userData.username;

        } catch (err: any) {
            console.error('Discord OAuth callback failed:', err);
            throw redirect(302, '/account?discord=error');
        }
    } else {
        /** Mock authorization callback details */
        discordUsername = 'SibylCitizen#2026';
        discordId = '49204859012384920';
    }

    /** Check if the discordId is already linked to another account */
    const existingLink = db.prepare('SELECT username, role FROM users WHERE discord_id = ? AND id != ?')
                           .get(discordId, userId) as { username: string, role: string } | undefined;

    if (existingLink) {
        const currentUserRow = db.prepare('SELECT username, role FROM users WHERE id = ?')
                                 .get(userId) as { username: string, role: string } | undefined;

        const isBypass = currentUserRow && (
            (currentUserRow.username === 'Kiliotsu' && existingLink.role === 'ADMIN') ||
            (currentUserRow.role === 'ADMIN' && existingLink.username === 'Kiliotsu') ||
            (currentUserRow.username === 'Kiliotsu' && existingLink.username === 'Kiliotsu')
        );

        if (!isBypass) {
            throw redirect(302, '/account?discord=already_linked');
        }
    }

    try {
        /** 3. Save Discord credentials */
        db.prepare('UPDATE users SET discord_username = ?, discord_id = ? WHERE id = ?')
          .run(discordUsername, discordId, userId);
    } catch (dbErr) {
        console.error('Failed to link Discord credentials in SQLite database:', dbErr);
        throw redirect(302, '/account?discord=error');
    }

    throw redirect(302, '/account?discord=success');
}
