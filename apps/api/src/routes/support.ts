/**
 * Support Routes (Maintenance, Backups, Settings)
 */

import { FastifyInstance } from 'fastify';
import {
  maintenanceController,
  backupsController,
  settingsController,
} from '@/controllers/supportController';

// ==================== Maintenance Routes ====================

export async function maintenanceRoutes(fastify: FastifyInstance) {
  fastify.get('/api/maintenance', maintenanceController.getMaintenance);
  fastify.post('/api/maintenance/enable', maintenanceController.enableMaintenance);
  fastify.post('/api/maintenance/disable', maintenanceController.disableMaintenance);
  fastify.patch('/api/maintenance/message', maintenanceController.updateMaintenanceMessage);
  fastify.get('/api/maintenance/whitelist', maintenanceController.getMaintenanceWhitelist);
  fastify.post('/api/maintenance/whitelist', maintenanceController.addToWhitelist);
  fastify.delete('/api/maintenance/whitelist/:entryId', maintenanceController.removeFromWhitelist);
}

// ==================== Backups Routes ====================

export async function backupsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/backups', backupsController.getBackups);
  fastify.post('/api/backups', backupsController.createBackup);
  fastify.post('/api/backups/:backupId/restore', backupsController.restoreBackup);
  fastify.delete('/api/backups/:backupId', backupsController.deleteBackup);
}

// ==================== Settings Routes ====================

export async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/settings', settingsController.getSettings);
  fastify.patch('/api/settings', settingsController.updateSettings);
  fastify.patch('/api/settings/bulk', settingsController.updateBulkSettings);
}
