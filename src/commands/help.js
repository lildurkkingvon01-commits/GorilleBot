import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('📚 Affiche la liste des commandes disponibles du bot');

export async function execute(interaction) {
  // Vérification de permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ Vous devez être **administrateur** pour utiliser cette commande !'
    });
  }

  try {
    // ===== EMBED 1: BIENVENUE & RESTRICTIONS =====
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setAuthor({
        name: '🚨 BIENVENUE SUR GORILLE™ BOTS',
        iconURL: interaction.client.user.displayAvatarURL({ size: 256 })
      })
      .setTitle('⚠️ RESTRICTIONS IMPORTANTES')
      .setDescription('**⚠️・TOUTES les commandes du bot NÉCESSITENT les permissions ADMINISTRATEUR**\n\nSeul les administrateurs du serveur peuvent utiliser ce bot.')
      .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS', iconURL: interaction.client.user.displayAvatarURL({ size: 256 }) });

    // ===== EMBED 2: GESTION DES JOUEURS =====
    const playersEmbed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setAuthor({
        name: '👤 GESTION DES JOUEURS',
        iconURL: interaction.client.user.displayAvatarURL({ size: 256 })
      })
      .setDescription('Commandes pour ajouter, gérer et afficher les joueurs')
      .addFields(
        {
          name: '💾・ `/save <url> [nom]`',
          value: 'Sauvegarde une URL Pactify\n*Auto-détecte: Nom, Grade, Power, Faction, Rôle*',
          inline: false
        },
        {
          name: '📊・ `/info <nom>`',
          value: 'Affiche le profil complet du joueur\n*Design coulé par grade + Boutons interactifs (Profil, Surveillance)*',
          inline: false
        },
        {
          name: '✨・ `/addplayer <nom> <membre>`',
          value: 'Ajoute un joueur sauvegardé à la surveillance\n*Avec autocomplete pour sélectionner le joueur*',
          inline: false
        },
        {
          name: '🗑️・ `/deletesave <nom>`',
          value: 'Supprime un joueur de la liste des sauvegardés',
          inline: false
        },
        {
          name: '👤・ `/removeplayer`',
          value: 'Retire un joueur de la surveillance du serveur',
          inline: false
        },
        {
          name: '📋 `/listplayers`',
          value: 'Affiche TOUS les joueurs surveillés triés par inactivité',
          inline: false
        },
        {
          name: '📝・ `/savelist`',
          value: 'Affiche TOUS les joueurs enregistrés avec pagination\n*Format: Pseudo + Lien clickable (20 per page)*',
          inline: false
        }
      );

    // ===== EMBED 3: GESTION DES FACTIONS =====
    const factionsEmbed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setAuthor({
        name: '🏰 GESTION DES FACTIONS',
        iconURL: interaction.client.user.displayAvatarURL({ size: 256 })
      })
      .setDescription('Commandes pour ajouter, gérer et afficher les factions')
      .addFields(
        {
          name: '💾・ `/fsave <url> [nom]`',
          value: 'Sauvegarde une URL Pactify de faction\n*Auto-détecte: Nom, Power, Membres, Claims*',
          inline: false
        },
        {
          name: '📊・ `/f info <nom>`',
          value: 'Affiche le profil complet de la faction\n*Design coulé orange + Boutons interactifs (Profil)*',
          inline: false
        },
        {
          name: '🗑️・ `/fdeletesave <nom>`',
          value: 'Supprime une faction de la liste des sauvegardées',
          inline: false
        },
        {
          name: '📝・ `/fsavelist`',
          value: 'Affiche TOUTES les factions enregistrées avec pagination\n*Format: Nom + Lien clickable (20 per page)*',
          inline: false
        }
      );

    // ===== EMBED 4: CONFIGURATION =====
    const configEmbed = new EmbedBuilder()
      .setColor(0xD4AF37)
      .setAuthor({
        name: '⚙️ CONFIGURATION DU SERVEUR',
        iconURL: interaction.client.user.displayAvatarURL({ size: 256 })
      })
      .setDescription('Commandes pour configurer le comportement du bot')
      .addFields(
        {
          name: '🔧・ `/config [channel] [dm]`',
          value: 'Configure le channel des alertes et les alertes DM',
          inline: false
        },
        {
          name: '👁️・ `/myconfig <view|reset>`',
          value: 'Affiche ou réinitialise la configuration actuelle',
          inline: false
        },
        {
          name: '📊・ `/seuil <set|view> [temps]`',
          value: 'Configure le seuil avec des jours/heures (ex: 3d, 12h, 1d 6h)',
          inline: false
        },
        {
          name: '⏱️・ `/frequency <set|view> [minutes]`',
          value: 'Configure la fréquence de vérification (5-1440 min)',
          inline: false
        },
        {
          name: '📬・ `/dm <statut>`',
          value: 'Activer ou désactiver les alertes DM pour les joueurs',
          inline: false
        }
      );

    // ===== EMBED 5: GESTION DES PERMISSIONS =====
    const permsEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({
        name: '🔐 GESTION DES PERMISSIONS',
        iconURL: interaction.client.user.displayAvatarURL({ size: 256 })
      })
      .setDescription('Commandes pour configurer les permissions des commandes par serveur')
      .addFields(
        {
          name: '⚙️・ `/setperms view`',
          value: '**[Créateur seulement]** Affiche le panneau de gestion des permissions\n*Ajoute/Retire des rôles ou utilisateurs pour chaque commande*',
          inline: false
        },
        {
          name: '🔄・ `/setperms reset [commande]`',
          value: '**[Créateur seulement]** Réinitialise les permissions\n*Laisse vide pour réinitialiser TOUTES les commandes*',
          inline: false
        },
        {
          name: '📋・ `/myperm`',
          value: '**[Créateur seulement]** Affiche les permissions configurées\n*Vue globale de qui peut faire quoi sur le serveur*',
          inline: false
        }
      );

    // ===== EMBED 6: STATISTIQUES & OUTILS =====
    const toolsEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({
        name: '📊 STATISTIQUES & OUTILS',
        iconURL: interaction.client.user.displayAvatarURL({ size: 256 })
      })
      .setDescription('Commandes pour surveiller le bot et tester les alertes')
      .addFields(
        {
          name: '📜・ `/history <joueur>`',
          value: 'Affiche l\'historique complet d\'inactivité d\'un joueur\n*♻️ NEW - Timeline avec dates, statuts et durées*',
          inline: false
        },
        {
          name: '🟢・ `/serverstatus`',
          value: 'Affiche l\'uptime et le statut du bot',
          inline: false
        }
      );

    // ===== EMBED 7: PIED DE PAGE =====
    const footerEmbed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('📚・ AIDE & INFOS')
      .addFields(
        {
          name: '❓・ Besoin d\'aide ?',
          value: 'Utilise `/help` à tout moment pour revenir à ce message',
          inline: false
        },
        {
          name: '⚡・ Actions Rapides',
          value: '`/addplayer` → Ajoute un joueur\n`/fsave` → Sauvegarde une faction\n`/listplayers` → Voit les joueurs',
          inline: false
        }
      )
      .setFooter({ text: '✨ Créé par LeBelge_e | Gorille™・BOTS | Version 1.0.1', iconURL: interaction.user.displayAvatarURL({ size: 256 }) })
      .setTimestamp();

    await interaction.editReply({ embeds: [welcomeEmbed, playersEmbed, factionsEmbed, configEmbed, permsEmbed, toolsEmbed, footerEmbed] });
  } catch (error) {
    console.error('Erreur help:', error);
    await interaction.editReply({
      content: '❌ Une erreur est survenue',
      ephemeral: true
    });
  }
}

