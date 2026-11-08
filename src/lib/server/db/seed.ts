import { db } from './connection';
import bcrypt from 'bcryptjs';

/**
 * Seeds development-only test accounts.
 *
 * This is intentionally gated behind an explicit opt-in. Previously it ran
 * whenever NODE_ENV !== 'production', which created a known ADMIN/password
 * account on any server that forgot to set NODE_ENV (including production).
 */
export function runDevSeeds(): void {
	if (process.env.NODE_ENV === 'production') return;
	if (process.env.SEED_DEV_ACCOUNTS !== 'true') return;

	const ghostPassword = process.env.SEED_DEV_PASSWORD;
	if (!ghostPassword || ghostPassword.length < 16) {
		console.warn(
			'[SIBYL SEED] SEED_DEV_ACCOUNTS=true requires SEED_DEV_PASSWORD (16+ chars). Skipping.'
		);
		return;
	}

	try {
		const ghost = db.prepare("SELECT id FROM users WHERE username = 'Ghost'").get();
		if (!ghost) {
			const hash = bcrypt.hashSync(ghostPassword, 12);
			const insertGhost = db.prepare(
				"INSERT INTO users (username, password, role, credits) VALUES ('Ghost', ?, 'ADMIN', 999999)"
			);
			const info = insertGhost.run(hash);
			const ghostId = info.lastInsertRowid;

			// Give Ghost all cosmetics
			const allCosmetics = db.prepare('SELECT id FROM cosmetics').all() as { id: number }[];
			const stmt = db.prepare(
				'INSERT OR IGNORE INTO user_cosmetics (userId, cosmeticId) VALUES (?, ?)'
			);
			for (const c of allCosmetics) {
				stmt.run(ghostId, c.id);
			}
			console.log('[SIBYL SEED] Created Ghost test account because SEED_DEV_ACCOUNTS=true.');
		}
	} catch (e) {
		console.error('[SIBYL SEED] Failed to create Ghost account:', e);
	}
}
