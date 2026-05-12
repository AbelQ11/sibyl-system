import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function POST({ request }) {
    try {
        const { text } = await request.json();

        const systemPrompt = `You are the Sibyl System Empathy AI. You are clinical, objective, and analytical.
            The user will provide text describing their emotional state.
            You MUST output your response in this exact format, and you MUST include actionable tips:

            CRIME COEFFICIENT: [Number between 0 and 500 based on their distress]
            ANALYSIS: [1-2 sentences of clinical psychological analysis]
            TREATMENT PROTOCOL:
            - [Provide a grounding technique, e.g., the 5-4-3-2-1 method]
            - [Provide a cognitive reframing tip]
            - [Provide a physiological tip, e.g., splashing cold water]`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.AI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nUser text: " + text }] }]
            })
        });

        const data = await response.json();

        if (!data.candidates) {
            console.error("GOOGLE API REJECTED REQUEST:", data);
            throw new Error("Gemini API did not return valid candidates.");
        }

        const aiText = data.candidates[0].content.parts[0].text;

        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return json(JSON.parse(jsonMatch[0]));
        } else {
            throw new Error("Invalid AI JSON response");
        }

    } catch (error) {
        console.error("AI Error Triggered:", error);
        return json({ cc: 150, analysis: "SYSTEM ERROR. DEFAULTING TO ELEVATED THREAT LEVEL." });
    }
}