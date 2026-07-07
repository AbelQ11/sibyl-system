import { AI_API_KEY, AI_API_KEY_2_OPENAI, MODERATION_API_KEY, MODERATION_API_KEY_2_OPENAI } from '$env/static/private';

export async function queryAI(prompt: string, role: 'empathy' | 'moderation' = 'empathy') {
    const primaryKey = role === 'moderation' ? MODERATION_API_KEY : AI_API_KEY;
    const secondaryKey = role === 'moderation' ? MODERATION_API_KEY_2_OPENAI : AI_API_KEY_2_OPENAI;

    try {
        console.log(`[AI Engine] Attempting Primary Provider (Gemini) for role: ${role}`);
        return await queryGemini(prompt, primaryKey);
    } catch (e: any) {
        console.warn(`[AI Engine] Primary Provider Failed for ${role}: ${e.message}. Attempting Secondary Provider (OpenAI)...`);
        
        if (secondaryKey) {
            try {
                return await queryOpenAI(prompt, secondaryKey);
            } catch (e2: any) {
                console.error(`[AI Engine] Secondary Provider Failed for ${role}: ${e2.message}. All providers exhausted.`);
                throw new Error("All AI providers failed.");
            }
        } else {
            throw e;
        }
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
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }]
        })
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    if (!data.choices || data.choices.length === 0) throw new Error("Empty payload returned from OpenAI");
    return data.choices[0].message.content;
}
