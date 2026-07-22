import { EmbedBuilder } from 'discord.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createEventPreset } from './embedPresets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '..', '..', 'data', 'admin-config.json');

let client = null;

export function initAdminLogs(discordClient) {
  client = discordClient;
}

export function logToChannelAsync(type, embed) {
  // Lance le log en background sans bloquer
  if (!embed) return; // Skip if embed is null
  
  setImmediate(async () => {
    try {
      await logToChannel(type, embed);
    } catch (error) {
      console.error('[ADMIN LOGS ASYNC ERROR]', error);
    }
  });
}

export async function logToChannel(type, embed) {
  if (!client || !embed) return;

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    
    // Adicionar check defensivo para logChannels
    if (!config.logChannels || typeof config.logChannels !== 'object') {
      console.warn(`[ADMIN LOGS] logChannels not configured properly`);
      return;
    }
    
    const channelId = config.logChannels[type];

    if (!channelId || channelId === 'CHANNEL_ID_HERE') {
      console.warn(`[ADMIN LOGS] Channel not configured for type: ${type}`);
      return;
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.warn(`[ADMIN LOGS] Channel not found: ${channelId}`);
      return;
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('[ADMIN LOGS ERROR]', error);
  }
}

export function createLogEmbed(title, description, type = 'admin') {
  // Verificar se o client foi inicializado
  if (!client) {
    console.warn('[ADMIN LOGS] Client não inicializado, retornando null');
    return null;
  }

  const emojis = {
    permissions: '🔐',
    security: '⚠️',
    errors: '❌',
    admin: '⚙️',
    maintenance: '🔧',
    broadcast: '📢',
    general: '📝'
  };

  // Ameliorar o formatting do titulo (colocar em bold e italico)
  const formattedTitle = `***${title}***`;
  
  // Melhorar a descricao detectando certos padroes
  let formattedDescription = description;
  
  // Converter padroes como "word a" em "`word` a"
  // Mas atencao aos nomes complicados. Procurar os padroes comuns
  formattedDescription = formattedDescription
    // Substituir nomes que comecam uma frase (lebelge_e a, user a)
    .replace(/`([^`]+)`\s+(a|a\s|dans)/g, '`$1` ***$2***')
    // Converter {{arg}} em codigo
    .replace(/{{(\w+)}}/g, '`$1`');

  return createEventPreset(client, {
    emoji: emojis[type] || '📝',
    title: formattedTitle,
    description: formattedDescription
  });
}
