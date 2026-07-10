import { redirect } from '@sveltejs/kit';
import * as env_static from '$env/static/private';
import * as env_public from '$env/static/public';

export async function GET({ url }) {
    const clientId = env_static.DISCORD_CLIENT_ID;
    const origin = env_public.PUBLIC_ORIGIN || url.origin;
    const redirectUri = `${origin}/auth/callback/discord`;
    

    if (!clientId) {
        throw redirect(302, `/auth/mock-discord?redirect_uri=${encodeURIComponent(redirectUri)}`);
    }

    const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify`;
    
    throw redirect(302, oauthUrl);
}
