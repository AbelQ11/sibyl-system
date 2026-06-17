import * as env_static from '$env/static/private';
export async function triggerDiscordWebhook(
    username: string,
    citizenId: string,
    cc: number,
    privacy: string,
    discordId: string | null
) {
    const webhookUrl = (env_static as any).DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        return;
    }

    const adminAccountId = (env_static as any).ADMIN_ACCOUNT_ID || 'Kiliotsu';
    if (username !== adminAccountId) {
        return;
    }

    let color = 65280;
    let threatLevel = 'OPTIMAL CITIZEN';
    let instruction = 'Psycho-Pass is clear. Maintain current cognitive stability levels.';

    if (cc > 300) {
        color = 16711680;
        threatLevel = 'LETHAL ELIMINATOR TARGET';
        instruction = 'CRITICAL WARNING: Subject presents severe public threat. Law enforcement units authorized for complete neutralization.';
    } else if (cc > 100) {
        color = 16753920;
        threatLevel = 'LATENT CRIMINAL';
        instruction = 'WARNING: Cognitive clouding detected. Calming calming calming therapy protocol requested.';
    }

    const mentionCitizen = discordId ? `<@${discordId}>` : `**${username}**`;

    const payload = {
        embeds: [
            {
                title: '[SIBYL SYSTEM - COGNITIVE DIAGNOSTIC WARNING]',
                description: `An active Psycho-Pass check was recorded on the SIBYL interface node.\n\n*${instruction}*`,
                color: color,
                fields: [
                    { name: 'Citizen Subject', value: mentionCitizen, inline: true },
                    { name: 'System Identifier', value: `\`${citizenId}\``, inline: true },
                    { name: 'Crime Coefficient', value: `\`${cc}\``, inline: true },
                    { name: 'Enforcement Status', value: `**${threatLevel}**`, inline: true }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'SIBYL SYSTEM • Core Compliance Network Node'
                }
            }
        ]
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            console.error(`[SIBYL WEBHOOK ERROR]: Discord API responded with HTTP status ${response.status}`);
        } else {
            console.log(`[SIBYL WEBHOOK]: Successfully alerted on citizen ${username} CC spike.`);
        }
    } catch (err: any) {
        console.error('[SIBYL WEBHOOK ERROR]: Connection failure during dispatch:', err.message);
    }
}
