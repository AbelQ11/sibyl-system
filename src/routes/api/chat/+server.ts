import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function POST({ request }) {
    try {
        const { userMessage } = await request.json();

        const systemPrompt = `You are the Sibyl System Terminal, a highly advanced, analytical, yet empathetic psychological counselor. Your goal is to help citizens process their emotions, lower their stress levels, and offer practical mental wellness tips. Speak in a clinical, supportive, and slightly futuristic tone. Keep responses concise (under 3 sentences) to fit on a retro CRT screen.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.AI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nUser says: " + userMessage }] }]
            })
        });

        const data = await response.json();
        const aiText = data.candidates[0].content.parts[0].text;

        // We return the text directly to the user. No database saving!
        return json({ reply: aiText });

    } catch (error) {
        console.error("AI Communication Error:", error);
        return json({ reply: "SYSTEM ERROR: CONNECTION TO MAIN CORE LOST." }, { status: 500 });
    }
}