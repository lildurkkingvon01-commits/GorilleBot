/**
 * Command Maintenance Service
 * Manage per-command maintenance mode
 */

import db from '../utils/postgres.js';

class CommandMaintenanceService {
  /**
   * Get all commands in maintenance
   */
  static async getMaintenanceCommands() {
    try {
      const result = await db.any(
        `SELECT command_name, enabled, updated_by, updated_at 
         FROM command_maintenance 
         WHERE enabled = true
         ORDER BY updated_at DESC`
      );
      return result || [];
    } catch (error) {
      console.error('[CommandMaintenance] Get error:', error.message);
      return [];
    }
  }

  /**
   * Check if a command is in maintenance
   */
  static async isCommandInMaintenance(commandName) {
    try {
      const result = await db.oneOrNone(
        `SELECT enabled FROM command_maintenance 
         WHERE command_name = $1`,
        [commandName]
      );
      return result?.enabled === true;
    } catch (error) {
      console.error('[CommandMaintenance] Check error:', error.message);
      return false;
    }
  }

  /**
   * Enable maintenance for a command
   */
  static async enableMaintenance(commandName, userId) {
    try {
      await db.none(
        `INSERT INTO command_maintenance (command_name, enabled, updated_by, updated_at)
         VALUES ($1, true, $2, NOW())
         ON CONFLICT (command_name) DO UPDATE
         SET enabled = true, updated_by = $2, updated_at = NOW()`,
        [commandName, userId]
      );
      console.log(`[CommandMaintenance] Enabled for ${commandName} by ${userId}`);

      // Audit log
      await db.none(
        `INSERT INTO audit_logs (action, user_id, details, created_at)
         VALUES ('COMMAND_MAINTENANCE_ENABLE', $1, $2, NOW())`,
        [userId, commandName]
      );
    } catch (error) {
      console.error('[CommandMaintenance] Enable error:', error.message);
      throw error;
    }
  }

  /**
   * Disable maintenance for a command
   */
  static async disableMaintenance(commandName, userId) {
    try {
      await db.none(
        `UPDATE command_maintenance 
         SET enabled = false, updated_by = $2, updated_at = NOW()
         WHERE command_name = $1`,
        [commandName, userId]
      );
      console.log(`[CommandMaintenance] Disabled for ${commandName} by ${userId}`);

      // Audit log
      await db.none(
        `INSERT INTO audit_logs (action, user_id, details, created_at)
         VALUES ('COMMAND_MAINTENANCE_DISABLE', $1, $2, NOW())`,
        [userId, commandName]
      );
    } catch (error) {
      console.error('[CommandMaintenance] Disable error:', error.message);
      throw error;
    }
  }

  /**
   * Get list of all available commands (for select menu)
   * Excludes: admin, owner-only, system commands
   */
  static async getAllAvailableCommands(client) {
    try {
      const commands = [];
      
      // Get all commands from client
      client.commands.forEach((cmd, name) => {
        // Skip admin, owner-only, system commands
        if (cmd.ownerOnly || cmd.adminOnly || name === 'admin' || name.startsWith('_')) {
          return;
        }
        commands.push(name);
      });

      return commands.sort();
    } catch (error) {
      console.error('[CommandMaintenance] Get commands error:', error.message);
      return [];
    }
  }

  /**
   * Get count of commands in maintenance
   */
  static async getMaintenanceCount() {
    try {
      const result = await db.one(
        `SELECT COUNT(*) as count FROM command_maintenance WHERE enabled = true`
      );
      return result?.count || 0;
    } catch (error) {
      console.error('[CommandMaintenance] Count error:', error.message);
      return 0;
    }
  }
}

export default CommandMaintenanceService;
