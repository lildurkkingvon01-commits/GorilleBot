/**
 * Maintenance & Support Controllers
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  maintenanceService,
  backupsService,
  settingsService,
} from '@/services/maintenanceService';
import { errorResponses } from '@/utils/errors';
import { parsePagination } from '@/utils/pagination';
import { ApiResponse } from '@/types';

// ==================== Maintenance Controller ====================

export const maintenanceController = {
  async getMaintenance(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const { page, limit } = parsePagination(query.page, query.limit);

      const result = await maintenanceService.getMaintenance(page, limit);

      return reply.send({
        data: result.data,
        meta: {
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            pages: result.pages,
          },
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse<any>);
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async enableMaintenance(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reason, affectedCommands } = request.body as any;

      const result = await maintenanceService.enableMaintenance(reason, affectedCommands);

      return reply.status(201).send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async disableMaintenance(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await maintenanceService.disableMaintenance();

      return reply.send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async updateMaintenanceMessage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { message } = request.body as any;

      if (!message) {
        throw errorResponses.invalidParams('Message is required');
      }

      const result = await maintenanceService.updateMaintenanceMessage(message);

      return reply.send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw error;
    }
  },

  async getMaintenanceWhitelist(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const { page, limit } = parsePagination(query.page, query.limit);

      const result = await maintenanceService.getMaintenanceWhitelist(page, limit);

      return reply.send({
        data: result.data,
        meta: {
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            pages: result.pages,
          },
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse<any>);
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async addToWhitelist(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId, whitelistType } = request.body as any;

      if (!userId) {
        throw errorResponses.invalidParams('userId is required');
      }

      const result = await maintenanceService.addToWhitelist(userId, whitelistType);

      return reply.status(201).send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw error;
    }
  },

  async removeFromWhitelist(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { entryId } = request.params as any;

      const result = await maintenanceService.removeFromWhitelist(parseInt(entryId));

      return reply.send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },
};

// ==================== Backups Controller ====================

export const backupsController = {
  async getBackups(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const { page, limit } = parsePagination(query.page, query.limit);

      const result = await backupsService.getBackups(page, limit, {
        guildId: query.guildId,
      });

      return reply.send({
        data: result.data,
        meta: {
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            pages: result.pages,
          },
          timestamp: new Date().toISOString(),
        },
      } as ApiResponse<any>);
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async createBackup(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { guildId, backupType } = request.body as any;

      if (!guildId) {
        throw errorResponses.invalidParams('guildId is required');
      }

      const result = await backupsService.createBackup(guildId, backupType);

      return reply.status(201).send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw error;
    }
  },

  async restoreBackup(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { backupId } = request.params as any;
      const { guildId } = request.body as any;

      if (!guildId) {
        throw errorResponses.invalidParams('guildId is required');
      }

      const result = await backupsService.restoreBackup(parseInt(backupId), guildId);

      return reply.status(201).send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw error;
    }
  },

  async deleteBackup(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { backupId } = request.params as any;

      const result = await backupsService.deleteBackup(parseInt(backupId));

      return reply.send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },
};

// ==================== Settings Controller ====================

export const settingsController = {
  async getSettings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;

      const result = await settingsService.getSettings(query.key);

      return reply.send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },

  async updateSettings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { key, value } = request.body as any;

      if (!key) {
        throw errorResponses.invalidParams('key is required');
      }

      const result = await settingsService.updateSettings(key, value);

      return reply.send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw error;
    }
  },

  async updateBulkSettings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const updates = request.body as any;

      const result = await settingsService.updateBulkSettings(updates);

      return reply.send({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      throw errorResponses.internalError(error);
    }
  },
};
