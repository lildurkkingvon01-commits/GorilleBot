import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { setGuildDMAlert } from '../utils/guildConfig.js';

export const data = new SlashCommandBuilder()
  .setName('dm')
  .setDescription('Activer ou désactiver les alertes DM pour les joueurs inactifs')
  .addStringOption(option =>
    option
      .setName('statut')
      .setDescription('Activer ou désactiver les alertes DM')
      .setRequired(true)
      .addChoices(
        { name: '✅ Activer', value: 'on' },
        { name: '❌ Désactiver', value: 'off' }
      )
  );

export async function execute(interaction) {
  // Authorization handled centrally by GlobalCommandMiddleware

  const statut = interaction.options.getString('statut');
  const enabled = statut === 'on';

  try {
    await setGuildDMAlert(interaction.guildId, enabled);

    const embed = new EmbedBuilder()
      .setColor(enabled ? 0x00d26a : 0xff6b6b)
      .setTitle(enabled ? '🟢・__ALERTES DM ACTIVÉES__' : '🔴・__ALERTES DM DÉSACTIVÉES__')
      .setDescription(enabled 
        ? 'Les joueurs inactifs recevront des alertes par **DM privé** ! 📬'
        : 'Les joueurs **ne recevront plus** d\'alertes par **DM privé** 🚫'
      )
      .addFields(
        { name: '━━━━━ 📊 STATUT 📊 ━━━━━', value: ' ', inline: false },
        {
          name: enabled ? '🟢・STATUT ACTUEL' : '🔴・STATUT ACTUEL',
          value: enabled ? '`ACTIVÉES ✅`' : '`DÉSACTIVÉES ❌`',
          inline: true
        },
        {
          name: '📬・DESTINATION',
          value: enabled ? '`Messages privés des joueurs`' : '`Seulement le channel configuré`',
          inline: true
        },
        { name: '━━━━━ ℹ️ INFORMATION ℹ️ ━━━━━', value: ' ', inline: false },
        {
          name: '📋・Détails',
          value: enabled 
            ? 'Les alertes seront envoyées dans le **channel** + **DM privé**'
            : 'Les alertes seront envoyées **SEULEMENT** dans le **channel**',
          inline: false
        },
        {
          name: '💡・Voir Plus',
          value: 'Utilise `/myconfig view` pour voir tous les paramètres',
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS | Configuration DM', iconURL: interaction.user.displayAvatarURL({ size: 256 }) });

    await interaction.editReply({ embeds: [embed] });
    console.log(`${enabled ? '✅ DM' : '❌ DM'} Alerts ${enabled ? 'activées' : 'désactivées'} pour ${interaction.guildId}`);
  } catch (error) {
    console.error('Erreur commande dm:', error);
    await interaction.editReply({
      content: '❌ Erreur lors de la modification des alertes DM'
    });
  }
}

