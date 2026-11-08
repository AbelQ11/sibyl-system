import 'dotenv/config';
import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';

const CSP_PROD = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' https://cloud.umami.is",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https:",
	"media-src 'self' data: blob:",
	"connect-src 'self' https://cloud.umami.is https://api-gateway.umami.dev",
	"font-src 'self' data:",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"object-src 'none'"
].join('; ');

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

	const forwardedProto = event.request.headers.get('x-forwarded-proto');
	if (event.url.protocol === 'https:' || forwardedProto === 'https') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	// Vite's dev server relies on eval and websocket connections; keep the
	// strict policy for production responses only.
	if (!dev && !response.headers.has('Content-Security-Policy')) {
		response.headers.set('Content-Security-Policy', CSP_PROD);
	}

	return response;
};
