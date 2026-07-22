/**
 * Other Repositories (Errors, Commands, Maintenance, etc.)
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { calculateSkip, PaginationResult } from '@/utils/pagination';

const prisma = new PrismaClient();

// ==================== Error Log Repository ====================

export const errorLogRepository = {
  async findMany(
    page: number,
    limit: number,
    filters?: {
      severity?: string;
      resolved?: boolean;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ): Promise<PaginationResult<Prisma.ErrorLogGetPayload<{}>>> {
    const where: Prisma.ErrorLogWhereInput = {};

    if (filters?.severity) {
      where.severity = filters.severity;
    }

    if (filters?.resolved !== undefined) {
      where.resolved = filters.resolved;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.created_at = {};
      if (filters.dateFrom) {
        where.created_at.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.created_at.lte = filters.dateTo;
      }
    }

    const [data, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { created_at: 'desc' } as any,
        skip: calculateSkip(page, limit),
        take: limit,
      }),
      prisma.errorLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  },

  async findById(id: number) {
    return prisma.errorLog.findUnique({
      where: { id },
    });
  },

  async getStats() {
    const [total, critical, unresolved] = await Promise.all([
      prisma.errorLog.count(),
      prisma.errorLog.count({ where: { severity: 'critical' } }),
      prisma.errorLog.count({ where: { resolved: false } }),
    ]);

    return { total, critical, unresolved };
  },
};

// ==================== Command Repository ====================

export const commandRepository = {
  async findMany(
    page: number,
    limit: number,
    filters?: {
      enabled?: boolean;
    }
  ): Promise<PaginationResult<Prisma.CommandMaintenanceGetPayload<{}>>> {
    const where: Prisma.CommandMaintenanceWhereInput = {};

    if (filters?.enabled !== undefined) {
      where.enabled = filters.enabled;
    }

    const [data, total] = await Promise.all([
      prisma.commandMaintenance.findMany({
        where,
        orderBy: { command_name: 'asc' } as any,
        skip: calculateSkip(page, limit),
        take: limit,
      }),
      prisma.commandMaintenance.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  },

  async findById(id: number) {
    return prisma.commandMaintenance.findUnique({
      where: { id },
    });
  },

  async findByName(name: string) {
    return prisma.commandMaintenance.findUnique({
      where: { command_name: name },
    });
  },

  async getEnabled() {
    return prisma.commandMaintenance.findMany({
      where: { enabled: true },
    });
  },

  async getDisabled() {
    return prisma.commandMaintenance.findMany({
      where: { enabled: false },
    });
  },
};

// ==================== Maintenance Repository ====================

export const maintenanceRepository = {
  async findMany(
    page: number,
    limit: number
  ): Promise<PaginationResult<Prisma.MaintenanceGetPayload<{}>>> {
    const [data, total] = await Promise.all([
      prisma.maintenance.findMany({
        orderBy: { started_at: 'desc' } as any,
        skip: calculateSkip(page, limit),
        take: limit,
      }),
      prisma.maintenance.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  },

  async findById(id: number) {
    return prisma.maintenance.findUnique({
      where: { id },
    });
  },

  async getActive() {
    return prisma.maintenance.findMany({
      where: { enabled: true },
    });
  },

  async getStatus() {
    const active = await prisma.maintenance.findFirst({
      where: { enabled: true },
    });

    return {
      active: !!active,
      maintenance: active,
    };
  },
};

// ==================== Whitelist Repository ====================

export const whitelistRepository = {
  async findMany(
    page: number,
    limit: number,
    whitelistType?: string
  ): Promise<PaginationResult<Prisma.MaintenanceWhitelistGetPayload<{}>>> {
    const where: any = {};

    if (whitelistType) {
      where.whitelist_type = whitelistType;
    }

    const [data, total] = await Promise.all([
      prisma.maintenanceWhitelist.findMany({
        where,
        orderBy: { created_at: 'desc' } as any,
        skip: calculateSkip(page, limit),
        take: limit,
      }),
      prisma.maintenanceWhitelist.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  },

  async findById(id: number) {
    return prisma.maintenanceWhitelist.findUnique({
      where: { id },
    });
  },

  async isWhitelisted(userId: string) {
    return prisma.maintenanceWhitelist.findFirst({
      where: { user_id: userId } as any,
    });
  },
};

// ==================== Feature Flag Repository ====================

export const flagRepository = {
  async findMany(
    page: number,
    limit: number
  ): Promise<PaginationResult<Prisma.FeatureFlagGetPayload<{}>>> {
    const [data, total] = await Promise.all([
      prisma.featureFlag.findMany({
        orderBy: { flag_name: 'asc' } as any,
        skip: calculateSkip(page, limit),
        take: limit,
      }),
      prisma.featureFlag.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  },

  async findByName(name: string) {
    return prisma.featureFlag.findUnique({
      where: { flag_name: name },
    });
  },

  async isEnabled(name: string) {
    const flag = await prisma.featureFlag.findUnique({
      where: { flag_name: name },
    });

    return flag?.enabled || false;
  },

  async getAll() {
    return prisma.featureFlag.findMany();
  },
};

// ==================== Backup Repository ====================

export const backupRepository = {
  async findMany(
    page: number,
    limit: number,
    filters?: {
      guildId?: string;
      backupType?: string;
    }
  ): Promise<PaginationResult<Prisma.BackupMetadataGetPayload<{}>>> {
    const where: any = {};

    if (filters?.guildId) {
      where.guild_id = filters.guildId;
    }

    if (filters?.backupType) {
      where.backup_type = filters.backupType;
    }

    const [data, total] = await Promise.all([
      prisma.backupMetadata.findMany({
        where,
        orderBy: { created_at: 'desc' } as any,
        skip: calculateSkip(page, limit),
        take: limit,
      }),
      prisma.backupMetadata.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  },

  async findById(id: number) {
    return prisma.backupMetadata.findUnique({
      where: { id },
    });
  },

  async getRecentByGuild(guildId: string, limit: number = 5) {
    return prisma.backupMetadata.findMany({
      where: { guild_id: guildId } as any,
      orderBy: { created_at: 'desc' } as any,
      take: limit,
    });
  },
};
