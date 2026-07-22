import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getPermissionsForCommand, setCommandPermission, removeCommandPermission, resetCommandPermissions, setUserPermission, removeUserPermission, getPermissionsByType } from '../utils/database.js';
import { checkRateLimit, logAudit, validateRoleId, validateUserInGuild } from '../utils/security.js';
import { logToChannelAsync, createLogEmbed } from '../utils/adminLogs.js';
import { trackUpdate } from '../utils/tracking.js';

const ALL_COMMANDS = [
  'addplayer', 'removeplayer', 'listplayers', 'config', 'myconfig', 'seuil', 'frequency',
  'save', 'deletesave', 'savelist', 'fsave', 'fdeletesave', 'fsavelist',
  'info', 'history', 'f', 'serverstatus', 'dm', 'help'
];

// Fonction helper pour les réponses
async function replyEphemeral(interaction, options) {
  const msg = await interaction.editReply(options);
  return msg;
}
export const data = new SlashCommandBuilder()
  .setName('setperms')
  .setDescription('Gérer les permissions des commandes par serveur')
  .addSubcommand(sub =>
    sub.setName('view')
      .setDescription('Voir le panneau de gestion des permissions')
  )
  .addSubcommand(sub =>
    sub.setName('reset')
      .setDescription('Réinitialiser les permissions (par défaut = Admin)')
      .addStringOption(opt =>
        opt.setName('commande')
          .setDescription('La commande à réinitialiser (laisse vide pour toutes)')
          .setRequired(false)
      )
  );

export async function execute(interaction) {
  // Seul le créateur du serveur peut utiliser cette commande
  if (interaction.member.id !== interaction.guild.ownerId) {
    logAudit(interaction.guildId, interaction.user.id, 'SETPERMS_UNAUTHORIZED', {
      status: 'blocked',
      errorMsg: 'Non propriétaire'
    });
    
    logToChannelAsync('security', createLogEmbed(
      'Tentative d\'Accès Non Autorisée',
      `${interaction.user.username} a tenté d'accéder à \`/setperms\` sans permission sur **${interaction.guild.name}**`,
      'security'
    ));
    
    await replyEphemeral(interaction, {
      content: '❌・Seul le créateur du serveur peut gérer les permissions!'
    });
    return;
  }

  // Rate limiting: max 10 requêtes par minute
  const rateLimit = checkRateLimit(interaction.user.id);
  if (!rateLimit.allowed) {
    logAudit(interaction.guildId, interaction.user.id, 'RATE_LIMIT_EXCEEDED', {
      status: 'blocked',
      errorMsg: `Trop de requêtes. Réessaie dans ${rateLimit.resetIn}s`
    });
    await replyEphemeral(interaction, {
      content: `⏱️ Trop de requêtes! Réessaie dans ${rateLimit.resetIn}s`
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (subcommand === 'view') {
    // Récupérer les permissions pour toutes les commandes
    const commandsWithPerms = [];
    const commandsWithoutPerms = [];

    for (const cmd of ALL_COMMANDS) {
      const perms = await getPermissionsForCommand(guildId, cmd);
      if (perms.roles.length > 0 || perms.users.length > 0) {
        commandsWithPerms.push({ cmd, perms });
      } else {
        commandsWithoutPerms.push(cmd);
      }
    }

    const fieldsArray = [];

    // Commandes avec permissions configurées
    if (commandsWithPerms.length > 0) {
      const withPermsText = commandsWithPerms.map(item => {
        const rolesText = item.perms.roles.length > 0 ? item.perms.roles.map(id => `<@&${id}>`).join(', ') : '';
        const usersText = item.perms.users.length > 0 ? item.perms.users.map(id => `<@${id}>`).join(', ') : '';
        const allPerms = [];
        if (rolesText) allPerms.push(rolesText);
        if (usersText) allPerms.push(usersText);
        return `┃ \`/${item.cmd}\` → ${allPerms.join(' + ')}`;
      }).join('\n');
      fieldsArray.push({
        name: '🔒・Commandes avec permissions',
        value: withPermsText || 'Aucune',
        inline: false
      });
    }

    // Commandes sans permissions configurées
    if (commandsWithoutPerms.length > 0) {
      const withoutPermsText = commandsWithoutPerms.map(c => `┃ \`/${c}\``).join('\n');
      fieldsArray.push({
        name: '🔓・Commandes par défaut (Admin)',
        value: withoutPermsText || 'Aucune',
        inline: false
      });
    }

    const mainEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🔐・GESTION DES PERMISSIONS')
      .setDescription('> 🎮 Sélectionne une commande pour gérer ses permissions\n> ⚙️ Ajoute/Retire des rôles ou utilisateurs')
      .addFields(...fieldsArray)
      .setThumbnail(interaction.guild.iconURL({ size: 256 }))
      .setFooter({ text: '✨・Créé par LeBelge_e | Gorille™・BOTS' })
      .setTimestamp();

    const commandSelect = new StringSelectMenuBuilder()
      .setCustomId('perms_select_command')
      .setPlaceholder('🔍・Sélectionne une commande...')
      .addOptions(
        ALL_COMMANDS.map(cmd => ({
          label: `/${cmd}`,
          value: cmd,
          emoji: '⚙️'
        }))
      );

    const row = new ActionRowBuilder().addComponents(commandSelect);

    const msg = await replyEphemeral(interaction, {
      embeds: [mainEmbed],
      components: [row]
    });
    return;
  } else if (subcommand === 'reset') {
    const commandName = interaction.options.getString('commande');

    if (!commandName) {
      for (const cmd of ALL_COMMANDS) {
        await resetCommandPermissions(guildId, cmd);
      }
      await replyEphemeral(interaction, {
        content: '✅・**Toutes les permissions ont été réinitialisées!**'
      });
    } else {
      if (!ALL_COMMANDS.includes(commandName)) {
        await replyEphemeral(interaction, {
          content: `❌・La commande \`${commandName}\` n'existe pas.`
        });
        return;
      }
      await resetCommandPermissions(guildId, commandName);
      await interaction.editReply({
        content: `✅・Les permissions de \`/${commandName}\` ont été réinitialisées!`,
        flags: 64
      });
    }
  }
}

// Gestionnaire d'interactions à appeler depuis index.js
export async function handleComponentInteraction(interaction) {
  if (!interaction.inGuild()) return;
  
  const guildId = interaction.guildId;

  try {
    if (interaction.isStringSelectMenu() && interaction.customId === 'perms_select_command') {
      const commandName = interaction.values[0];
      const perms = await getPermissionsForCommand(guildId, commandName);

      let permText = '';
      if (perms.roles.length > 0) {
        permText += '👥・**Rôles:**\n' + perms.roles.map(id => `<@&${id}>`).join('\n') + '\n\n';
      }
      if (perms.users.length > 0) {
        permText += '👤・**Utilisateurs:**\n' + perms.users.map(id => `<@${id}>`).join('\n') + '\n\n';
      }
      if (perms.roles.length === 0 && perms.users.length === 0) {
        permText = '👑・Admin (par défaut)';
      }

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`⚙️・/${commandName}`)
        .addFields({ name: '📋・Permissions', value: permText || '(aucune)', inline: false })
        .setFooter({ text: commandName });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`perms_add_role_${commandName}`).setLabel('➕・Rôle').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`perms_add_user_${commandName}`).setLabel('👤・User').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`perms_remove_${commandName}`).setLabel('➖・Retirer').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`perms_reset_${commandName}`).setLabel('🔄・Reset').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('perms_back').setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({ embeds: [embed], components: [buttons] });
    }

    else if (interaction.isButton()) {
      const customId = interaction.customId;

      if (customId === 'perms_back') {
        // Récupérer les permissions pour toutes les commandes
        const commandsWithPerms = [];
        const commandsWithoutPerms = [];

        for (const cmd of ALL_COMMANDS) {
          const perms = await getPermissionsForCommand(guildId, cmd);
          if (perms.roles.length > 0 || perms.users.length > 0) {
            commandsWithPerms.push({ cmd, perms });
          } else {
            commandsWithoutPerms.push(cmd);
          }
        }

        const fieldsArray = [];

        // Commandes avec permissions configurées
        if (commandsWithPerms.length > 0) {
          const withPermsText = commandsWithPerms.map(item => {
            const rolesText = item.perms.roles.length > 0 ? item.perms.roles.map(id => `<@&${id}>`).join(', ') : '';
            const usersText = item.perms.users.length > 0 ? item.perms.users.map(id => `<@${id}>`).join(', ') : '';
            const allPerms = [];
            if (rolesText) allPerms.push(rolesText);
            if (usersText) allPerms.push(usersText);
            return `┃ \`/${item.cmd}\` → ${allPerms.join(' + ')}`;
          }).join('\n');
          fieldsArray.push({
            name: '🔒・Commandes avec permissions',
            value: withPermsText || 'Aucune',
            inline: false
          });
        }

        // Commandes sans permissions configurées
        if (commandsWithoutPerms.length > 0) {
          const withoutPermsText = commandsWithoutPerms.map(c => `┃ \`/${c}\``).join('\n');
          fieldsArray.push({
            name: '🔓・Commandes par défaut (Admin)',
            value: withoutPermsText || 'Aucune',
            inline: false
          });
        }

        const mainEmbed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle('🔐・GESTION DES PERMISSIONS')
          .setDescription('> 🎮 Sélectionne une commande pour gérer ses permissions\n> ⚙️ Ajoute/Retire des rôles ou utilisateurs')
          .addFields(...fieldsArray)
          .setFooter({ text: '✨・Créé par LeBelge_e | Gorille™・BOTS' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('perms_select_command')
            .setPlaceholder('🔍・Sélectionne une commande...')
            .addOptions(ALL_COMMANDS.map(cmd => ({ label: `/${cmd}`, value: cmd })))
        );

        await interaction.update({ embeds: [mainEmbed], components: [row] });
      }

      else if (customId.startsWith('perms_add_role_')) {
        const commandName = customId.replace('perms_add_role_', '');
        
        // Afficher le message d'attente
        const loadingEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle(`⚙️・/${commandName}`)
          .setDescription('⏳・Chargement des rôles...');
        
        await interaction.update({ embeds: [loadingEmbed], components: [] });
        
        const perms = await getPermissionsForCommand(guildId, commandName);
        const roles = Array.from(interaction.guild.roles.cache
          .filter(r => !r.managed && r.id !== interaction.guildId && !perms.roles.includes(r.id))
          .sort((a, b) => b.position - a.position)
          .values()).slice(0, 25);

        if (roles.length === 0) {
          const embed = new EmbedBuilder()
            .setColor(0xff9800)
            .setTitle(`⚙️・/${commandName}`)
            .setDescription('❌・Tous les rôles disponibles ont déjà been ajoutés.');

          const backButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`perms_back_to_${commandName}`).setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
          );

          await interaction.editReply({ embeds: [embed], components: [backButton] });
          return;
        }

        const roleSelect = new StringSelectMenuBuilder()
          .setCustomId(`perms_add_role_select_${commandName}`)
          .setPlaceholder('Ajouter un rôle...')
          .addOptions(roles.map(r => ({ label: r.name, value: r.id })));

        const backButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`perms_back_to_${commandName}`).setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
        );

        const row = new ActionRowBuilder().addComponents(roleSelect);

        await interaction.update({ components: [row, backButton] });
      }

      else if (customId.startsWith('perms_add_user_')) {
        const commandName = customId.replace('perms_add_user_', '');
        
        // Afficher le message d'attente
        const loadingEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle(`⚙️・/${commandName}`)
          .setDescription('⏳・Chargement des utilisateurs...');
        
        await interaction.update({ embeds: [loadingEmbed], components: [] });
        
        const perms = await getPermissionsForCommand(guildId, commandName);
        
        try {
          // Récupérer les membres avec timeout
          const fetchPromise = interaction.guild.members.fetch({ limit: 100 });
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fetch timeout après 5s')), 5000)
          );
          
          try {
            await Promise.race([fetchPromise, timeoutPromise]);
          } catch (fetchErr) {
            console.warn('[PERMS] Fetch échoué, utilise le cache:', fetchErr.message);
          }
          
          const members = Array.from(interaction.guild.members.cache
            .filter(m => !m.user.bot && !perms.users.includes(m.id))
            .sort((a, b) => a.user.username.localeCompare(b.user.username))
            .values()).slice(0, 25);

          if (members.length === 0) {
            const embed = new EmbedBuilder()
              .setColor(0xff9800)
              .setTitle(`⚙️・/${commandName}`)
              .setDescription('❌・Tous les utilisateurs disponibles ont déjà been ajoutés.');

            const backButton = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`perms_back_to_${commandName}`).setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({ embeds: [embed], components: [backButton] });
            return;
          }

          const userSelect = new StringSelectMenuBuilder()
            .setCustomId(`perms_add_user_select_${commandName}`)
            .setPlaceholder('Sélectionne un utilisateur...')
            .addOptions(members.map(m => ({
              label: m.user.username.substring(0, 100),
              value: m.id,
              description: `ID: ${m.id}`.substring(0, 100)
            })));

          const backButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`perms_back_to_${commandName}`).setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
          );

          const row = new ActionRowBuilder().addComponents(userSelect);
          await interaction.editReply({ components: [row, backButton] });
        } catch (err) {
          console.error('[PERMS ERROR - perms_add_user]:', err);
          const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('❌・Erreur')
            .setDescription(err.message);
          
          const backButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`perms_back_to_${commandName}`).setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
          );
          
          await interaction.editReply({ embeds: [embed], components: [backButton] });
        }
      }

      else if (customId.startsWith('perms_remove_')) {
        const commandName = customId.replace('perms_remove_', '');
        const perms = await getPermissionsForCommand(guildId, commandName);
        
        if (perms.roles.length === 0 && perms.users.length === 0) {
          const embed = new EmbedBuilder()
            .setColor(0xff9800)
            .setTitle(`⚙️・/${commandName}`)
            .setDescription('❌・Aucune permission personnalisée à retirer.');

          const backButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`perms_back_to_${commandName}`).setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
          );

          await interaction.update({ embeds: [embed], components: [backButton] });
          return;
        }

        const options = [];
        
        if (perms.roles.length > 0) {
          for (const roleId of perms.roles) {
            const role = interaction.guild.roles.cache.get(roleId);
            options.push({
              label: `Rôle: ${role?.name || 'Inconnu'}`,
              value: `remove_role_${roleId}`,
              description: `ID: ${roleId}`
            });
          }
        }

        if (perms.users.length > 0) {
          for (const userId of perms.users) {
            let userName = 'Inconnu';
            try {
              const user = await interaction.client.users.fetch(userId);
              userName = user.username;
            } catch (e) {}
            options.push({
              label: `User: ${userName}`,
              value: `remove_user_${userId}`,
              description: `ID: ${userId}`
            });
          }
        }

        const removeSelect = new StringSelectMenuBuilder()
          .setCustomId(`perms_remove_select_${commandName}`)
          .setPlaceholder('Sélectionne une permission à retirer...')
          .addOptions(options);

        const backButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`perms_back_to_${commandName}`).setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
        );

        const row = new ActionRowBuilder().addComponents(removeSelect);

        await interaction.update({ components: [row, backButton] });
      }

      else if (customId.startsWith('perms_reset_')) {
        const commandName = customId.replace('perms_reset_', '');
        await resetCommandPermissions(guildId, commandName);

        // Tracker le changement
        trackUpdate('Permission Update', `Permissions de \`/${commandName}\` réinitialisées (Admin uniquement)`, '🔄');

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle(`✅ Réinitialisé - ⚙️・/${commandName}`)
          .setDescription(`\`/${commandName}\` est maintenant par défaut (Admin uniquement).`)
          .addFields({ name: '📋・Permissions actuelles', value: '👑・Admin (par défaut)', inline: false })
          .setFooter({ text: commandName });

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`perms_add_role_${commandName}`).setLabel('➕・Rôle').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`perms_add_user_${commandName}`).setLabel('👤・User').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`perms_remove_${commandName}`).setLabel('➖・Retirer').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`perms_reset_${commandName}`).setLabel('🔄・Reset').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('perms_back').setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [buttons] });

        // Log pour permissions
        logToChannelAsync('permissions', createLogEmbed(
          'Permissions Réinitialisées',
          `${interaction.user.username} a réinitialisé les permissions pour \`/${commandName}\` sur **${interaction.guild.name}**`
        ));
      }

      else if (customId.startsWith('perms_back_to_')) {
        const commandName = customId.replace('perms_back_to_', '');
        const perms = await getPermissionsForCommand(guildId, commandName);

        let permText = '';
        if (perms.roles.length > 0) {
          permText += '👥・**Rôles:**\n' + perms.roles.map(id => `<@&${id}>`).join('\n') + '\n\n';
        }
        if (perms.users.length > 0) {
          permText += '👤・**Utilisateurs:**\n' + perms.users.map(id => `<@${id}>`).join('\n') + '\n\n';
        }
        if (perms.roles.length === 0 && perms.users.length === 0) {
          permText = '👑・Admin (par défaut)';
        }

        const embed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`⚙️・/${commandName}`)
          .addFields({ name: '📋・Permissions', value: permText || '(aucune)', inline: false })
          .setFooter({ text: commandName });

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`perms_add_role_${commandName}`).setLabel('➕・Rôle').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`perms_add_user_${commandName}`).setLabel('👤・User').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`perms_remove_${commandName}`).setLabel('➖・Retirer').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`perms_reset_${commandName}`).setLabel('🔄・Reset').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('perms_back').setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [buttons] });
      }
    }

    else if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      if (customId.startsWith('perms_add_role_select_')) {
        const commandName = customId.replace('perms_add_role_select_', '');
        const roleId = interaction.values[0];

        await setCommandPermission(guildId, commandName, roleId);
        const role = interaction.guild.roles.cache.get(roleId);
        const perms = await getPermissionsForCommand(guildId, commandName);

        // Tracker le changement
        trackUpdate('Permission Update', `Rôle **${role?.name || 'Inconnu'}** ajouté à \`/${commandName}\``, '👥');

        // Créer l'embed mis à jour
        let permText = '';
        if (perms.roles.length > 0) {
          permText += '👥・**Rôles:**\n' + perms.roles.map(id => `<@&${id}>`).join('\n') + '\n\n';
        }
        if (perms.users.length > 0) {
          permText += '👤・**Utilisateurs:**\n' + perms.users.map(id => `<@${id}>`).join('\n') + '\n\n';
        }
        if (perms.roles.length === 0 && perms.users.length === 0) {
          permText = '👑・Admin (par défaut)';
        }

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle(`✅ Rôle ajouté - ⚙️・/${commandName}`)
          .setDescription(`${role?.name || 'Rôle'} peut maintenant utiliser \`/${commandName}\``)
          .addFields({ name: '📋・Permissions actuelles', value: permText || '(aucune)', inline: false })
          .setFooter({ text: commandName });

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`perms_add_role_${commandName}`).setLabel('➕・Rôle').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`perms_add_user_${commandName}`).setLabel('👤・User').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`perms_remove_${commandName}`).setLabel('➖・Retirer').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`perms_reset_${commandName}`).setLabel('🔄・Reset').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('perms_back').setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [buttons] });

        // Log pour permissions
        logToChannelAsync('permissions', createLogEmbed(
          'Permission de Rôle Ajoutée',
          `${interaction.user.username} a ajouté le rôle **${role?.name || 'Inconnu'}** pour \`/${commandName}\` sur **${interaction.guild.name}**`
        ));
      }

      else if (customId.startsWith('perms_add_user_select_')) {
        const commandName = customId.replace('perms_add_user_select_', '');
        const userId = interaction.values[0];

        // Valider l'ID avant d'ajouter
        if (!await validateUserInGuild(guildId, userId, interaction)) {
          logAudit(guildId, interaction.user.id, 'PERM_ADD_USER_INVALID', {
            commandName,
            targetId: userId,
            status: 'failed',
            errorMsg: 'User ID invalide'
          });
          const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(`⚙️・/${commandName}`)
            .setDescription('❌ ID utilisateur invalide');

          const backButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`perms_back_to_${commandName}`).setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
          );

          await interaction.update({ embeds: [embed], components: [backButton] });
          return;
        }

        await setUserPermission(guildId, commandName, userId);
        const perms = await getPermissionsForCommand(guildId, commandName);
        
        // Tracker le changement
        trackUpdate('Permission Update', `Utilisateur ajouté à \`/${commandName}\``, '👤');
        logAudit(guildId, interaction.user.id, 'PERM_ADD_USER', {
          commandName,
          targetId: userId,
          targetType: 'USER',
          status: 'success'
        });
        
        let userName = 'Utilisateur';
        try {
          const user = await interaction.client.users.fetch(userId);
          userName = user.username;
        } catch (e) {}

        // Créer l'embed mis à jour
        let permText = '';
        if (perms.roles.length > 0) {
          permText += '👥・**Rôles:**\n' + perms.roles.map(id => `<@&${id}>`).join('\n') + '\n\n';
        }
        if (perms.users.length > 0) {
          permText += '👤・**Utilisateurs:**\n' + perms.users.map(id => `<@${id}>`).join('\n') + '\n\n';
        }
        if (perms.roles.length === 0 && perms.users.length === 0) {
          permText = '👑・Admin (par défaut)';
        }

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle(`✅ Utilisateur ajouté - ⚙️・/${commandName}`)
          .setDescription(`**${userName}** peut maintenant utiliser \`/${commandName}\`\n*(Seul cet utilisateur, pas les admins)*`)
          .addFields({ name: '📋・Permissions actuelles', value: permText || '(aucune)', inline: false })
          .setFooter({ text: commandName });

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`perms_add_role_${commandName}`).setLabel('➕・Rôle').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`perms_add_user_${commandName}`).setLabel('👤・User').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`perms_remove_${commandName}`).setLabel('➖・Retirer').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`perms_reset_${commandName}`).setLabel('🔄・Reset').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('perms_back').setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [buttons] });

        // Log pour permissions
        logToChannelAsync('permissions', createLogEmbed(
          'Permission d\'Utilisateur Ajoutée',
          `${interaction.user.username} a ajouté l'utilisateur **${userName}** pour \`/${commandName}\` sur **${interaction.guild.name}**`
        ));
      }

      else if (customId.startsWith('perms_remove_select_')) {
        const commandName = customId.replace('perms_remove_select_', '');
        const value = interaction.values[0];
        const perms = await getPermissionsForCommand(guildId, commandName);

        if (value.startsWith('remove_role_')) {
          const roleId = value.replace('remove_role_', '');
          await removeCommandPermission(guildId, commandName, roleId);
          const role = interaction.guild.roles.cache.get(roleId);

          // Tracker le changement
          trackUpdate('Permission Update', `Rôle **${role?.name || 'Inconnu'}** retiré de \`/${commandName}\``, '👥');
          
          // Créer l'embed mis à jour
          let permText = '';
          if (perms.roles.length > 0) {
            permText += '👥・**Rôles:**\n' + perms.roles.filter(id => id !== roleId).map(id => `<@&${id}>`).join('\n') + '\n\n';
          }
          if (perms.users.length > 0) {
            permText += '👤・**Utilisateurs:**\n' + perms.users.map(id => `<@${id}>`).join('\n') + '\n\n';
          }
          if (perms.roles.filter(id => id !== roleId).length === 0 && perms.users.length === 0) {
            permText = '👑・Admin (par défaut)';
          }

          const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(`✅ Rôle retiré - ⚙️・/${commandName}`)
            .setDescription(`${role?.name || 'Rôle'} ne peut plus utiliser \`/${commandName}\``)
            .addFields({ name: '📋・Permissions actuelles', value: permText || '(aucune)', inline: false })
            .setFooter({ text: commandName });

          const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`perms_add_role_${commandName}`).setLabel('➕・Rôle').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`perms_add_user_${commandName}`).setLabel('👤・User').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`perms_remove_${commandName}`).setLabel('➖・Retirer').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`perms_reset_${commandName}`).setLabel('🔄・Reset').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('perms_back').setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
          );

          await interaction.update({ embeds: [embed], components: [buttons] });

          // Log pour permissions
          logToChannelAsync('permissions', createLogEmbed(
            'Permission de Rôle Supprimée',
            `${interaction.user.username} a retiré le rôle **${role?.name || 'Inconnu'}** pour \`/${commandName}\` sur **${interaction.guild.name}**`
          ));
        } 
        else if (value.startsWith('remove_user_')) {
          const userId = value.replace('remove_user_', '');
          await removeUserPermission(guildId, commandName, userId);

          // Tracker le changement
          trackUpdate('Permission Update', `Utilisateur retiré de \`/${commandName}\``, '👤');
          let userName = 'Utilisateur';
          try {
            const user = await interaction.client.users.fetch(userId);
            userName = user.username;
          } catch (e) {}

          // Créer l'embed mis à jour
          let permText = '';
          if (perms.roles.length > 0) {
            permText += '👥・**Rôles:**\n' + perms.roles.map(id => `<@&${id}>`).join('\n') + '\n\n';
          }
          if (perms.users.length > 0) {
            permText += '👤・**Utilisateurs:**\n' + perms.users.filter(id => id !== userId).map(id => `<@${id}>`).join('\n') + '\n\n';
          }
          if (perms.roles.length === 0 && perms.users.filter(id => id !== userId).length === 0) {
            permText = '👑・Admin (par défaut)';
          }

          const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(`✅ Utilisateur retiré - ⚙️・/${commandName}`)
            .setDescription(`**${userName}** ne peut plus utiliser \`/${commandName}\``)
            .addFields({ name: '📋・Permissions actuelles', value: permText || '(aucune)', inline: false })
            .setFooter({ text: commandName });

          const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`perms_add_role_${commandName}`).setLabel('➕・Rôle').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`perms_add_user_${commandName}`).setLabel('👤・User').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`perms_remove_${commandName}`).setLabel('➖・Retirer').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`perms_reset_${commandName}`).setLabel('🔄・Reset').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('perms_back').setLabel('⬅️・Retour').setStyle(ButtonStyle.Secondary)
          );

          await interaction.update({ embeds: [embed], components: [buttons] });

          // Log pour permissions
          logToChannelAsync('permissions', createLogEmbed(
            'Permission d\'Utilisateur Supprimée',
            `${interaction.user.username} a retiré l'utilisateur **${userName}** pour \`/${commandName}\` sur **${interaction.guild.name}**`
          ));
        }
      }
    }

    else if (interaction.isModalSubmit()) {
      // Pas de modales utilisées actuellement
    }
  } catch (error) {
    console.error('Erreur perms.js:', error);
    await interaction.reply({
      content: `❌・Erreur: ${error.message}`,
      flags: 64
    }).catch(() => {});
  }
}

