import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { triggerDiscordWebhook } from '$lib/server/webhook';

export async function POST({ request }) {
    try {
        const { cc, userId } = await request.json();
        
        if (!userId) {
            return json({ error: 'Missing citizen identifier context' }, { status: 400 });
        }

        const userRow = db.prepare('SELECT id FROM users WHERE username = ? OR id = ?').get(userId, userId) as { id: number } | undefined;
        
        if (!userRow) {
            // Trigger webhook for GUESTS who aren't logged in, but don't save to database
            try {
                await triggerDiscordWebhook('GUEST_PROFILE', 'SIB-UNKNOWN', cc, 'PUBLIC', null);
            } catch (webhookErr: any) {
                console.error('Failed to trigger Discord webhook for guest:', webhookErr.message);
            }
            return json({ error: 'Citizen not found in database registry' }, { status: 404 });
        }

        db.prepare("INSERT INTO userStats (userId, cc, type) VALUES (?, ?, 'biometric')").run(userRow.id, cc);

        try {
            const user = db.prepare('SELECT username, citizen_id, privacy, discord_id FROM users WHERE id = ?').get(userRow.id) as { username: string, citizen_id: string, privacy: string, discord_id: string | null } | undefined;
            if (user) {
                await triggerDiscordWebhook(user.username, user.citizen_id, cc, user.privacy, user.discord_id);
            }
        } catch (webhookErr: any) {
            console.error('Failed to trigger Discord webhook:', webhookErr.message);
        }

        return json({ success: true });
    } catch (err: any) {
        console.error('Failed to save biometric scan CC:', err.message);
        return json({ error: 'Database tracking failure' }, { status: 500 });
    }
}
