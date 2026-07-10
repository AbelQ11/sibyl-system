import { AI_API_KEY, AI_API_KEY_2_OPENAI, MODERATION_API_KEY, MODERATION_API_KEY_2_OPENAI } from '$env/static/private';


const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function queryAI(prompt: string, role: 'empathy' | 'moderation' = 'empathy') {
    const primaryKey = role === 'moderation' ? MODERATION_API_KEY : AI_API_KEY;
    const secondaryKey = role === 'moderation' ? MODERATION_API_KEY_2_OPENAI : AI_API_KEY_2_OPENAI;

    // Attempt primary provider with up to 2 retries (500ms, 1000ms back-off)
    let lastPrimaryError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            if (attempt > 0) {
                console.warn(`[AI Engine] Retrying Gemini (attempt ${attempt + 1}/3) for role: ${role}...`);
                await delay(attempt * 500);
            } else {
                console.log(`[AI Engine] Attempting Primary Provider (Gemini) for role: ${role}`);
            }
            return await queryGemini(prompt, primaryKey);
        } catch (e: any) {
            lastPrimaryError = e;
            // Don't retry on non-retryable errors (bad request, invalid key, etc.)
            if (e.message?.includes('INVALID_ARGUMENT') || e.message?.includes('API key')) break;
        }
    }

    console.warn(`[AI Engine] Primary Provider exhausted for ${role}: ${lastPrimaryError?.message}. Attempting Secondary Provider (OpenAI)...`);

    if (secondaryKey) {
        try {
            return await queryOpenAI(prompt, secondaryKey);
        } catch (e2: any) {
            console.error(`[AI Engine] Secondary Provider Failed for ${role}: ${e2.message}. All providers exhausted.`);
            throw new Error("All AI providers failed.");
        }
    } else {
        throw lastPrimaryError ?? new Error("Primary AI provider failed with no secondary configured.");
    }
}

async function queryGemini(prompt: string, key: string) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    if (!data.candidates) throw new Error("Empty payload returned from Gemini");
    return data.candidates[0].content.parts[0].text;
}

async function queryOpenAI(prompt: string, key: string) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }]
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    if (!data.choices || data.choices.length === 0) throw new Error("Empty payload returned from OpenAI");
    return data.choices[0].message.content;
}
