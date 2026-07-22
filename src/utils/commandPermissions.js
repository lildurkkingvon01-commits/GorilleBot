/**
 * Command Permissions Manager - Phase 3.2
 * Gestion des permissions par rôle/utilisateur
 */

import db from './postgres.js';

const permissionCache = new Map(); // {guildId: {commandName: {allowedRoles: [], allowedUsers: [], deniedRoles: [], deniedUsers: []}}}

/**
 * Get command permissions
 */
export async function getCommandPermissions(guildId, commandName = null) {
  try {
    const cacheKey = guildId;
    
    if (!permissionCache.has(cacheKey)) {
      const perms = await db.any(
        `SELECT command_name, role_id, user_id, allowed FROM command_permissions WHERE guild_id = $1`,
        [guildId]
      );
      
      const permMap = {};
      perms.forEach(p => {
        if (!permMap[p.command_name]) {
          permMap[p.command_name] = { allowed_roles: [], allowed_users: [], denied_roles: [], denied_users: [] };
        }
        
        if (p.allowed) {
          if (p.role_id) permMap[p.command_name].allowed_roles.push(p.role_id);
          if (p.user_id) permMap[p.command_name].allowed_users.push(p.user_id);
        } else {
          if (p.role_id) permMap[p.command_name].denied_roles.push(p.role_id);
          if (p.user_id) permMap[p.command_name].denied_users.push(p.user_id);
        }
      });
      
      permissionCache.set(cacheKey, permMap);
    }
    
    const allPerms = permissionCache.get(cacheKey);
    return commandName ? allPerms[commandName] : allPerms;
  } catch (error) {
    console.error('[CommandPermissions] Error getting permissions:', error);
    return commandName ? null : {};
  }
}

/**
 * Can user execute command
 */
export async function canExecuteCommand(guildId, userId, userRoles, commandName) {
  try {
    const perms = await getCommandPermissions(guildId, commandName);
    
    if (!perms) return true; // Default: allow if no permissions set
    
    // Check explicit deny first
    if (perms.denied_users.includes(userId)) return false;
    if (userRoles.some(r => perms.denied_roles.includes(r))) return false;
    
    // Check allow
    if (perms.allowed_users.includes(userId)) return true;
    if (userRoles.some(r => perms.allowed_roles.includes(r))) return true;
    
    // Default to allow if no restrictions
    return true;
  } catch (error) {
    console.error('[CommandPermissions] Error checking permissions:', error);
    return true;
  }
}

/**
 * Set permission
 */
export async function setPermission(guildId, commandName, targetId, isRole = false, isAllowed = true) {
  try {
    const permissionType = isRole ? 'role' : 'user';
    const existing = await db.oneOrNone(
      `SELECT id FROM command_permissions 
       WHERE guild_id = $1 AND command_name = $2 AND ${isRole ? 'role_id' : 'user_id'} = $3 AND permission_type = $4`,
      [guildId, commandName, targetId, permissionType]
    );
    
    if (existing) {
      await db.none(
        `UPDATE command_permissions SET allowed = $4, updated_at = CURRENT_TIMESTAMP 
         WHERE guild_id = $1 AND command_name = $2 AND ${isRole ? 'role_id' : 'user_id'} = $3 AND permission_type = $5`,
        [guildId, commandName, targetId, isAllowed, permissionType]
      );
    } else {
      await db.none(
        `INSERT INTO command_permissions (guild_id, command_name, ${isRole ? 'role_id' : 'user_id'}, permission_type, allowed) 
         VALUES ($1, $2, $3, $4, $5)`,
        [guildId, commandName, targetId, permissionType, isAllowed]
      );
    }
    
    // Invalidate cache
    permissionCache.delete(guildId);
    
    return true;
  } catch (error) {
    console.error('[CommandPermissions] Error setting permission:', error);
    return false;
  }
}

/**
 * Remove permission
 */
export async function removePermission(guildId, commandName, targetId, isRole = false) {
  try {
    const permissionType = isRole ? 'role' : 'user';
    await db.none(
      `DELETE FROM command_permissions 
       WHERE guild_id = $1 AND command_name = $2 AND ${isRole ? 'role_id' : 'user_id'} = $3 AND permission_type = $4`,
      [guildId, commandName, targetId, permissionType]
    );
    
    permissionCache.delete(guildId);
    return true;
  } catch (error) {
    console.error('[CommandPermissions] Error removing permission:', error);
    return false;
  }
}

export default {
  getCommandPermissions,
  canExecuteCommand,
  setPermission,
  removePermission
};
