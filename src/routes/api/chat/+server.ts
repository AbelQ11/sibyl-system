import { json } from '@sveltejs/kit';
import { getAuthUser } from '$lib/server/auth';
import { queryAI } from '$lib/server/aiFallbackEngine';
import { consumeRateLimit, rateLimitResponse } from '$lib/server/rateLimit';

const SYSTEM_PROMPT = `
            You are the core analytical node of the SIBYL SYSTEM.
            When a citizen describes their emotional or mental state, you must provide highly precise, actionable mental regulation strategies.
            
            CRITICAL FORMATTING & LENGTH RULES:
            1. Keep the entire response brief and punchy (MINIMUM 3 short but precise bullet points total and MAXIMUM 5 medium but precise bullet points total).
            2. Each bullet point must be precise and immediately actionable (e.g., don't say "be social", give a specific micro-interaction technique).
            3. Do not include multi-layered sub-bullets, objectives, procedures, or introductory narrative filler text.
            4. Maintain a cold, sharp, highly precise diagnostic tone.
            5. Don't try to send the message with markdown included.
            6. You MUST answer with the same language that the user used to send the message.
            7. If the user wants to kill people or already did, tell them to call the police.
            8. If the user wants to kill himself, tell them to call an acquaintance that could help them or specialists that are available at any moment.
            `;

export async function POST({ request, cookies }) {
	const user = getAuthUser(cookies.get('session'));
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const limit = consumeRateLimit(`ai-chat:${user.id}`, 10, 60_000);
	if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

	try {
		const body = await request.json().catch(() => null);
		const userMessage = typeof body?.userMessage === 'string' ? body.userMessage.trim() : '';

		if (!userMessage || userMessage.length > 2000) {
			return json({ error: 'Message must be between 1 and 2000 characters' }, { status: 400 });
		}

		const aiText = await queryAI(`${SYSTEM_PROMPT}\n\nUser says: ${userMessage}`, 'empathy');

		return json({ reply: aiText });
	} catch (error) {
		console.error('AI Communication Error:', error);
		return json({ reply: 'SYSTEM ERROR: CONNECTION TO MAIN CORE LOST.' }, { status: 500 });
	}
}
