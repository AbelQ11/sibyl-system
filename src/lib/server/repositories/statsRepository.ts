import { db } from '../db/connection';

export function getLatestCC(userId: number): number {
	const stats = db
		.prepare(
			`
        SELECT cc FROM userStats 
        WHERE userId = ? 
        ORDER BY id DESC LIMIT 1
    `
		)
		.get(userId) as { cc: number } | undefined;

	return stats ? stats.cc : 0;
}

export function insertCC(userId: number, cc: number, type: string): void {
	// Never trust a client- or model-supplied coefficient. Values outside
	// the in-universe 0–500 range can otherwise bypass censorship/group rules.
	const numeric = typeof cc === 'number' ? cc : Number(cc);
	const safeCC = Number.isFinite(numeric) ? Math.min(500, Math.max(0, Math.round(numeric))) : 0;
	db.prepare('INSERT INTO userStats (userId, cc, type) VALUES (?, ?, ?)').run(userId, safeCC, type);
}
