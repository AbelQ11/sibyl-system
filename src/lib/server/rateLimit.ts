interface Bucket {
	count: number;
	resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function sweep(now: number) {
	if (buckets.size <= MAX_BUCKETS) return;
	for (const [key, bucket] of buckets) {
		if (bucket.resetAt <= now) buckets.delete(key);
	}
}

export function clientIp(request: Request): string {
	// Nginx sets X-Real-IP from the actual remote address. X-Forwarded-For can
	// contain client-supplied values, so it is only a fallback.
	const realIp = request.headers.get('x-real-ip')?.trim();
	if (realIp) return realIp;
	const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
	if (forwarded) return forwarded;
	return 'unknown';
}

export function consumeRateLimit(
	key: string,
	limit: number,
	windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
	const now = Date.now();
	sweep(now);

	let bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		bucket = { count: 0, resetAt: now + windowMs };
		buckets.set(key, bucket);
	}

	bucket.count += 1;
	if (bucket.count > limit) {
		return {
			allowed: false,
			retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
		};
	}
	return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimit(key: string): void {
	buckets.delete(key);
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
	return new Response(JSON.stringify({ success: false, code: 'RATE_LIMITED', retryAfterSeconds }), {
		status: 429,
		headers: {
			'Content-Type': 'application/json',
			'Retry-After': String(retryAfterSeconds)
		}
	});
}
