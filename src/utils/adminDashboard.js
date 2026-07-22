import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getTopCommands, getUniqueUsers, getDatabaseStats, getBlockedAttemptsSummary, getRecentBackups } from './database.js';

export async function getStatisticsEmbed() {
  try {
    const topCommands = await getTopCommands(5);
    const uniqueUsers = await getUniqueUsers();
    const dbStats = await getDatabaseStats();

    const commandsList = topCommands.length > 0
      ? topCommands.map((cmd, i) => `${i + 1}. \`/${cmd.commandName}\` - **${cmd.count}** utilisations`).join('\n')
      : 'Aucune donnée';

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('📊・STATISTIQUES')
      .addFields(
        { name: '👥 Utilisateurs uniques', value: `**${uniqueUsers}** utilisateurs`, inline: false },
        { name: '🔝 Top 5 Commandes', value: commandsList, inline: false },
        { name: '╌╌╌╌╌╌╌╌╌╌╌', value: ' ', inline: false },
        { name: '👤 Joueurs', value: `**${dbStats.totalPlayers || 0}** enregistrés`, inline: true },
        { name: '💾 Sauvegardes', value: `**${dbStats.totalSavedPlayers || 0}** joueurs sauvegardés`, inline: true },
        { name: '⚔️ Factions', value: `**${dbStats.totalFactions || 0}** factions sauvegardées`, inline: true }
      )
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
      .setTimestamp();

    return embed;
  } catch (error) {
    console.error('[ADMIN DASHBOARD] Erreur stats:', error);
    return new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('❌ Erreur')
      .setDescription('Impossible de charger les statistiques')
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' });
  }
}

export async function getBackupsEmbed() {
  try {
    const backups = await getRecentBackups(10);

    const backupsList = backups.length > 0
      ? backups.map(backup => {
          const createdDate = new Date(backup.createdAt * 1000).toLocaleDateString('fr-FR', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          const expiresDate = backup.expiresAt 
            ? new Date(backup.expiresAt * 1000).toLocaleDateString('fr-FR', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })
            : 'N/A';
          return `\`${backup.filePath}\`\n  📅 Créée: ${createdDate}\n  ⏰ Expire: ${expiresDate}`;
        }).join('\n\n')
      : 'Aucune sauvegarde';

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('💾・GESTION DES BACKUPS')
      .setDescription('> Sauvegardes quotidiennes à 21h\n> Suppression après 72 heures')
      .addFields(
        { name: '📋 Dernières Sauvegardes', value: backupsList, inline: false }
      )
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
      .setTimestamp();

    return embed;
  } catch (error) {
    console.error('[ADMIN DASHBOARD] Erreur backups:', error);
    return new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('❌ Erreur')
      .setDescription('Impossible de charger les backups')
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' });
  }
}

export async function getSecurityEmbed() {
  try {
    const blockedAttempts = await getBlockedAttemptsSummary(24);

    const blockedText = (Array.isArray(blockedAttempts) && blockedAttempts.length > 0)
      ? blockedAttempts.map(attempt => `• **${attempt.reason}**: ${attempt.count} tentatives`).join('\n')
      : 'Aucune tentative bloquée (24h)';

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🛡️・SÉCURITÉ')
      .addFields(
        { name: '🚫 Tentatives Bloquées (24h)', value: blockedText, inline: false }
      )
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' })
      .setTimestamp();

    return embed;
  } catch (error) {
    console.error('[ADMIN DASHBOARD] Erreur security:', error);
    return new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('❌ Erreur')
      .setDescription('Impossible de charger les données de sécurité')
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS' });
  }
}

export function getBackButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_panel_back')
      .setLabel('⬅️ Retour')
      .setStyle(ButtonStyle.Danger)
  );
}

export function getSecurityActionButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_panel_back')
      .setLabel('← Retour')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
  );
}
