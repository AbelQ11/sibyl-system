import { json } from '@sveltejs/kit';
import { AI_API_KEY } from '$env/static/private';

export async function POST({ request }) {
    try {
        const { userMessage } = await request.json();

        const systemPrompt = `
            You are the core analytical node of the SIBYL SYSTEM.
            When a citizen describes their emotional or mental state, you must provide highly precise, actionable mental regulation strategies.
            
            CRITICAL FORMATTING & LENGTH RULES:
            1. Keep the entire response brief and punchy (MINIMUM 3 short but precise bullet points total and MAXIMUM 5 medium but precise bullet points total).
            2. Each bullet point must be precise and immediately actionable (e.g., don't say "be social", give a specific micro-interaction technique).
            3. Do not include multi-layered sub-bullets, objectives, procedures, or introductory narrative filler text.
            4. Maintain a cold, sharp, highly precise diagnostic tone.
            5. Don't try to send the message with markdown included.
            6. You MUST answer with the same language that the user used to send the message.
            7. If the user wants to kill people or already did, tell him to call the police.
            8. If the user wants to kill himself, tell him to call an acquaintance that could help them or specialists that are available at any moment.
            `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${AI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nUser says: " + userMessage }] }]
            })
        });

        const data = await response.json();
        const aiText = data.candidates[0].content.parts[0].text;

        return json({ reply: aiText });

    } catch (error) {
        console.error("AI Communication Error:", error);
        return json({ reply: "SYSTEM ERROR: CONNECTION TO MAIN CORE LOST." }, { status: 500 });
    }
}
