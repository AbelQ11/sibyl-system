import { db } from '$lib/server/db';

export async function GET() {
    try {
        const rules = db.prepare("SELECT css_rules FROM cosmetics WHERE css_rules IS NOT NULL AND css_rules != ''").all() as { css_rules: string }[];
        
        let cssString = '';
        for (const rule of rules) {
            cssString += rule.css_rules + '\n\n';
        }

        return new Response(cssString, {
            headers: {
                'Content-Type': 'text/css',
                'Cache-Control': 'no-cache'
            }
        });
    } catch (e: any) {
        console.error("CSS API Error:", e);
        return new Response('/* Error loading dynamic cosmetics: ' + e.message + ' */', {
            headers: { 'Content-Type': 'text/css' }
        });
    }
}
