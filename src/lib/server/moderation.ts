import { db } from './db';
import { chatStore } from './chatStore';
import { queryAI } from './aiFallbackEngine';

export async function moderateMessage(messageId: number, text: string, userId: number) {
	const prompt = `You are the SIBYL System Empathy AI. Evaluate the following citizen message. Does it contain profanity, toxic language, insults, violence, physical threats, or explicitly rebellious intent against the system? 
    Return a JSON strictly in this format without any markdown blocks: {"hasInfraction": boolean, "severityScore": number} where severityScore is an integer from 1 to 10.
    
    Message: "${text}"`;

	let aiResponse;
	try {
		aiResponse = await queryAI(prompt, 'moderation');
	} catch {
		console.warn('AI Engine unavailable for moderation. Allowing message without penalty.');
		return;
	}

	let jsonStr = aiResponse;
	if (jsonStr.includes('```')) {
		jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
	}

	let parsed: any;
	try {
		const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
		parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(jsonStr);
	} catch (parseError) {
		console.error('Failed to parse moderation AI response JSON:', parseError);
		return;
	}

	if (parsed && (parsed.hasInfraction || parsed.isViolent)) {
		const penalty = Math.min(50, Math.max(5, (Number(parsed.severityScore) || 5) * 5));
		const stats = db
			.prepare('SELECT cc FROM userStats WHERE userId = ? ORDER BY id DESC LIMIT 1')
			.get(userId) as { cc: number } | undefined;
		const newCC = Math.min(500, (stats ? stats.cc : 0) + penalty);

		db.prepare('INSERT INTO userStats (userId, cc, type) VALUES (?, ?, ?)').run(
			userId,
			newCC,
			'SCAN_ENFORCEMENT'
		);
		db.prepare('UPDATE users SET credits = MAX(0, credits - 50) WHERE id = ?').run(userId);

		const redactedText = `[REDACTED BY SIBYL SYSTEM DUE TO PSYCHO-PASS CLOUDING. CC PENALTY: +${penalty}]`;
		db.prepare('UPDATE chat_messages SET text = ?, is_censored = 1 WHERE id = ?').run(
			redactedText,
			messageId
		);

		chatStore.broadcast({
			type: 'message_edited',
			message: { id: messageId, text: redactedText, isReadOnce: false, is_censored: true }
		});
	}
}
