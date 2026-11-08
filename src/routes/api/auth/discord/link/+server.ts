import crypto from 'crypto';
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export async function GET({ url, cookies }) {
	const clientId = env.DISCORD_CLIENT_ID;
	const origin = publicEnv.PUBLIC_ORIGIN || url.origin;
	const redirectUri = `${origin}/auth/callback/discord`;

	const state = crypto.randomBytes(24).toString('hex');
	cookies.set('discord_oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 10 * 60
	});

	if (!clientId) {
		throw redirect(
			302,
			`/auth/mock-discord?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
		);
	}

	const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify&state=${state}`;

	throw redirect(302, oauthUrl);
}
