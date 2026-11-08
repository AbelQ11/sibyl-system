import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { isAuthorizedBot } from '$lib/server/botAuth';

export async function GET({ url, request }) {
	if (!isAuthorizedBot(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const discordId = url.searchParams.get('discordId');
	if (!discordId) return json({ error: 'Missing discordId' }, { status: 400 });

	const user = db
		.prepare('SELECT id, username, citizen_id FROM users WHERE discord_id = ?')
		.get(discordId) as { id: number; username: string; citizen_id: string } | undefined;
	if (!user)
		return json(
			{ error: 'UNLINKED', message: 'Discord account is not linked to any SIBYL profile.' },
			{ status: 404 }
		);

	const history = db
		.prepare('SELECT cc, created_at FROM userStats WHERE userId = ? ORDER BY id DESC LIMIT 5')
		.all(user.id);

	return json({
		success: true,
		username: user.username,
		citizen_id: user.citizen_id,
		history
	});
}
