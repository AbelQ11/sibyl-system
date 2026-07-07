import { json } from '@sveltejs/kit';
import { queryAI } from '$lib/server/aiFallbackEngine';
import { db } from '$lib/server/db';

export async function POST({ request }) {
    try {
        const { text, userId } = await request.json();

        const systemPrompt = `You are the Sibyl System Empathy AI. You are clinical, objective, and analytical.
            The user will provide text describing their emotional state.
            You MUST output your response matching the requested schema fields exactly:

            CRIME COEFFICIENT: [Number between 0 and 500 based on their distress]
            ANALYSIS: [1-2 sentences of clinical psychological analysis]
            TREATMENT PROTOCOL:
            - [Provide a grounding technique, e.g., the 5-4-3-2-1 method]
            - [Provide a cognitive reframing tip]
            - [Provide a physiological tip, e.g., splashing cold water]

            CRITICAL CALIBRATION METRICS:
            - If the user suffers from any mental illness or you feel like it is the case, put the CC to AT LEAST 200 but it can be higher.
            - Do NOT jump straight to 300+ unless the text indicates extreme, violent, or deeply volatile psychological stress.
            - You MUST answer with the same language that the user used to send the message.`;

        const aiText = await queryAI(systemPrompt + "\n\nUser text: " + text, 'empathy');

        const ccMatch = aiText.match(/CRIME\s+COEFFICIENT:\s*(\d+)/i);
        const cc = ccMatch ? parseInt(ccMatch[1], 10) : 180;

        const analysisMatch = aiText.match(/ANALYSIS:\s*([^\n]+(?:\n(?!\s*TREATMENT)[^\n]+)*)/i);
        const analysis = analysisMatch ? analysisMatch[1].trim() : "Analysis evaluation complete.";

        let treatment: string[] = [];
        const treatmentSplit = aiText.split(/TREATMENT\s+PROTOCOL:/i);
        if (treatmentSplit.length > 1) {
            treatment = treatmentSplit[1]
                .split('\n')
                .map((line: string) => line.replace(/^[-*\s•]+/, '').trim())
                .filter((line: string) => line.length > 0)
                .slice(0, 3);
        }

        if (treatment.length === 0) {
            treatment = ["Execute calming control protocols.", "Initialize rhythmic focus.", "Stabilize baseline metrics."];
        }

        if (!userId || userId === 'GUEST_PROFILE') {
            return json({ error: 'Unauthorized: Citizen identification required.' }, { status: 401 });
        }

        const parsedData = { cc, analysis, treatment };

        try {
            const userRow = db.prepare('SELECT id FROM users WHERE username = ? OR id = ?').get(userId, userId) as { id: number } | undefined;
            if (userRow) {
                db.prepare("INSERT INTO userStats (userId, cc, type) VALUES (?, ?, 'terminal')")
                    .run(userRow.id, parsedData.cc);

                /** Discord webhook integration removed. */
            } else {
                console.warn(`[SIBYL API WARNING]: Citizen '${userId}' not found in database registry for logging.`);
            }
        } catch (dbErr) {
            console.error("Database tracking failure:", dbErr);
        }

        return json(parsedData);

    } catch (error) {
        console.error("AI Error Triggered:", error);
        return json({
            cc: 180,
            analysis: "SYSTEM ERROR. DEFAULTING TO ELEVATED THREAT LEVEL.",
            treatment: ["Reload core engine terminals.", "Take slow deep breaths."]
        });
    }
}