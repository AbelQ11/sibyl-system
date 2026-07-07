import { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const token = process.env.DISCORD_BOT_TOKEN;
const botSecret = process.env.SIB_BOT_SECRET;
const publicOrigin = process.env.PUBLIC_ORIGIN || 'https://sibyl-system.mooo.com';

if (!token || token === 'your_bot_token_here') {
    console.error('ERROR: Set your DISCORD_BOT_TOKEN in the parent .env file first!');
    process.exit(1);
}

const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
] });
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

client.once('clientReady', () => {
    console.log(`[SIBYL BOT ACTIVE]: Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'inspect') {
        const query = interaction.options.getString('query');
        await interaction.deferReply();

        try {
            const endpoint = `${publicOrigin.replace(/\/$/, '')}/api/discord/inspect?query=${encodeURIComponent(query)}&requesterDiscordId=${interaction.user.id}`;
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${botSecret}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                let errorTitle = '[SIBYL SYSTEM - CLASSIFIED RECORD]';
                let errorDesc = 'Access denied. Subject psychological telemetry records are classified.';
                let color = 0xff3333;

                if (response.status === 404) {
                    errorTitle = '[SIBYL SYSTEM - REGISTRY ERROR]';
                    errorDesc = `Citizen query '${query}' not found in database registry.`;
                }

                const errorEmbed = new EmbedBuilder()
                    .setTitle(errorTitle)
                    .setDescription(errorDesc)
                    .setColor(color)
                    .setTimestamp()
                    .setFooter({ text: 'SIBYL SYSTEM • Core Compliance Network Node' });

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            let ccColor = 0x00ffcc;
            let threatStatus = data.status || 'Optimal Citizen';
            
            if (data.cc > 300) {
                ccColor = 0xff3333;
            } else if (data.cc > 100) {
                ccColor = 0xffaa00;
            }

            const embed = new EmbedBuilder()
                .setTitle('[SIBYL SYSTEM - COGNITIVE DIAGNOSTIC]')
                .setDescription(`Active diagnostic query log for citizen index: **${data.username.toUpperCase()}**`)
                .setColor(ccColor)
                .addFields(
                    { name: 'Citizen Subject', value: `**${data.username}**`, inline: true },
                    { name: 'System Identifier', value: `\`${data.citizen_id}\``, inline: true },
                    { name: 'Crime Coefficient', value: `\`${data.cc}\``, inline: true },
                    { name: 'Diagnostic Hue', value: `**${data.hue}**`, inline: true },
                    { name: 'Enforcement Status', value: `**${threatStatus}**`, inline: true },
                    { name: 'Privacy Clearance', value: `Role: \`${data.role}\` / Level: \`${data.privacy}\``, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'SIBYL SYSTEM • Core Compliance Network Node' });

            if (data.avatar && data.avatar.startsWith('http')) {
                embed.setThumbnail(data.avatar);
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('Fetch inspection failure:', err);
            const errEmbed = new EmbedBuilder()
                .setTitle('[SIBYL SYSTEM - HARDWARE FAULT]')
                .setDescription('A connection failure occurred while querying the primary Sibyl System database registry nodes.')
                .setColor(0xff3333)
                .setTimestamp()
                .setFooter({ text: 'SIBYL SYSTEM • Hardware Node Error' });
            await interaction.editReply({ embeds: [errEmbed] });
        }
    } else if (commandName === 'id') {
        const query = interaction.options.getString('query');
        await interaction.deferReply();

        try {
            const endpoint = `${publicOrigin.replace(/\/$/, '')}/api/discord/inspect?query=${encodeURIComponent(query)}&requesterDiscordId=${interaction.user.id}`;
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${botSecret}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                let errorTitle = '[SIBYL SYSTEM - CLASSIFIED RECORD]';
                let errorDesc = 'Access denied. Subject psychological telemetry records are classified.';
                let color = 0xff3333;

                if (response.status === 404) {
                    errorTitle = '[SIBYL SYSTEM - REGISTRY ERROR]';
                    errorDesc = `Citizen query '${query}' not found in database registry.`;
                }

                const errorEmbed = new EmbedBuilder()
                    .setTitle(errorTitle)
                    .setDescription(errorDesc)
                    .setColor(color)
                    .setTimestamp()
                    .setFooter({ text: 'SIBYL SYSTEM • Core Compliance Network Node' });

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            const canvas = createCanvas(600, 360);
            const ctx = canvas.getContext('2d');

            const grad = ctx.createLinearGradient(0, 0, 600, 360);
            grad.addColorStop(0, '#030816');
            grad.addColorStop(1, '#08142c');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 600, 360);

            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 3;
            ctx.strokeRect(12, 12, 576, 336);

            ctx.strokeStyle = 'rgba(0, 255, 204, 0.03)';
            ctx.lineWidth = 1;
            for (let x = 20; x < 580; x += 15) {
                ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 340); ctx.stroke();
            }
            for (let y = 20; y < 340; y += 15) {
                ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(580, y); ctx.stroke();
            }

            ctx.strokeStyle = 'rgba(0, 255, 204, 0.05)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(430, 210, 80, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(430, 210, 45, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(320, 210); ctx.lineTo(540, 210);
            ctx.moveTo(430, 100); ctx.lineTo(430, 320);
            ctx.stroke();

            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(25, 45); ctx.lineTo(25, 25); ctx.lineTo(45, 25); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(575, 45); ctx.lineTo(575, 25); ctx.lineTo(555, 25); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(25, 315); ctx.lineTo(25, 335); ctx.lineTo(45, 335); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(575, 315); ctx.lineTo(575, 335); ctx.lineTo(555, 335); ctx.stroke();

            ctx.fillStyle = '#00ffcc';
            ctx.font = 'bold 16px monospace';
            ctx.fillText('SIBYL SYSTEM CORE COMPLIANCE REGISTRY', 40, 52);
            ctx.fillStyle = 'rgba(0, 255, 204, 0.6)';
            ctx.font = '9px monospace';
            ctx.fillText('VERIFIED CITIZEN SECURITY PASS // COGNITIVE SCAN LOGS', 40, 68);

            ctx.fillStyle = 'rgba(0, 255, 204, 0.7)';
            ctx.font = '10px monospace';
            ctx.fillText('SUBJECT NAME:', 180, 105);
            ctx.fillText('SYSTEM ID:', 180, 130);
            ctx.fillText('DISCORD SYNC:', 180, 155);
            ctx.fillText('COGNITIVE HUE:', 180, 180);
            ctx.fillText('CRIME COEFFICIENT:', 180, 205);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(data.username.toUpperCase(), 290, 105);
            ctx.fillText(data.citizen_id || 'SIB-PENDING', 290, 130);
            ctx.fillText(data.discord_username || 'NOT LINKED', 290, 155);

            let ccVal = data.average_cc !== undefined ? data.average_cc : (data.cc || 0);
            let hueColor = '#00ffcc';
            let hueName = 'CLEAR HUE';
            let enforcementStatus = 'PASS / OPTIMAL';
            let statusColor = '#00ffcc';

            if (ccVal > 300) {
                hueColor = '#ff3333';
                hueName = 'BLACKENED (LETHAL)';
                enforcementStatus = 'ELIMINATOR TRIGGERED';
                statusColor = '#ff3333';
            } else if (ccVal > 100) {
                hueColor = '#ffaa00';
                hueName = 'CLOUDED HUE';
                enforcementStatus = 'LATENT CRIMINAL / THERAPY REQ';
                statusColor = '#ffaa00';
            }

            ctx.fillStyle = hueColor;
            ctx.fillText(hueName, 310, 180);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(ccVal.toString(), 310, 205);

            ctx.fillStyle = hueColor;
            ctx.fillRect(290, 170, 10, 10);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(290, 170, 10, 10);

            ctx.fillStyle = 'rgba(0, 255, 204, 0.05)';
            ctx.fillRect(180, 225, 380, 45);
            ctx.strokeStyle = statusColor;
            ctx.strokeRect(180, 225, 380, 45);

            ctx.fillStyle = statusColor;
            ctx.font = 'bold 11px monospace';
            ctx.fillText('ENFORCEMENT STATUS:', 195, 243);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(enforcementStatus, 195, 260);

            ctx.strokeStyle = 'rgba(0, 255, 204, 0.3)';
            ctx.strokeRect(180, 285, 380, 15);
            ctx.fillStyle = hueColor;
            const barFill = Math.min(380, (ccVal / 500) * 380);
            ctx.fillRect(180, 285, barFill, 15);

            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(180 + (100/500)*380, 285);
            ctx.lineTo(180 + (100/500)*380, 300);
            ctx.moveTo(180 + (300/500)*380, 285);
            ctx.lineTo(180 + (300/500)*380, 300);
            ctx.stroke();

            ctx.fillStyle = 'rgba(0, 255, 204, 0.3)';
            ctx.font = '7px monospace';
            ctx.fillText('SIBYL SYSTEM CORE CERTIFICATE v2.6 // CRYPTOGRAPHICALLY SECURED', 40, 340);
            ctx.fillText(`TIMESTAMP: ${new Date().toISOString()}`, 350, 340);

            let avatarUrl = data.avatar;
            if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('data:')) {
                avatarUrl = `${publicOrigin.replace(/\/$/, '')}/${avatarUrl.replace(/^\//, '')}`;
            }

            const finishResponse = async () => {
                const buffer = canvas.toBuffer('image/png');
                const attachment = new AttachmentBuilder(buffer, { name: `${data.username}_sibyl_pass.png` });
                await interaction.editReply({ files: [attachment] });
            };

            if (avatarUrl) {
                try {
                    let avatarImg;
                    if (avatarUrl.startsWith('data:')) {
                        const cleanUrl = avatarUrl.replace(/\s+/g, '');
                        const base64Data = cleanUrl.split(',')[1];
                        const imgBuffer = Buffer.from(base64Data, 'base64');
                        avatarImg = await loadImage(imgBuffer);
                    } else if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
                        const res = await fetch(avatarUrl);
                        if (!res.ok) throw new Error(`Failed to fetch remote avatar: ${res.status} ${res.statusText}`);
                        const arrayBuffer = await res.arrayBuffer();
                        const imgBuffer = Buffer.from(arrayBuffer);
                        avatarImg = await loadImage(imgBuffer);
                    } else {
                        avatarImg = await loadImage(avatarUrl);
                    }
                    
                    ctx.drawImage(avatarImg, 40, 90, 120, 120);
                    
                    ctx.strokeStyle = '#00ffcc';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(40, 90, 120, 120);

                    ctx.strokeStyle = '#ff3333';
                    ctx.beginPath();
                    ctx.moveTo(35, 90); ctx.lineTo(45, 90);
                    ctx.moveTo(155, 90); ctx.lineTo(165, 90);
                    ctx.moveTo(35, 210); ctx.lineTo(45, 210);
                    ctx.moveTo(155, 210); ctx.lineTo(165, 210);
                    ctx.stroke();

                    ctx.strokeStyle = 'rgba(0, 255, 204, 0.5)';
                    ctx.beginPath();
                    ctx.moveTo(35, 150); ctx.lineTo(165, 150);
                    ctx.stroke();

                    await finishResponse();
                } catch (avatarLoadErr) {
                    console.error('Failed to load user avatar image for ID card:', avatarLoadErr);
                    drawPlaceholderBust(ctx);
                    await finishResponse();
                }
            } else {
                drawPlaceholderBust(ctx);
                await finishResponse();
            }

        } catch (err) {
            console.error('ID Card generation failure:', err);
            const errEmbed = new EmbedBuilder()
                .setTitle('[SIBYL SYSTEM - HARDWARE FAULT]')
                .setDescription('A connection failure occurred while rendering the cryptographically secured citizen pass.')
                .setColor(0xff3333)
                .setTimestamp()
                .setFooter({ text: 'SIBYL SYSTEM • Hardware Node Error' });
            await interaction.editReply({ embeds: [errEmbed] });
        }
    } else if (commandName === 'status') {
        await interaction.deferReply();
        try {
            const endpoint = `${publicOrigin.replace(/\/$/, '')}/api/discord/status`;
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${botSecret}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            let color = 0x00ffcc;
            if (data.threat_level === 'Critical') color = 0xff3333;
            else if (data.threat_level === 'Warning') color = 0xffaa00;

            const embed = new EmbedBuilder()
                .setTitle('[SIBYL SYSTEM - GLOBAL THREAT STATUS]')
                .setDescription('Current cognitive diagnostic average across all registered citizens.')
                .setColor(color)
                .addFields(
                    { name: 'Average Crime Coefficient', value: `\`${data.average_cc}\``, inline: true },
                    { name: 'Threat Level', value: `**${data.threat_level}**`, inline: true },
                    { name: 'Registered Citizens', value: `\`${data.citizen_count}\``, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'SIBYL SYSTEM • Core Compliance Network Node' });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('Status check failure:', err);
            await interaction.editReply('Error checking SIBYL status.');
        }
    } else if (commandName === 'history') {
        await interaction.deferReply({ ephemeral: true });
        try {
            const endpoint = `${publicOrigin.replace(/\/$/, '')}/api/discord/history?discordId=${interaction.user.id}`;
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${botSecret}` }
            });
            const data = await response.json();
            
            if (response.status === 404 && data.error === 'UNLINKED') {
                return await interaction.editReply('Your Discord account is not linked to any SIBYL profile. Please link it in your website account settings.');
            }
            if (!response.ok) throw new Error(data.error || 'Server error');

            let desc = data.history.map((h, i) => {
                let d = h.created_at;
                if (!d.includes('Z')) d = d.replace(' ', 'T') + 'Z';
                return `**${i+1}.** CC: \`${h.cc}\` - <t:${Math.floor(new Date(d).getTime() / 1000)}:R>`;
            }).join('\n');
            if (!desc) desc = 'No telemetry data recorded yet.';

            const embed = new EmbedBuilder()
                .setTitle(`[SIBYL SYSTEM - PERSONAL TELEMETRY LOG]`)
                .setDescription(`Recent CC fluctuations for **${data.username}**:\n\n${desc}`)
                .setColor(0x00ffcc)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('History check failure:', err);
            await interaction.editReply('Error retrieving your history log.');
        }
    } else if (commandName === 'division') {
        const query = interaction.options.getString('query');
        await interaction.deferReply();
        try {
            const endpoint = `${publicOrigin.replace(/\/$/, '')}/api/discord/division?query=${encodeURIComponent(query)}`;
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${botSecret}` }
            });
            const data = await response.json();
            
            if (response.status === 404 && data.error === 'NOT_FOUND') {
                return await interaction.editReply(`Division \`${query}\` not found in the SIBYL registry.`);
            }
            if (!response.ok) throw new Error(data.error || 'Server error');

            const embed = new EmbedBuilder()
                .setTitle(`[SIBYL SYSTEM - DIVISION REGISTRY]`)
                .setDescription(`Division: **${data.name}**`)
                .setColor(0x00ffcc)
                .addFields(
                    { name: 'Member Count', value: `\`${data.memberCount}\``, inline: true },
                    { name: 'Average CC', value: `\`${data.averageCC}\``, inline: true },
                    { name: 'Max CC Threshold', value: `\`${data.maxCC}\``, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'SIBYL SYSTEM • Division Records' });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('Division query failure:', err);
            await interaction.editReply('Error querying division data.');
        }
    }
});

function drawPlaceholderBust(ctx) {
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(40, 90, 120, 120);

    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(100, 135, 22, 0, Math.PI * 2);
    ctx.moveTo(93, 157); ctx.lineTo(93, 175);
    ctx.moveTo(107, 157); ctx.lineTo(107, 175);
    ctx.moveTo(65, 195); ctx.lineTo(80, 175); ctx.lineTo(120, 175); ctx.lineTo(135, 195);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 51, 51, 0.6)';
    ctx.beginPath();
    ctx.moveTo(45, 140); ctx.lineTo(155, 140);
    ctx.stroke();
}

client.login(token);