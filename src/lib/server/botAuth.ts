import crypto from 'crypto';
import { env } from '$env/dynamic/private';

export function isAuthorizedBot(request: Request): boolean {
	const secret = env.SIB_BOT_SECRET;
	const header = request.headers.get('Authorization') || '';
	if (!secret) return false;

	const expected = Buffer.from(`Bearer ${secret}`);
	const actual = Buffer.from(header);
	if (expected.length !== actual.length) return false;
	return crypto.timingSafeEqual(expected, actual);
}
