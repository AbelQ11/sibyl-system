import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId || token === 'your_bot_token_here') {
    console.error('ERROR: Set your DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID in the parent .env file first!');
    process.exit(1);
}

const commands = [
    new SlashCommandBuilder()
        .setName('inspect')
        .setDescription('Inspect citizen psychometric telemetry profiles')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The username or Citizen ID (SIB-XXXXXXXX) to query')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('id')
        .setDescription('Generate a cryptographically secured SIBYL citizen pass image')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The username or Citizen ID (SIB-XXXXXXXX) to render')
                .setRequired(true)
        )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        const guildId = process.argv[2];
        if (guildId) {
            console.log(`[SIBYL COMMAND REGISTRY]: Deploying commands instantly to Guild ID ${guildId}...`);
            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );
        } else {
            console.log(`[SIBYL COMMAND REGISTRY]: Deploying global commands for Application ID ${clientId}... (Note: Global commands can take up to 1 hour to propagate)`);
            await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands }
            );
        }

        console.log('[SIBYL COMMAND REGISTRY]: Commands successfully registered with Discord API.');
    } catch (error) {
        console.error('[SIBYL COMMAND REGISTRY ERROR]: Failed to register commands:', error);
    }
})();
