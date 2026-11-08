import crypto from 'crypto';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { sendMail } from './mail';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
	return crypto.createHash('sha256').update(token).digest('hex');
}

export async function issueEmailVerification(
	userId: number,
	email: string,
	fallbackOrigin: string
): Promise<boolean> {
	const token = crypto.randomBytes(32).toString('hex');
	const tokenHash = hashToken(token);
	const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

	db.transaction(() => {
		db.prepare('DELETE FROM email_verification_tokens WHERE userId = ? AND used_at IS NULL').run(
			userId
		);
		db.prepare(
			`
            INSERT INTO email_verification_tokens (userId, email, token_hash, expires_at)
            VALUES (?, ?, ?, ?)
        `
		).run(userId, email, tokenHash, expiresAt);
	})();

	const base = (env.PUBLIC_ORIGIN || fallbackOrigin || '').replace(/\/$/, '');
	const link = `${base}/auth/verify-email?token=${encodeURIComponent(token)}`;

	try {
		await sendMail({
			to: email,
			subject: 'SIBYL SYSTEM // verify your citizen email',
			text: [
				'A request was made to verify this email address for the SIBYL SYSTEM.',
				'',
				`Open this link within 24 hours to verify your email:`,
				link,
				'',
				'If you did not create this account, you can ignore this message.',
				'SIBYL SYSTEM // Core Compliance Network Node'
			].join('\n'),
			html: `
                <div style="font-family:monospace;background:#050505;color:#00ffcc;padding:24px;border:1px solid #00ffcc">
                    <h2 style="margin-top:0">SIBYL SYSTEM // EMAIL VERIFICATION</h2>
                    <p>A request was made to verify this email address for the SIBYL SYSTEM.</p>
                    <p><a href="${link}" style="color:#00ffcc">VERIFY EMAIL ADDRESS</a></p>
                    <p style="color:#888">This link expires in 24 hours and can only be used once.</p>
                    <p style="color:#888">If you did not create this account, ignore this message.</p>
                </div>
            `
		});
		return true;
	} catch (e) {
		console.error('[SIBYL MAIL] Failed to send verification email:', e);
		return false;
	}
}

export function consumeEmailVerificationToken(token: string): { ok: boolean; userId?: number } {
	if (!token || typeof token !== 'string') return { ok: false };

	const tokenHash = hashToken(token);
	const row = db
		.prepare(
			`
        SELECT id, userId, email
        FROM email_verification_tokens
        WHERE token_hash = ?
          AND used_at IS NULL
          AND julianday(expires_at) > julianday('now')
        LIMIT 1
    `
		)
		.get(tokenHash) as { id: number; userId: number; email: string } | undefined;

	if (!row) return { ok: false };

	const result = db.transaction(() => {
		const updated = db
			.prepare(
				`
            UPDATE users SET email_verified = 1
            WHERE id = ? AND lower(email) = lower(?)
        `
			)
			.run(row.userId, row.email);

		if (updated.changes === 0) return false;

		db.prepare('UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(
			row.id
		);
		db.prepare('DELETE FROM email_verification_tokens WHERE userId = ? AND used_at IS NULL').run(
			row.userId
		);
		return true;
	})();

	return result ? { ok: true, userId: row.userId } : { ok: false };
}

export function resetEmailVerification(userId: number): void {
	db.transaction(() => {
		db.prepare('DELETE FROM email_verification_tokens WHERE userId = ?').run(userId);
		db.prepare('UPDATE users SET email_verified = 0 WHERE id = ?').run(userId);
	})();
}
