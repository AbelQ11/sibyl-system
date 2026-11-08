import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { isAuthorizedBot } from '$lib/server/botAuth';

export async function GET({ request }) {
	if (!isAuthorizedBot(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const rows = db.prepare('SELECT cc FROM userStats').all() as { cc: number }[];
	const totalCC = rows.reduce((sum, item) => sum + item.cc, 0);
	const averageCC = rows.length > 0 ? Math.round(totalCC / rows.length) : 0;

	let threatLevel = 'Optimal';
	if (averageCC > 300) threatLevel = 'Critical';
	else if (averageCC > 100) threatLevel = 'Warning';

	const countRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

	return json({
		success: true,
		average_cc: averageCC,
		threat_level: threatLevel,
		citizen_count: countRow ? countRow.count : 0
	});
}
