import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ChannelType } from 'discord.js';
import { setBroadcastChannel, getBroadcastChannel, removeBroadcastChannel } from '../utils/database.js';
import { logToChannelAsync, createLogEmbed } from '../utils/adminLogs.js';
import BypassService from '../services/bypassService.js';

const OWNER_ID = process.env.OWNER_ID || process.env.OWNER_IDS?.split(',')[0] || '492627367114702849';

function isExpiredInteractionError(error) {
  return error?.code === 10062 || error?.status === 404 || error?.message?.includes('Unknown interaction');
}

async function safeRespond(interaction, payload) {
  try {
    await interaction.respond(payload);
    return true;
  } catch (error) {
    if (isExpiredInteractionError(error)) {
      console.warn('[AUTOCOMPLETE] Interaction expired, skipping autocomplete response');
      return false;
    }
    throw error;
  }
}

export const data = new SlashCommandBuilder()
  .setName('broadcast')
  .setDescription('Configurer les paramètres de broadcast pour ce serveur')
  .addSubcommand(sub =>
    sub.setName('config')
      .setDescription('Configurer le channel de broadcast')
      .addStringOption(opt =>
        opt.setName('channel')
          .setDescription('Le channel où recevoir les annonces du bot')
          .setAutocomplete(true)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('view')
      .setDescription('Voir la configuration actuelle du broadcast')
  )
  .addSubcommand(sub =>
    sub.setName('reset')
      .setDescription('Réinitialiser la configuration du broadcast')
  );

export async function handleAutocomplete(interaction) {
  try {
    // Vérifier que c'est bien la commande broadcast
    if (interaction.commandName !== 'broadcast') {
      console.log(`[AUTOCOMPLETE] Command is ${interaction.commandName}, not broadcast. Responding with empty.`);
      await safeRespond(interaction, []);
      return;
    }

    // Vérifier que l'interaction est dans un serveur
    if (!interaction.guild) {
      console.log('[AUTOCOMPLETE] No guild found!');
      await safeRespond(interaction, []);
      return;
    }

    // Rafraîchir le cache des channels pour avoir les nouveaux channels
    try {
      const fetchedChannels = await interaction.guild.channels.fetch();
      console.log(`[AUTOCOMPLETE] Guild channels cache updated - ${fetchedChannels.size} channels fetched from Discord API`);
      
      // Log les channels créés récemment (moins de 1 minute)
      const now = Date.now();
      fetchedChannels.forEach(ch => {
        if (ch.createdTimestamp && (now - ch.createdTimestamp) < 60000) {
          console.log(`[AUTOCOMPLETE] 🆕 NEW CHANNEL: ${ch.name} (type=${ch.type}, createdAt=${new Date(ch.createdTimestamp).toISOString()})`);
        }
      });
    } catch (e) {
      console.error('[AUTOCOMPLETE] Erreur lors du fetch des channels:', e.message);
    }

    const focusedValue = interaction.options.getFocused() || '';
    console.log(`[AUTOCOMPLETE] Focused value: "${focusedValue}"`);
    
    // Lister TOUS les channels texte dans le cache
    console.log('[AUTOCOMPLETE] All GuildText channels in cache:');
    interaction.guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText)
      .forEach(c => {
        const canView = c.permissionsFor(interaction.client.user)?.has('ViewChannel');
        console.log(`  - ${c.name} (ID: ${c.id}, canView: ${canView}, created: ${new Date(c.createdTimestamp).toISOString()})`);
      });
    
    // Filtrer UNIQUEMENT les channels texte (ChannelType.GuildText = 0)
    // Inclure TOUS les channels texte, même ceux avec permissions limitées
    const allTextChannels = interaction.guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText)
      .map(c => ({
        name: `#${c.name}`.substring(0, 100),
        value: c.id.substring(0, 100),
        createdTimestamp: c.createdTimestamp
      }));

    console.log(`[AUTOCOMPLETE] Total TEXT channels in guild: ${allTextChannels.length}`);

    // Si l'utilisateur tape quelque chose, filtrer par le texte
    // Sinon, afficher les 25 plus récents
    let filtered;
    if (focusedValue && focusedValue.trim().length > 0) {
      filtered = allTextChannels
        .filter(choice =>
          choice.name.toLowerCase().includes(focusedValue.toLowerCase())
        )
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp) // Plus récents d'abord
        .slice(0, 25);
      console.log(`[AUTOCOMPLETE] Filtered results (search mode): ${filtered.length}`);
    } else {
      // Mode défaut: afficher les 25 plus récents
      filtered = allTextChannels
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp) // Plus récents d'abord
        .slice(0, 25);
      console.log(`[AUTOCOMPLETE] Default results (recent first): ${filtered.length}`);
    }

    // Retirer le createdTimestamp avant d'envoyer à Discord
    const results = filtered.map(({ name, value }) => ({ name, value }));

    console.log(`[AUTOCOMPLETE] Final results: ${results.length}`, results);

    const responded = await safeRespond(interaction, results);
    if (responded) {
      console.log('[AUTOCOMPLETE] Response sent successfully!');
    }
  } catch (error) {
    console.error('[AUTOCOMPLETE ERROR]', error);
    try {
      const fallbackResponded = await safeRespond(interaction, []);
      if (fallbackResponded) {
        console.log('[AUTOCOMPLETE] Empty response sent (fallback)');
      }
    } catch (e) {
      console.error('[AUTOCOMPLETE FALLBACK ERROR]', e);
    }
  }
}

export async function execute(interaction) {
  // Seul l'admin du serveur peut configurer, sauf si c'est le créateur du bot ou un utilisateur bypassé
  try {
    if (interaction.user.id !== OWNER_ID) {
      const isBypassed = await BypassService.isBypassed(interaction.user.id);
      if (!isBypassed && interaction.member.id !== interaction.guild.ownerId) {
        return interaction.editReply({
          content: '❌・Seul le créateur du serveur peut configurer le broadcast!'
        });
      }
    }
  } catch (e) {
    // En cas d'erreur DB, retomber sur la vérification par défaut
    if (interaction.member.id !== interaction.guild.ownerId) {
      return interaction.editReply({
        content: '❌・Seul le créateur du serveur peut configurer le broadcast!'
      });
    }
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'config') {
    await configBroadcast(interaction);
  } else if (subcommand === 'view') {
    await viewBroadcast(interaction);
  } else if (subcommand === 'reset') {
    await resetBroadcast(interaction);
  }
}

async function configBroadcast(interaction) {
  const channelId = interaction.options.getString('channel');
  const channel = interaction.guild.channels.cache.get(channelId);

  if (!channel.isTextBased()) {
    return interaction.editReply({
      content: '❌・Le channel doit être un channel texte!'
    });
  }

  try {
    console.log(`[BROADCAST CONFIG] Tentative de sauvegarde pour ${interaction.guild.name} (${interaction.guildId}) → ${channelId}`);
    const result = await setBroadcastChannel(interaction.guildId, channel.id);
    
    if (!result.success) {
      console.error(`[BROADCAST CONFIG] Erreur lors de la sauvegarde:`, result.error);
      return interaction.editReply({
        content: `❌ Erreur lors de la sauvegarde: ${result.error}`
      });
    }

    console.log(`[BROADCAST CONFIG] ✅ Sauvegarde réussie pour ${interaction.guild.name}`);

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('✅・BROADCAST CONFIGURÉ')
      .setDescription(`Les annonces du bot seront envoyées dans ${channel}`)
      .addFields({
        name: '📝 Qu\'est-ce qui sera envoyé?',
        value: '• Annonces importantes du bot\n• Notifications de maintenance\n• Nouvelles fonctionnalités',
        inline: false
      })
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logToChannelAsync('admin', createLogEmbed(
      'Channel de Broadcast Configuré',
      `${interaction.user.username} a configuré le channel de broadcast sur **${interaction.guild.name}** → ${channel}`
    ));
  } catch (error) {
    console.error('Error configuring broadcast:', error);
    await interaction.editReply({
      content: `❌ Erreur: ${error.message}`
    });
  }
}

async function viewBroadcast(interaction) {
  try {
    const channelId = await getBroadcastChannel(interaction.guildId);

    if (!channelId) {
      const setupEmbed = new EmbedBuilder()
        .setColor(0xFF9900)
        .setTitle('⚠️・BROADCAST NON CONFIGURÉ')
        .setDescription('Vous n\'avez pas encore configuré le channel de broadcast!')
        .addFields({
          name: '📌・Pourquoi c\'est important?',
          value: '• Vous recevrez les annonces du bot (mises à jour, maintenances, nouvelles fonctionnalités)\n• Sans configuration, vous ne serez PAS notifié des changements importants',
          inline: false
        })
        .addFields({
          name: '⚙️・Comment configurer?',
          value: 'Utilise: `/broadcast config #channel`\n\nRemplace `#channel` par le channel où tu veux recevoir les annonces',
          inline: false
        })
        .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
        .setTimestamp();

      return await interaction.editReply({ embeds: [setupEmbed] });
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('✅・BROADCAST CONFIGURÉ')
      .setDescription(`Les annonces seront envoyées dans <#${channelId}>`)
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error viewing broadcast:', error);
    await interaction.editReply({
      content: `❌ Erreur: ${error.message}`
    });
  }
}

async function resetBroadcast(interaction) {
  try {
    await removeBroadcastChannel(interaction.guildId);

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('✅・BROADCAST RÉINITIALISÉ')
      .setDescription('La configuration a été supprimée. Vous ne recevrez plus les annonces du bot.')
      .addFields({
        name: '⚙️・Pour réactiver:',
        value: 'Utilise: `/broadcast config #channel`',
        inline: false
      })
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logToChannelAsync('admin', createLogEmbed(
      'Channel de Broadcast Réinitialisé',
      `${interaction.user.username} a réinitialisé le broadcast sur **${interaction.guild.name}**`
    ));
  } catch (error) {
    console.error('Error resetting broadcast:', error);
    await interaction.editReply({
      content: `❌ Erreur: ${error.message}`
    });
  }
}

