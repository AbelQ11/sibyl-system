import { redirect, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

export async function GET({ url, cookies }) {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expectedState = cookies.get('discord_oauth_state');

	cookies.delete('discord_oauth_state', { path: '/' });

	const user = getAuthUser(cookies.get('session'));
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	if (!code) {
		throw error(400, 'Missing authorization code');
	}

	if (!state || !expectedState || state !== expectedState) {
		throw redirect(302, '/account?discord=error');
	}

	const userId = user.id;
	const clientId = env.DISCORD_CLIENT_ID;
	const clientSecret = env.DISCORD_CLIENT_SECRET;

	const origin = publicEnv.PUBLIC_ORIGIN || url.origin;
	const redirectUri = `${origin}/auth/callback/discord`;

	let discordUsername = '';
	let discordId = '';

	const mockAllowed = !clientId && !clientSecret && process.env.NODE_ENV !== 'production';

	if (clientId && clientSecret) {
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
				const errData = await tokenResponse.json().catch(() => null);
				console.error('Discord token exchange failed:', errData);
				throw redirect(302, '/account?discord=error');
			}

			const tokenData = await tokenResponse.json();
			const accessToken = tokenData.access_token;

			/** 2. Fetch user profile details */
			const userResponse = await fetch('https://discord.com/api/users/@me', {
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (!userResponse.ok) {
				throw redirect(302, '/account?discord=error');
			}

			const userData = await userResponse.json();
			discordId = userData.id;

			discordUsername =
				userData.discriminator && userData.discriminator !== '0'
					? `${userData.username}#${userData.discriminator}`
					: userData.username;
		} catch (err: any) {
			console.error('Discord OAuth callback failed:', err);
			throw redirect(302, '/account?discord=error');
		}
	} else if (mockAllowed && code === 'mock_code_1234') {
		discordUsername = 'SibylCitizen#2026';
		discordId = '49204859012384920';
	} else {
		throw redirect(302, '/account?discord=error');
	}

	/** A Discord account can only be linked to one citizen. */
	const existingLink = db
		.prepare('SELECT username FROM users WHERE discord_id = ? AND id != ?')
		.get(discordId, userId) as { username: string } | undefined;

	if (existingLink) {
		throw redirect(302, '/account?discord=already_linked');
	}

	try {
		db.prepare(
			`
            UPDATE users 
            SET credits = CASE WHEN discord_id IS NULL THEN credits + 50 ELSE credits END,
                discord_username = ?, 
                discord_id = ? 
            WHERE id = ?
        `
		).run(discordUsername, discordId, userId);
	} catch (dbErr) {
		console.error('Failed to link Discord credentials in SQLite database:', dbErr);
		throw redirect(302, '/account?discord=error');
	}

	throw redirect(302, '/account?discord=success');
}
