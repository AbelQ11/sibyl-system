import { json } from '@sveltejs/kit';
import { queryAI } from '$lib/server/aiFallbackEngine';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { insertCC } from '$lib/server/repositories/statsRepository';

/**
 * Submits user text to the AI Fallback Engine for psychological analysis.
 * Generates a Crime Coefficient (CC) penalty and recommended treatment protocols.
 * Logs the resulting CC penalty into the userStats repository.
 *
 * @param request - The HTTP request containing the user's text submission.
 * @param cookies - The request cookies used for session authentication.
 * @returns JSON response containing the calculated CC, clinical analysis, and treatment.
 */
export async function POST({ request, cookies }) {
    const user = getAuthUser(cookies.get('session'));
    if (!user) {
        return json({ error: 'Unauthorized: Active session required.' }, { status: 401 });
    }

    try {
        const { text } = await request.json();

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

        const parsedData: any = { cc, analysis, treatment };

        try {
            insertCC(user.id, cc, 'terminal');

            const today = new Date().toISOString().split('T')[0];
            const userData = db.prepare('SELECT last_scan_date FROM users WHERE id = ?').get(user.id) as { last_scan_date: string };

            let creditsEarned = 0;
            if (userData.last_scan_date !== today) {
                db.prepare('UPDATE users SET last_scan_date = ?, credits = credits + 20 WHERE id = ?').run(today, user.id);
                creditsEarned = 20;
            }

            parsedData.creditsEarned = creditsEarned;

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
