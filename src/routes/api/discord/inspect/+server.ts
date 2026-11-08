import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser, resolvePublicUser } from '$lib/server/auth';
import { isAuthorizedBot } from '$lib/server/botAuth';

export async function GET({ url, request, cookies }) {
	const query = url.searchParams.get('query');
	if (!query) {
		return json({ error: 'Missing citizen query identifier' }, { status: 400 });
	}

	const resolution = resolvePublicUser(query);

	if (resolution.ambiguous) {
		return json(
			{
				error: 'AMBIGUOUS_USERNAME',
				message: 'Several citizens share this username. Query by Citizen ID (SIB-XXXXXXXX).',
				matches: resolution.matches?.map((m) => ({
					username: m.username,
					citizen_id: m.citizen_id
				}))
			},
			{ status: 409 }
		);
	}

	const matched = resolution.user;
	if (!matched) {
		return json({ error: 'Citizen not found in database registry' }, { status: 404 });
	}

	const targetUser = db
		.prepare(
			`
        SELECT id, username, citizen_id, privacy, role, discord_username, avatar
        FROM users WHERE id = ?
    `
		)
		.get(matched.id) as
		| {
				id: number;
				username: string;
				citizen_id: string;
				privacy: string;
				role: string;
				discord_username: string | null;
				avatar: string | null;
		  }
		| undefined;

	if (!targetUser) {
		return json({ error: 'Citizen not found in database registry' }, { status: 404 });
	}

	const stats = db
		.prepare('SELECT cc FROM userStats WHERE userId = ? ORDER BY id DESC LIMIT 1')
		.get(targetUser.id) as { cc: number } | undefined;
	const cc = stats ? stats.cc : 0;

	const allStats = db.prepare('SELECT cc FROM userStats WHERE userId = ?').all(targetUser.id) as {
		cc: number;
	}[];
	const averageCC =
		allStats.length > 0
			? Math.round(allStats.reduce((sum, item) => sum + item.cc, 0) / allStats.length)
			: cc;

	const isAuthorizedBotRequest = isAuthorizedBot(request);

	const user = getAuthUser(cookies.get('session'));
	const isAdmin = Boolean(user && user.role === 'ADMIN');

	const requesterDiscordId = url.searchParams.get('requesterDiscordId');
	let requesterIsAdminOnDiscord = false;
	if (requesterDiscordId) {
		const adminProfile = db
			.prepare("SELECT id FROM users WHERE discord_id = ? AND role = 'ADMIN' LIMIT 1")
			.get(requesterDiscordId);
		requesterIsAdminOnDiscord = Boolean(adminProfile);
	}

	if (
		targetUser.privacy === 'PUBLIC' ||
		isAdmin ||
		(isAuthorizedBotRequest && requesterIsAdminOnDiscord)
	) {
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

	return json(
		{
			error: 'CLASSIFIED_RECORD',
			message: 'Access denied. Citizen psychological telemetry records are classified.',
			privacy: targetUser.privacy
		},
		{ status: 403 }
	);
}
