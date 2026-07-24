import db from './postgres.js';

export async function getPlayersByGuild(guildId) { try { return await db.any(`SELECT id, discord_id AS "discordId", username, username AS "playerName", faction AS "playerFaction", url, guild_id AS "guildId", player_status AS "playerStatus", last_check_time AS "lastCheckTime", days_inactive AS "daysInactive", created_at AS "createdAt", updated_at AS "updatedAt" FROM players WHERE guild_id = $1`, [guildId]); } catch (e) { console.error('[DB ERROR] getPlayersByGuild failed', { guildId, message: e.message, code: e.code }); return []; } }
export async function getPlayerById(playerId) { try { return await db.oneOrNone(`SELECT id, discord_id AS "discordId", username, username AS "playerName", faction AS "playerFaction", url, guild_id AS "guildId", player_status AS "playerStatus", last_check_time AS "lastCheckTime", days_inactive AS "daysInactive", created_at AS "createdAt", updated_at AS "updatedAt" FROM players WHERE id = $1`, [playerId]); } catch (e) { console.error('[DB ERROR] getPlayerById failed', { playerId, message: e.message, code: e.code }); return null; } }
export async function addPlayer(discordId, username, faction, guildId) {
  if (!guildId) {
    console.warn('[DB] addPlayer called without guildId', { discordId, username, faction });
    try {
      const { default: OrphanLogService } = await import('../services/orphanLogService.js');
      OrphanLogService.record('addPlayer', { discordId, username, faction });
    } catch (e) {
      console.error('[DB] Failed to record orphan attempt', e?.message || e);
    }
    return null;
  }
  try {
    return await db.one('INSERT INTO players (discord_id, username, faction, guild_id) VALUES ($1, $2, $3, $4) RETURNING *', [discordId, username, faction, guildId]);
  } catch (e) {
    return null;
  }
}

export async function addPlayerWithUrl(discordId, username, url, faction, guildId, daysInactive = 0) {
  if (!guildId) {
    console.warn('[DB] addPlayerWithUrl called without guildId', { discordId, username, url, faction });
    try {
      const { default: OrphanLogService } = await import('../services/orphanLogService.js');
      OrphanLogService.record('addPlayerWithUrl', { discordId, username, url, faction });
    } catch (e) {
      console.error('[DB] Failed to record orphan attempt', e?.message || e);
    }
    return null;
  }
  try {
    return await db.one('INSERT INTO players (discord_id, username, url, faction, guild_id, days_inactive, last_check_time) VALUES ($1, $2, $3, $4, $5, $6, NOW()) ON CONFLICT (discord_id, guild_id) DO UPDATE SET username = EXCLUDED.username, url = EXCLUDED.url, faction = EXCLUDED.faction, days_inactive = EXCLUDED.days_inactive, last_check_time = NOW(), updated_at = NOW() RETURNING *', [discordId, username, url, faction, guildId, daysInactive]);
  } catch (e) {
    console.error('[DB ERROR] addPlayerWithUrl failed:', { message: e.message, code: e.code, detail: e.detail, hint: e.hint, params: [discordId, username, url, faction, guildId, daysInactive] });
    return null;
  }
}

export async function addOrUpdatePlayerByName(playerName, url, faction, guildId, daysInactive = 0, discordId = null) {
  if (!guildId) {
    console.warn('[DB] addOrUpdatePlayerByName called without guildId', { playerName, url, faction });
    try {
      const { default: OrphanLogService } = await import('../services/orphanLogService.js');
      OrphanLogService.record('addOrUpdatePlayerByName', { playerName, url, faction, discordId });
    } catch (e) {
      console.error('[DB] Failed to record orphan attempt', e?.message || e);
    }
    return null;
  }
  try {
    // First try to find existing player by name + guild
    const existing = await db.oneOrNone(
      'SELECT id FROM players WHERE LOWER(username) = LOWER($1) AND guild_id = $2',
      [playerName, guildId]
    );
    
    if (existing) {
      // Update existing player
      return await db.one(
        'UPDATE players SET url = $1, faction = $2, days_inactive = $3, last_check_time = NOW(), updated_at = NOW() WHERE id = $4 RETURNING *',
        [url, faction, daysInactive, existing.id]
      );
    } else {
      // Insert new player - use provided discord_id or generate temporary one
      const tempDiscordId = discordId || `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      return await db.one(
        'INSERT INTO players (discord_id, username, url, faction, guild_id, days_inactive, last_check_time) VALUES ($1, $2, $3, $4, $5, $6, NOW()) ON CONFLICT (discord_id, guild_id) DO UPDATE SET username = EXCLUDED.username, url = EXCLUDED.url, faction = EXCLUDED.faction, days_inactive = EXCLUDED.days_inactive, last_check_time = NOW(), updated_at = NOW() RETURNING *',
        [tempDiscordId, playerName, url, faction, guildId, daysInactive]
      );
    }
  } catch (e) { 
    console.error('[DB ERROR] addOrUpdatePlayerByName failed:', { message: e.message, code: e.code, detail: e.detail, hint: e.hint, params: [playerName, url, faction, guildId, daysInactive, discordId] }); 
    return null; 
  } 
}
export async function deletePlayerById(playerId) { try { return await db.result('DELETE FROM players WHERE id = $1', [playerId]); } catch (e) { return null; } }
export async function cleanupDuplicatePlayers() { try { await db.none('DELETE FROM players WHERE id NOT IN (SELECT MIN(id) FROM players GROUP BY discord_id, guild_id)'); console.log('[DB] Duplicate players cleaned'); return { success: true }; } catch (e) { console.error('[DB ERROR] cleanupDuplicatePlayers:', e); return { success: false }; } }
export async function getPlayers() {
  try {
    return await db.any(`
      SELECT
        id,
        discord_id AS discordId,
        username,
        faction,
        url,
        guild_id AS guildId,
        player_status AS playerStatus,
        last_check_time AS lastCheckTime,
        days_inactive AS daysInactive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM players
    `);
  } catch (e) {
    console.error('[DB ERROR] getPlayers failed', { message: e.message, code: e.code });
    return [];
  }
}

export async function getSavedPlayers(guildId = null) { try { return guildId ? await db.any('SELECT * FROM saved_players WHERE guild_id = $1 ORDER BY created_at DESC', [guildId]) : await db.any('SELECT * FROM saved_players ORDER BY created_at DESC'); } catch (e) { return []; } }
export async function addSavedPlayer(discordId, username, faction, url, guildId, savedBy) { try { return await db.one('INSERT INTO saved_players (discord_id, username, faction, url, guild_id, saved_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [discordId, username, faction, url, guildId, savedBy]); } catch (e) { return null; } }
export async function deleteSavedPlayer(id) { try { return await db.result('DELETE FROM saved_players WHERE id = $1', [id]); } catch (e) { return null; } }

export async function getSavedFactions(guildId = null) { try { return guildId ? await db.any('SELECT * FROM saved_factions WHERE guild_id = $1 ORDER BY created_at DESC', [guildId]) : await db.any('SELECT * FROM saved_factions ORDER BY created_at DESC'); } catch (e) { return []; } }
export async function addSavedFaction(factionName, url, guildId, savedBy) { try { return await db.one('INSERT INTO saved_factions (faction_name, url, guild_id, saved_by) VALUES ($1, $2, $3, $4) RETURNING *', [factionName, url, guildId, savedBy]); } catch (e) { return null; } }
export async function deleteSavedFaction(id) { try { return await db.result('DELETE FROM saved_factions WHERE id = $1', [id]); } catch (e) { return null; } }

export async function getGuildConfig(guildId) { try { let c = await db.oneOrNone('SELECT * FROM guild_configs WHERE guild_id = $1', [guildId]); return c || await db.one('INSERT INTO guild_configs (guild_id) VALUES ($1) RETURNING *', [guildId]); } catch (e) { return {}; } }
export async function updateGuildConfig(guildId, updates) {
  try {
    const f = [], v = [];
    let p = 1;
    if (updates.inactivity_threshold !== undefined) { f.push(`inactivity_threshold = $${p++}`); v.push(updates.inactivity_threshold); }
    if (updates.check_frequency !== undefined) { f.push(`check_frequency = $${p++}`); v.push(updates.check_frequency); }
    if (updates.broadcast_channel_id !== undefined) { f.push(`broadcast_channel_id = $${p++}`); v.push(updates.broadcast_channel_id); }
    if (updates.alert_channel_id !== undefined) { f.push(`alert_channel_id = $${p++}`); v.push(updates.alert_channel_id); }
    if (updates.monitor_channel_id !== undefined) { f.push(`monitor_channel_id = $${p++}`); v.push(updates.monitor_channel_id); }
    if (updates.monitor_message_id !== undefined) { f.push(`monitor_message_id = $${p++}`); v.push(updates.monitor_message_id); }
    if (updates.summary_channel_id !== undefined) { f.push(`summary_channel_id = $${p++}`); v.push(updates.summary_channel_id); }
    if (updates.command_permissions !== undefined) { f.push(`command_permissions = $${p++}`); v.push(updates.command_permissions); }

    if (f.length === 0) return null;
    v.push(guildId);
    const query = `UPDATE guild_configs SET ${f.join(", ")} WHERE guild_id = $${p} RETURNING *`;
    return await db.one(query, v);
  } catch (e) {
    console.error('[DB ERROR] updateGuildConfig:', e);

    // Fallback: if a column is missing in DB (Postgres error code 42703), retry without alert_channel_id
    if (e?.code === '42703') {
      try {
        const safe = { ...updates };
        delete safe.alert_channel_id;
        delete safe.summary_channel_id;

        const f2 = [], v2 = [];
        let p2 = 1;
        if (safe.inactivity_threshold !== undefined) { f2.push(`inactivity_threshold = $${p2++}`); v2.push(safe.inactivity_threshold); }
        if (safe.check_frequency !== undefined) { f2.push(`check_frequency = $${p2++}`); v2.push(safe.check_frequency); }
        if (safe.broadcast_channel_id !== undefined) { f2.push(`broadcast_channel_id = $${p2++}`); v2.push(safe.broadcast_channel_id); }
        if (safe.alert_channel_id !== undefined) { f2.push(`alert_channel_id = $${p2++}`); v2.push(safe.alert_channel_id); }
        if (safe.monitor_channel_id !== undefined) { f2.push(`monitor_channel_id = $${p2++}`); v2.push(safe.monitor_channel_id); }
        if (safe.monitor_message_id !== undefined) { f2.push(`monitor_message_id = $${p2++}`); v2.push(safe.monitor_message_id); }
        if (safe.summary_channel_id !== undefined) { f2.push(`summary_channel_id = $${p2++}`); v2.push(safe.summary_channel_id); }
        if (safe.command_permissions !== undefined) { f2.push(`command_permissions = $${p2++}`); v2.push(safe.command_permissions); }

        if (f2.length === 0) return null;
        v2.push(guildId);
        const query2 = `UPDATE guild_configs SET ${f2.join(", ")} WHERE guild_id = $${p2} RETURNING *`;
        console.log('[DB] updateGuildConfig retrying without missing columns');
        return await db.one(query2, v2);
      } catch (retryErr) {
        console.error('[DB ERROR] updateGuildConfig retry failed:', retryErr);
        return null;
      }
    }

    return null;
  }
}
export async function getConfiguredMonitorGuildIdsFromDb() {
  try {
    const rows = await db.any("SELECT guild_id FROM guild_configs WHERE monitor_channel_id IS NOT NULL AND monitor_channel_id <> ''");
    return rows.map((row) => row.guild_id);
  } catch (e) {
    console.error('[DB ERROR] getConfiguredMonitorGuildIdsFromDb failed', { message: e.message, code: e.code });
    return [];
  }
}

export async function getSavedPlayerByName(playerName) { try { const r = await db.oneOrNone('SELECT * FROM saved_players WHERE LOWER(username) = LOWER($1)', [playerName]); return r ? {...r, playerName: r.username, playerUrl: r.url} : null; } catch (e) { return null; } }
export async function getAllSavedPlayersGlobal() { try { const r = await db.any('SELECT * FROM saved_players ORDER BY created_at DESC'); return r.map(p => ({...p, playerName: p.username, playerUrl: p.url})); } catch (e) { return []; } }
export async function getAllSavedPlayers() { return getAllSavedPlayersGlobal(); }
export async function getSavedPlayerUrl(playerName) { try { const r = await db.oneOrNone('SELECT url FROM saved_players WHERE LOWER(username) = LOWER($1)', [playerName]); return r?.url || null; } catch (e) { return null; } }
export async function getSavedPlayerByUrl(playerUrl) { try { const r = await db.oneOrNone('SELECT * FROM saved_players WHERE url = $1', [playerUrl]); return r ? {...r, playerName: r.username, playerUrl: r.url} : null; } catch (e) { return null; } }
export async function saveSavedPlayerUrl(playerName, playerUrl, guildId, savedBy = null) { return addSavedPlayer(Date.now(), playerName, null, playerUrl, guildId, savedBy); }
export async function deleteSavedPlayerUrl(playerName) { try { return await db.result('DELETE FROM saved_players WHERE LOWER(username) = LOWER($1)', [playerName]); } catch (e) { return null; } }
export async function updateSavedPlayer(playerName, playerPower, playerFaction, playerRole, playerGrade) { try { if (playerFaction) await db.none('UPDATE saved_players SET faction = $1 WHERE LOWER(username) = LOWER($2)', [playerFaction, playerName]); return { success: true }; } catch (e) { return { success: false }; } }

export async function getAllSavedFactions() { try { const r = await db.any('SELECT * FROM saved_factions ORDER BY created_at DESC'); return r.map(f => ({...f, factionName: f.faction_name, factionUrl: f.url, factionPower: f.faction_power, factionMembers: f.faction_members, factionClaims: f.faction_claims, factionAlliesList: f.faction_allies_list, factionEmoji: f.faction_emoji, factionImageUrl: f.faction_image_url, factionCreationDate: f.faction_creation_date})); } catch (e) { return []; } }
export async function getSavedFactionByName(factionName) { try { const r = await db.oneOrNone('SELECT * FROM saved_factions WHERE faction_name = $1', [factionName]); return r ? {...r, factionName: r.faction_name, factionUrl: r.url, factionPower: r.faction_power, factionMembers: r.faction_members, factionClaims: r.faction_claims, factionAlliesList: r.faction_allies_list, factionEmoji: r.faction_emoji, factionImageUrl: r.faction_image_url, factionCreationDate: r.faction_creation_date} : null; } catch (e) { return null; } }
export async function getSavedFactionUrl(factionName) { try { const r = await db.oneOrNone('SELECT url FROM saved_factions WHERE faction_name = $1', [factionName]); return r?.url || null; } catch (e) { return null; } }
export async function getSavedFactionByUrl(factionUrl) { try { const r = await db.oneOrNone('SELECT * FROM saved_factions WHERE url = $1', [factionUrl]); return r ? {...r, factionName: r.faction_name, factionUrl: r.url, factionPower: r.faction_power, factionMembers: r.faction_members, factionClaims: r.faction_claims, factionAlliesList: r.faction_allies_list, factionEmoji: r.faction_emoji, factionImageUrl: r.faction_image_url, factionCreationDate: r.faction_creation_date} : null; } catch (e) { return null; } }
export async function saveSavedFactionUrl(factionName, factionUrl, factionPower, factionMembers, factionClaims, factionAlliesList, factionEmoji, factionImageUrl, factionCreationDate, guildId = null, savedBy = null) { 
  try { 
    return await db.one('INSERT INTO saved_factions (faction_name, url, faction_power, faction_members, faction_claims, faction_allies_list, faction_emoji, faction_image_url, faction_creation_date, guild_id, saved_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *', [factionName, factionUrl, factionPower, factionMembers, factionClaims, factionAlliesList, factionEmoji, factionImageUrl, factionCreationDate, guildId, savedBy]); 
  } catch (e) { 
    console.error('[DB ERROR] saveSavedFactionUrl:', e); 
    return null; 
  } 
}
export async function updateSavedFaction(factionName, factionPower, factionMembers, factionAlliesList, factionClaims, factionCreationDate, factionEmoji, factionImageUrl) { 
  try { 
    return await db.one('UPDATE saved_factions SET faction_power = $1, faction_members = $2, faction_allies_list = $3, faction_claims = $4, faction_creation_date = $5, faction_emoji = $6, faction_image_url = $7, updated_at = NOW() WHERE faction_name = $8 RETURNING *', [factionPower, factionMembers, factionAlliesList, factionClaims, factionCreationDate, factionEmoji, factionImageUrl, factionName]); 
  } catch (e) { 
    console.error('[DB ERROR] updateSavedFaction:', e); 
    return null; 
  } 
}
export async function deleteSavedFactionUrl(factionName) { try { return await db.result('DELETE FROM saved_factions WHERE faction_name = $1', [factionName]); } catch (e) { return null; } }

export async function getCheckFrequency(guildId) { try { const c = await db.oneOrNone('SELECT check_frequency FROM guild_configs WHERE guild_id = $1', [guildId]); return c?.check_frequency || 60; } catch (e) { return 60; } }
export async function updateCheckFrequency(guildId, frequency) { try { let c = await db.oneOrNone('SELECT * FROM guild_configs WHERE guild_id = $1', [guildId]); return c ? await db.one('UPDATE guild_configs SET check_frequency = $1 WHERE guild_id = $2 RETURNING *', [frequency, guildId]) : await db.one('INSERT INTO guild_configs (guild_id, check_frequency) VALUES ($1, $2) RETURNING *', [guildId, frequency]); } catch (e) { return null; } }
export async function getLastCheckTime(guildId) { try { const c = await db.oneOrNone('SELECT last_check_time FROM guild_configs WHERE guild_id = $1', [guildId]); return c?.last_check_time ? Math.floor(new Date(c.last_check_time).getTime()) : 0; } catch (e) { return 0; } }
export async function updateLastCheckTime(guildId, checkTime) { try { let c = await db.oneOrNone('SELECT * FROM guild_configs WHERE guild_id = $1', [guildId]); if (!c) { return await db.one('INSERT INTO guild_configs (guild_id, last_check_time) VALUES ($1, to_timestamp($2)) RETURNING *', [guildId, Math.floor(checkTime / 1000)]); } else { return await db.one('UPDATE guild_configs SET last_check_time = to_timestamp($1) WHERE guild_id = $2 RETURNING *', [Math.floor(checkTime / 1000), guildId]); } } catch (e) { console.error('[DB ERROR] updateLastCheckTime:', e); return null; } }
export async function getAllLastCheckTimes() { try { const configs = await db.any('SELECT guild_id, last_check_time FROM guild_configs'); const result = {}; for (const c of configs) { result[c.guild_id] = c.last_check_time ? Math.floor(new Date(c.last_check_time).getTime()) : 0; } console.log('[DB] getAllLastCheckTimes loaded:', Object.keys(result).length, 'guilds'); return result; } catch (e) { console.error('[DB ERROR] getAllLastCheckTimes:', e); return {}; } }
export async function getBroadcastChannel(guildId) { try { const c = await db.oneOrNone('SELECT broadcast_channel_id FROM guild_configs WHERE guild_id = $1', [guildId]); return c?.broadcast_channel_id || null; } catch (e) { return null; } }
export async function setBroadcastChannel(guildId, channelId) { try { console.log(`[DB] Sauvegarde broadcast channel: guildId=${guildId}, channelId=${channelId}`); let c = await db.oneOrNone('SELECT * FROM guild_configs WHERE guild_id = $1', [guildId]); if (!c) { console.log(`[DB] Config n'existe pas, création...`); const result = await db.one('INSERT INTO guild_configs (guild_id, broadcast_channel_id) VALUES ($1, $2) RETURNING *', [guildId, channelId]); console.log(`[DB] ✅ Config créée:`, result); } else { console.log(`[DB] Config existe, update...`); const result = await db.one('UPDATE guild_configs SET broadcast_channel_id = $1 WHERE guild_id = $2 RETURNING *', [channelId, guildId]); console.log(`[DB] ✅ Config mise à jour:`, result); } return { success: true }; } catch (e) { console.error('[DB ERROR] setBroadcastChannel:', e.message, e); return { success: false, error: e.message }; } }
export async function removeBroadcastChannel(guildId) { try { let c = await db.oneOrNone('SELECT * FROM guild_configs WHERE guild_id = $1', [guildId]); if (c) { await db.one('UPDATE guild_configs SET broadcast_channel_id = NULL WHERE guild_id = $1 RETURNING *', [guildId]); } return { success: true }; } catch (e) { console.error('[DB ERROR] removeBroadcastChannel:', e); return { success: false }; } }

export async function getPlayerCountByGuild(guildId) { try { const r = await db.one('SELECT COUNT(*) as count FROM players WHERE guild_id = $1', [guildId]); return r?.count || 0; } catch (e) { return 0; } }
export async function getAlertCountByGuild(guildId) { try { const r = await db.one('SELECT COUNT(*) as count FROM audit_logs WHERE guild_id = $1', [guildId]); return r?.count || 0; } catch (e) { return 0; } }

export async function addAuditLog(guildId, userId, action, details) { try { return await db.one('INSERT INTO audit_logs (guild_id, user_id, action, details) VALUES ($1, $2, $3, $4) RETURNING *', [guildId, userId, action, details]); } catch (e) { return null; } }
export async function getAuditLogs(guildId, limit = 50) { try { return await db.any('SELECT * FROM audit_logs WHERE guild_id = $1 ORDER BY created_at DESC LIMIT $2', [guildId, limit]); } catch (e) { return []; } }

export async function getPlayerHistoryByName(playerName) { try { return await db.any('SELECT * FROM saved_players WHERE username = $1 ORDER BY created_at DESC LIMIT 100', [playerName]); } catch (e) { return []; } }

export async function updatePlayerCheckTime(playerId, daysInactive) { try { return await db.one('UPDATE players SET last_check_time = NOW(), days_inactive = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [daysInactive || 0, playerId]); } catch (e) { return null; } }
export async function updatePlayerStatus(playerId, status) { try { return await db.one('UPDATE players SET player_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, playerId]); } catch (e) { return null; } }
export async function updateAlertSentTime(playerId, alertType, timestamp) { try { return await addAuditLog(null, playerId, `${alertType}_alert_sent`, JSON.stringify({ timestamp })); } catch (e) { return null; } }
export async function getLastAlertTime(playerId, alertType) { try { const r = await db.oneOrNone('SELECT created_at FROM audit_logs WHERE user_id = $1 AND action = $2 ORDER BY created_at DESC LIMIT 1', [playerId, `${alertType}_alert_sent`]); return r ? Math.floor(new Date(r.created_at).getTime() / 1000) : null; } catch (e) { return null; } }
export async function updateLastReconnectionAlert(playerId) { try { return await addAuditLog(null, playerId, 'reconnection_alert_sent', '{}'); } catch (e) { return null; } }
export async function getLastReconnectionAlertTime(playerId) { try { const r = await db.oneOrNone('SELECT created_at FROM audit_logs WHERE user_id = $1 AND action = $2 ORDER BY created_at DESC LIMIT 1', [playerId, 'reconnection_alert_sent']); return r ? Math.floor(new Date(r.created_at).getTime() / 1000) : null; } catch (e) { return null; } }

export async function getPermissionsForCommand(guildId, commandName) { try { const c = await db.oneOrNone('SELECT command_permissions FROM guild_configs WHERE guild_id = $1', [guildId]); const p = c?.command_permissions || {}; return p[commandName] || { roles: [], users: [] }; } catch (e) { console.error('[DB ERROR] getPermissionsForCommand:', e); return { roles: [], users: [] }; } }
export async function setCommandPermission(guildId, commandName, roleId, type = 'role') { try { const c = await db.oneOrNone('SELECT command_permissions FROM guild_configs WHERE guild_id = $1', [guildId]); let p = c?.command_permissions || {}; if (!p[commandName]) p[commandName] = { roles: [], users: [] }; if (type === 'role' && !p[commandName].roles.includes(roleId)) p[commandName].roles.push(roleId); else if (type === 'user' && !p[commandName].users.includes(roleId)) p[commandName].users.push(roleId); await db.none('UPDATE guild_configs SET command_permissions = $1 WHERE guild_id = $2', [JSON.stringify(p), guildId]); return { success: true }; } catch (e) { console.error('[DB ERROR] setCommandPermission:', e); return { success: false }; } }
export async function removeCommandPermission(guildId, commandName, roleId, type = 'role') { try { const c = await db.oneOrNone('SELECT command_permissions FROM guild_configs WHERE guild_id = $1', [guildId]); let p = c?.command_permissions || {}; if (!p[commandName]) return { success: true }; if (type === 'role') p[commandName].roles = p[commandName].roles.filter(r => r !== roleId); else p[commandName].users = p[commandName].users.filter(u => u !== roleId); await db.none('UPDATE guild_configs SET command_permissions = $1 WHERE guild_id = $2', [JSON.stringify(p), guildId]); return { success: true }; } catch (e) { console.error('[DB ERROR] removeCommandPermission:', e); return { success: false }; } }
export async function resetCommandPermissions(guildId, commandName = null) { try { const c = await db.oneOrNone('SELECT command_permissions FROM guild_configs WHERE guild_id = $1', [guildId]); let p = c?.command_permissions || {}; if (commandName) delete p[commandName]; else p = {}; await db.none('UPDATE guild_configs SET command_permissions = $1 WHERE guild_id = $2', [JSON.stringify(p), guildId]); return { success: true }; } catch (e) { console.error('[DB ERROR] resetCommandPermissions:', e); return { success: false }; } }
export async function setUserPermission(guildId, commandName, userId) { return setCommandPermission(guildId, commandName, userId, 'user'); }
export async function removeUserPermission(guildId, commandName, userId) { return removeCommandPermission(guildId, commandName, userId, 'user'); }
export async function getPermissionsByType(guildId, type = 'role') { try { const c = await db.oneOrNone('SELECT command_permissions FROM guild_configs WHERE guild_id = $1', [guildId]); const p = c?.command_permissions || {}; const r = {}; for (const [cmd, perms] of Object.entries(p)) r[cmd] = (type === 'role' ? perms.roles : perms.users) || []; return r; } catch (e) { return {}; } }

export async function getTopCommands(limit = 5) { try { return await db.any('SELECT DISTINCT(command_name) as commandName, COUNT(*) as count FROM audit_logs WHERE action = \'command_used\' GROUP BY command_name ORDER BY count DESC LIMIT $1', [limit]); } catch (e) { return []; } }
export async function getUniqueUsers() { try { const r = await db.one('SELECT COUNT(DISTINCT user_id) as count FROM audit_logs'); return r?.count || 0; } catch (e) { return 0; } }
export async function getDatabaseStats() { try { const players = await db.one('SELECT COUNT(*) as count FROM players'); const saved = await db.one('SELECT COUNT(*) as count FROM saved_players'); const factions = await db.one('SELECT COUNT(*) as count FROM saved_factions'); return { totalPlayers: players?.count || 0, totalSavedPlayers: saved?.count || 0, totalFactions: factions?.count || 0 }; } catch (e) { return { totalPlayers: 0, totalSavedPlayers: 0, totalFactions: 0 }; } }
export async function getBlockedAttemptsSummary() { try { const r = await db.one('SELECT COUNT(*) as count FROM audit_logs WHERE action LIKE \'%blocked%\' OR action LIKE \'%denied%\''); return r?.count || 0; } catch (e) { return 0; } }
export async function getBannedUsers() { try { return await db.any('SELECT DISTINCT user_id FROM audit_logs WHERE action = \'user_banned\' ORDER BY created_at DESC'); } catch (e) { return []; } }
export async function getRecentBackups() { try { return await db.any('SELECT * FROM audit_logs WHERE action = \'backup_created\' ORDER BY created_at DESC LIMIT 10'); } catch (e) { return []; } }

export async function isUserBanned(userId) { try { const r = await db.oneOrNone('SELECT user_id FROM audit_logs WHERE user_id = $1 AND action = \'user_banned\'', [userId]); return !!r; } catch (e) { return false; } }
export async function logBlockedAccess(userId, guildId, reason) { try { return await addAuditLog(guildId, userId, 'access_blocked', JSON.stringify({ reason })); } catch (e) { return null; } }
export async function trackCommandExecution(guildId, userId, commandName) { try { return await addAuditLog(guildId, userId, 'command_used', JSON.stringify({ commandName })); } catch (e) { return null; } }

export { testConnection, initializeDatabase as initDatabase, closeDatabase } from './postgres.js';
export function getDb() { return db; }
