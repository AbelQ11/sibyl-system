import { db } from '$lib/server/db';
import { resolvePublicUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const EMPTY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

const SAFE_HEADERS = {
	'X-Content-Type-Options': 'nosniff',
	'Content-Security-Policy': "default-src 'none'; sandbox",
	'Cache-Control': 'public, max-age=86400'
};

function decodeAvatar(dataUrl: string): { mime: string; buffer: Buffer } | null {
	const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/);
	if (!match) return null;
	const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
	if (buffer.length === 0) return null;

	// Never trust the declared MIME: verify the actual file signature.
	if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
		return { mime: 'image/png', buffer };
	}
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
		return { mime: 'image/jpeg', buffer };
	}
	if (
		buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
		buffer.subarray(8, 12).toString('ascii') === 'WEBP'
	) {
		return { mime: 'image/webp', buffer };
	}
	return null;
}

export const GET: RequestHandler = async ({ params }) => {
	const identifier = params.username;
	if (!identifier)
		return new Response(new Uint8Array(EMPTY_PNG), {
			status: 404,
			headers: { ...SAFE_HEADERS, 'Content-Type': 'image/png' }
		});

	const resolution = resolvePublicUser(identifier);
	if (!resolution.user) {
		return new Response(new Uint8Array(EMPTY_PNG), {
			status: 404,
			headers: { ...SAFE_HEADERS, 'Content-Type': 'image/png' }
		});
	}

	const user = db.prepare('SELECT avatar FROM users WHERE id = ?').get(resolution.user.id) as
		{ avatar: string | null } | undefined;
	const decoded = user?.avatar ? decodeAvatar(user.avatar) : null;

	if (!decoded) {
		return new Response(new Uint8Array(EMPTY_PNG), {
			status: 404,
			headers: { ...SAFE_HEADERS, 'Content-Type': 'image/png' }
		});
	}

	return new Response(new Uint8Array(decoded.buffer), {
		headers: {
			...SAFE_HEADERS,
			'Content-Type': decoded.mime,
			'Content-Disposition': 'inline; filename="avatar"'
		}
	});
};
