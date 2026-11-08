import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

const MAX_AVATAR_BYTES = 1024 * 1024; // 1 MB decoded
const AVATAR_RE = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/;

function isValidImage(buffer: Buffer): boolean {
	if (buffer.length < 12) return false;
	// PNG
	if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)
		return true;
	// JPEG
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
	// WebP: RIFF....WEBP
	if (
		buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
		buffer.subarray(8, 12).toString('ascii') === 'WEBP'
	)
		return true;
	return false;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const user = getAuthUser(cookies.get('session'));
	if (!user) {
		return json(
			{ success: false, error: 'Unauthorized: Active session required.' },
			{ status: 401 }
		);
	}

	try {
		const { avatar } = await request.json();

		if (typeof avatar !== 'string' || !avatar.startsWith('data:')) {
			return json({ success: false, error: 'INVALID_AVATAR' }, { status: 400 });
		}

		const match = avatar.match(AVATAR_RE);
		if (!match) {
			return json({ success: false, error: 'INVALID_AVATAR_TYPE' }, { status: 400 });
		}

		const base64 = match[2].replace(/\s+/g, '');
		const buffer = Buffer.from(base64, 'base64');

		if (buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES || !isValidImage(buffer)) {
			return json({ success: false, error: 'INVALID_AVATAR_DATA' }, { status: 400 });
		}

		// Re-encode from the validated bytes so a forged data URI cannot smuggle
		// a different MIME type or extra payload into the database.
		const canonical = `data:${match[1]};base64,${buffer.toString('base64')}`;

		const result = db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(canonical, user.id);

		if (result.changes === 0) {
			return json({ success: false, error: 'Target user file node not located.' }, { status: 404 });
		}

		return json({ success: true });
	} catch (err: any) {
		console.error('CRITICAL DATABASE OPERATION FAULT:', err?.message || err);
		return json({ success: false, error: 'Internal Server Sync Failure' }, { status: 500 });
	}
};
