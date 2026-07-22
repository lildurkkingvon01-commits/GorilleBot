/**
 * Stats Collector - Collecte toutes les stats du bot en temps réel
 * Utilisé par l'API bot et le dashboard
 * 
 * Tracks:
 * - Commandes exécutées (par jour, semaine, mois)
 * - Actions de modération
 * - Violations auto-mod
 * - Erreurs
 * - Événements récents
 */

class StatsCollector {
  constructor() {
    this.stats = {
      commands: {},        // { '/cmd': { today: 5, week: 10, month: 20, ... } }
      moderation: {        // { warn: [], kick: [], ban: [], mute: [] }
        warns: [],
        kicks: [],
        bans: [],
        mutes: [],
      },
      automod: {           // { flood: [], spam: [], mentions: [], invites: [], keywords: [] }
        flood: [],
        spam: [],
        mentions: [],
        invites: [],
        keywords: [],
      },
      events: [],          // Événements récents
      errors: [],          // Erreurs récentes
    };

    this.startTime = Date.now();
    
    // Track timestamps for daily/weekly/monthly reset
    this.lastResetTime = Date.now();
    this.resetDay = new Date(Date.now()).toISOString().split('T')[0];
    this.resetWeek = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    this.resetMonth = new Date(Date.now()).getMonth();
    
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup chaque minute
    this.resetInterval = setInterval(() => this.checkAndResetCounters(), 3600000); // Vérif toutes les heures
  }

  /**
   * Enregistrer une exécution de commande
   */
  trackCommand(commandName, userId, guildId) {
    const key = `/${commandName}`;
    
    if (!this.stats.commands[key]) {
      this.stats.commands[key] = { today: 0, week: 0, month: 0 };
    }

    this.stats.commands[key].today++;
    this.stats.commands[key].week++;
    this.stats.commands[key].month++;

    // Logger aussi dans events
    this.trackEvent('command_executed', {
      command: commandName,
      userId,
      guildId,
      timestamp: Date.now(),
    });
  }

  /**
   * Enregistrer une action de modération
   */
  trackModeration(actionType, userId, guildId, reason = '') {
    const action = {
      type: actionType,
      userId,
      guildId,
      reason,
      timestamp: Date.now(),
    };

    if (actionType === 'warn') {
      this.stats.moderation.warns.push(action);
    } else if (actionType === 'kick') {
      this.stats.moderation.kicks.push(action);
    } else if (actionType === 'ban') {
      this.stats.moderation.bans.push(action);
    } else if (actionType === 'mute') {
      this.stats.moderation.mutes.push(action);
    }

    this.trackEvent('moderation_action', action);
  }

  /**
   * Enregistrer une violation auto-mod
   */
  trackAutomodViolation(violationType, userId, guildId, action = '') {
    const violation = {
      type: violationType,
      userId,
      guildId,
      action,
      timestamp: Date.now(),
    };

    if (violationType === 'flood') {
      this.stats.automod.flood.push(violation);
    } else if (violationType === 'spam') {
      this.stats.automod.spam.push(violation);
    } else if (violationType === 'mentions') {
      this.stats.automod.mentions.push(violation);
    } else if (violationType === 'invites') {
      this.stats.automod.invites.push(violation);
    } else if (violationType === 'keywords') {
      this.stats.automod.keywords.push(violation);
    }

    this.trackEvent('automod_violation', violation);
  }

  /**
   * Enregistrer un événement générique
   */
  trackEvent(eventType, details) {
    const event = {
      type: eventType,
      details,
      timestamp: Date.now(),
    };

    this.stats.events.push(event);

    // Garder seulement les 1000 derniers événements
    if (this.stats.events.length > 1000) {
      this.stats.events = this.stats.events.slice(-1000);
    }
  }

  /**
   * Enregistrer une erreur
   */
  trackError(errorMessage, context = {}) {
    const error = {
      message: errorMessage,
      context,
      timestamp: Date.now(),
    };

    this.stats.errors.push(error);

    // Garder seulement les 100 derniers erreurs
    if (this.stats.errors.length > 100) {
      this.stats.errors = this.stats.errors.slice(-100);
    }

    this.trackEvent('error', error);
  }

  /**
   * Récupérer les commandes exécutées aujourd'hui
   */
  getCommandsToday() {
    return Object.values(this.stats.commands).reduce((sum, cmd) => sum + cmd.today, 0);
  }

  /**
   * Récupérer les actions de modération aujourd'hui
   */
  getModActionsToday() {
    const oneDay = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const today = [
      ...this.stats.moderation.warns,
      ...this.stats.moderation.kicks,
      ...this.stats.moderation.bans,
      ...this.stats.moderation.mutes,
    ].filter(a => now - a.timestamp < oneDay);
    
    return today.length;
  }

  /**
   * Récupérer les violations auto-mod aujourd'hui
   */
  getAutomodViolationsToday() {
    const oneDay = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const today = [
      ...this.stats.automod.flood,
      ...this.stats.automod.spam,
      ...this.stats.automod.mentions,
      ...this.stats.automod.invites,
      ...this.stats.automod.keywords,
    ].filter(v => now - v.timestamp < oneDay);
    
    return today.length;
  }

  /**
   * Récupérer les top commandes sur une période
   */
  getTopCommands(period = 'day') {
    const entries = Object.entries(this.stats.commands)
      .map(([cmd, stats]) => ({
        name: cmd,
        count: stats[period] || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return entries;
  }

  /**
   * Récupérer les événements récents
   */
  getRecentEvents(limit = 20) {
    return this.stats.events.slice(-limit).reverse();
  }

  /**
   * Récupérer les erreurs récentes
   */
  getRecentErrors(limit = 10) {
    return this.stats.errors.slice(-limit).reverse();
  }

  /**
   * Récupérer les stats de modération sur une période
   */
  getModStats(period = 'day') {
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;
    
    let timeFactor;
    if (period === 'day') timeFactor = oneDay;
    else if (period === 'week') timeFactor = oneWeek;
    else if (period === 'month') timeFactor = oneMonth;

    const now = Date.now();
    const filtered = [
      ...this.stats.moderation.warns,
      ...this.stats.moderation.kicks,
      ...this.stats.moderation.bans,
      ...this.stats.moderation.mutes,
    ].filter(a => now - a.timestamp < timeFactor);

    return {
      warns: filtered.filter(a => a.type === 'warn').length,
      kicks: filtered.filter(a => a.type === 'kick').length,
      bans: filtered.filter(a => a.type === 'ban').length,
      mutes: filtered.filter(a => a.type === 'mute').length,
    };
  }

  /**
   * Récupérer les stats auto-mod sur une période
   */
  getAutomodStats(period = 'day') {
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;
    
    let timeFactor;
    if (period === 'day') timeFactor = oneDay;
    else if (period === 'week') timeFactor = oneWeek;
    else if (period === 'month') timeFactor = oneMonth;

    const now = Date.now();
    const filtered = [
      ...this.stats.automod.flood,
      ...this.stats.automod.spam,
      ...this.stats.automod.mentions,
      ...this.stats.automod.invites,
      ...this.stats.automod.keywords,
    ].filter(v => now - v.timestamp < timeFactor);

    return {
      flood: filtered.filter(v => v.type === 'flood').length,
      spam: filtered.filter(v => v.type === 'spam').length,
      mentions: filtered.filter(v => v.type === 'mentions').length,
      invites: filtered.filter(v => v.type === 'invites').length,
      keywords: filtered.filter(v => v.type === 'keywords').length,
    };
  }

  /**
   * Nettoyer les données anciennes
   */
  cleanup() {
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Nettoyer moderation (garder 1 mois)
    Object.keys(this.stats.moderation).forEach(key => {
      this.stats.moderation[key] = this.stats.moderation[key].filter(
        a => now - a.timestamp < oneMonth
      );
    });

    // Nettoyer automod (garder 1 mois)
    Object.keys(this.stats.automod).forEach(key => {
      this.stats.automod[key] = this.stats.automod[key].filter(
        v => now - v.timestamp < oneMonth
      );
    });

    // Nettoyer events (garder 100)
    if (this.stats.events.length > 100) {
      this.stats.events = this.stats.events.slice(-100);
    }

    // Nettoyer errors (garder 50)
    if (this.stats.errors.length > 50) {
      this.stats.errors = this.stats.errors.slice(-50);
    }
  }

  /**
   * Vérifier et réinitialiser les compteurs si nouveau jour/semaine/mois
   */
  checkAndResetCounters() {
    const now = Date.now();
    const today = new Date(now).toISOString().split('T')[0];
    const week = Math.floor(now / (7 * 24 * 60 * 60 * 1000));
    const month = new Date(now).getMonth();

    // Reset daily counters if new day
    if (today !== this.resetDay) {
      this.resetDailyStats();
      this.resetDay = today;
    }

    // Reset weekly counters if new week
    if (week !== this.resetWeek) {
      this.resetWeeklyStats();
      this.resetWeek = week;
    }

    // Reset monthly counters if new month
    if (month !== this.resetMonth) {
      this.resetMonthlyStats();
      this.resetMonth = month;
    }
  }

  /**
   * Réinitialiser toutes les stats (à minuit)
   */
  resetDailyStats() {
    Object.keys(this.stats.commands).forEach(cmd => {
      this.stats.commands[cmd].today = 0;
    });
    console.log('[StatsCollector] Daily stats reset');
  }

  /**
   * Réinitialiser les stats hebdo (à minuit dimanche)
   */
  resetWeeklyStats() {
    Object.keys(this.stats.commands).forEach(cmd => {
      this.stats.commands[cmd].week = 0;
    });
    console.log('[StatsCollector] Weekly stats reset');
  }

  /**
   * Réinitialiser les stats mensuelles (1er du mois)
   */
  resetMonthlyStats() {
    Object.keys(this.stats.commands).forEach(cmd => {
      this.stats.commands[cmd].month = 0;
    });
    console.log('[StatsCollector] Monthly stats reset');
  }

  /**
   * Arrêter le collector
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    clearInterval(this.resetInterval);
  }
}

export default StatsCollector;
