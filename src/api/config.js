/**
 * Configuration API Handler
 * Manages settings, permissions, cooldowns, and maintenance
 */

import * as database from '../utils/database.js';

// =============================================
// SETTINGS MANAGEMENT
// =============================================

/**
 * Update guild settings
 * @param {string} guildId - Discord guild ID
 * @param {Object} settings - Settings to update
 * @param {string} userId - User ID making change
 * @returns {Promise<Object>} {success, message}
 */
export async function updateSettings(guildId, settings, userId) {
  try {
    // Validate inputs
    if (!guildId) {
      return { success: false, error: 'Guild ID required' };
    }

    // Build update object with only allowed fields
    const allowedFields = ['inactivity_threshold', 'check_frequency', 'broadcast_channel_id'];
    const updates = {};

    for (const field of allowedFields) {
      if (settings[field] !== undefined) {
        updates[field] = settings[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return { success: false, error: 'No valid settings to update' };
    }

    // Update in database
    const result = await database.updateGuildConfig(guildId, updates);

    if (!result) {
      return { success: false, error: 'Failed to update settings' };
    }

    // Log the change
    await database.addAuditLog(
      guildId,
      userId,
      'settings_updated',
      JSON.stringify({
        changes: updates,
        timestamp: new Date().toISOString()
      })
    );

    return {
      success: true,
      message: 'Settings updated successfully',
      data: result
    };
  } catch (error) {
    console.error('[API] Update settings error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all settings for a guild
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>}
 */
export async function getSettings(guildId) {
  try {
    const config = await database.getGuildConfig(guildId);
    return {
      success: true,
      data: {
        guildId,
        inactivityThreshold: config.inactivity_threshold || 30,
        checkFrequency: config.check_frequency || 60,
        broadcastChannelId: config.broadcast_channel_id || null,
        commandPermissions: config.command_permissions || {}
      }
    };
  } catch (error) {
    console.error('[API] Get settings error:', error);
    return { success: false, error: error.message };
  }
}

// =============================================
// PERMISSIONS MANAGEMENT
// =============================================

/**
 * Add permission for a command
 * @param {string} guildId - Discord guild ID
 * @param {string} commandId - Command name
 * @param {string} roleId - Role ID to grant permission to
 * @param {string} userId - User ID making change
 * @returns {Promise<Object>}
 */
export async function addPermission(guildId, commandId, roleId, userId) {
  try {
    if (!guildId || !commandId || !roleId) {
      return { success: false, error: 'Guild ID, command ID, and role ID required' };
    }

    const result = await database.setCommandPermission(guildId, commandId, roleId, 'role');

    if (!result.success) {
      return { success: false, error: 'Failed to add permission' };
    }

    // Log the change
    await database.addAuditLog(
      guildId,
      userId,
      'permission_added',
      JSON.stringify({
        commandId,
        roleId,
        timestamp: new Date().toISOString()
      })
    );

    return { success: true, message: 'Permission added' };
  } catch (error) {
    console.error('[API] Add permission error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove permission for a command
 * @param {string} guildId - Discord guild ID
 * @param {string} commandId - Command name
 * @param {string} roleId - Role ID to revoke permission from
 * @param {string} userId - User ID making change
 * @returns {Promise<Object>}
 */
export async function removePermission(guildId, commandId, roleId, userId) {
  try {
    if (!guildId || !commandId || !roleId) {
      return { success: false, error: 'Guild ID, command ID, and role ID required' };
    }

    const result = await database.removeCommandPermission(guildId, commandId, roleId, 'role');

    if (!result.success) {
      return { success: false, error: 'Failed to remove permission' };
    }

    // Log the change
    await database.addAuditLog(
      guildId,
      userId,
      'permission_removed',
      JSON.stringify({
        commandId,
        roleId,
        timestamp: new Date().toISOString()
      })
    );

    return { success: true, message: 'Permission removed' };
  } catch (error) {
    console.error('[API] Remove permission error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all permissions for a command
 * @param {string} guildId - Discord guild ID
 * @param {string} commandId - Command name
 * @returns {Promise<Object>}
 */
export async function getPermissions(guildId, commandId) {
  try {
    const perms = await database.getPermissionsForCommand(guildId, commandId);
    return {
      success: true,
      data: {
        commandId,
        roles: perms.roles || [],
        users: perms.users || []
      }
    };
  } catch (error) {
    console.error('[API] Get permissions error:', error);
    return { success: false, error: error.message };
  }
}

// =============================================
// COOLDOWNS MANAGEMENT
// =============================================

/**
 * Set cooldown for a command
 * @param {string} guildId - Discord guild ID
 * @param {string} commandId - Command name
 * @param {number} cooldownSeconds - Cooldown in seconds
 * @param {string} userId - User ID making change
 * @returns {Promise<Object>}
 */
export async function setCooldown(guildId, commandId, cooldownSeconds, userId) {
  try {
    if (!guildId || !commandId || cooldownSeconds === undefined) {
      return { success: false, error: 'Guild ID, command ID, and cooldown required' };
    }

    if (cooldownSeconds < 0 || cooldownSeconds > 86400) {
      return { success: false, error: 'Cooldown must be between 0 and 86400 seconds' };
    }

    // Get current config
    const config = await database.getGuildConfig(guildId);
    const cooldowns = config.cooldowns || {};
    cooldowns[commandId] = cooldownSeconds;

    // Update config with cooldowns
    const result = await database.updateGuildConfig(guildId, {
      command_permissions: JSON.stringify({
        ...config.command_permissions,
        [`${commandId}_cooldown`]: cooldownSeconds
      })
    });

    if (!result) {
      return { success: false, error: 'Failed to set cooldown' };
    }

    // Log the change
    await database.addAuditLog(
      guildId,
      userId,
      'cooldown_updated',
      JSON.stringify({
        commandId,
        cooldownSeconds,
        timestamp: new Date().toISOString()
      })
    );

    return { success: true, message: 'Cooldown updated' };
  } catch (error) {
    console.error('[API] Set cooldown error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get cooldown for a command
 * @param {string} guildId - Discord guild ID
 * @param {string} commandId - Command name
 * @returns {Promise<Object>}
 */
export async function getCooldown(guildId, commandId) {
  try {
    const config = await database.getGuildConfig(guildId);
    const perms = config.command_permissions || {};
    const cooldown = perms[`${commandId}_cooldown`] || 0;

    return {
      success: true,
      data: {
        commandId,
        cooldownSeconds: cooldown
      }
    };
  } catch (error) {
    console.error('[API] Get cooldown error:', error);
    return { success: false, error: error.message };
  }
}

// =============================================
// MAINTENANCE MODE
// =============================================

/**
 * Enable/disable maintenance mode
 * @param {string} guildId - Discord guild ID
 * @param {boolean} enabled - Enable or disable
 * @param {string} message - Maintenance message
 * @param {string} userId - User ID making change
 * @returns {Promise<Object>}
 */
export async function setMaintenanceMode(guildId, enabled, message = null, userId) {
  try {
    if (!guildId) {
      return { success: false, error: 'Guild ID required' };
    }

    const config = await database.getGuildConfig(guildId);
    const perms = config.command_permissions || {};

    if (enabled) {
      perms.maintenance_mode = true;
      perms.maintenance_message = message || 'Server is under maintenance. Please try again later.';
    } else {
      perms.maintenance_mode = false;
      delete perms.maintenance_message;
    }

    // Note: Since we're storing this in command_permissions, we need to update carefully
    const result = await database.updateGuildConfig(guildId, {
      command_permissions: JSON.stringify(perms)
    });

    if (!result) {
      return { success: false, error: 'Failed to update maintenance mode' };
    }

    // Log the change
    await database.addAuditLog(
      guildId,
      userId,
      'maintenance_mode_toggled',
      JSON.stringify({
        enabled,
        message,
        timestamp: new Date().toISOString()
      })
    );

    return {
      success: true,
      message: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled'
    };
  } catch (error) {
    console.error('[API] Set maintenance mode error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get maintenance mode status
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>}
 */
export async function getMaintenanceStatus(guildId) {
  try {
    const config = await database.getGuildConfig(guildId);
    const perms = config.command_permissions || {};

    return {
      success: true,
      data: {
        enabled: perms.maintenance_mode || false,
        message: perms.maintenance_message || null
      }
    };
  } catch (error) {
    console.error('[API] Get maintenance status error:', error);
    return { success: false, error: error.message };
  }
}

export default {
  updateSettings,
  getSettings,
  addPermission,
  removePermission,
  getPermissions,
  setCooldown,
  getCooldown,
  setMaintenanceMode,
  getMaintenanceStatus
};
