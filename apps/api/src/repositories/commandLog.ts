/**
 * Command Log Repository
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { calculateSkip, PaginationResult, QueryFilters } from '@/utils/pagination';

const prisma = new PrismaClient();

export interface CommandLogFilters {
  guildId?: string;
  userId?: string;
  commandName?: string;
  success?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export const commandLogRepository = {
  async findMany(
    page: number,
    limit: number,
    filters?: CommandLogFilters
  ): Promise<PaginationResult<Prisma.CommandLogGetPayload<{}>>> {
    const where: Prisma.CommandLogWhereInput = {};

    if (filters?.guildId) {
      where.guild_id = filters.guildId;
    }

    if (filters?.userId) {
      where.user_id = filters.userId;
    }

    if (filters?.commandName) {
      where.command_name = filters.commandName;
    }

    if (filters?.success !== undefined) {
      where.success = filters.success;
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
      prisma.commandLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: calculateSkip(page, limit),
        take: limit,
      }),
      prisma.commandLog.count({ where }),
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
    return prisma.commandLog.findUnique({
      where: { id },
    });
  },

  async getStats(guildId?: string) {
    const where = guildId ? { guild_id: guildId } : {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalCount, todayCount, weekCount, monthCount, failureCount] = await Promise.all([
      prisma.commandLog.count({ where }),
      prisma.commandLog.count({
        where: {
          ...where,
          created_at: { gte: today },
        },
      }),
      prisma.commandLog.count({
        where: {
          ...where,
          created_at: {
            gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.commandLog.count({
        where: {
          ...where,
          created_at: {
            gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.commandLog.count({
        where: {
          ...where,
          success: false,
        },
      }),
    ]);

    const failureRate = totalCount > 0 ? (failureCount / totalCount) * 100 : 0;

    return {
      total: totalCount,
      today: todayCount,
      week: weekCount,
      month: monthCount,
      failureRate: Math.round(failureRate * 100) / 100,
    };
  },

  async getTopCommands(limit: number = 10, guildId?: string) {
    const where = guildId ? { guild_id: guildId } : {};

    return prisma.commandLog.groupBy({
      by: ['command_name'],
      where,
      _count: {
        command_name: true,
      },
      orderBy: {
        _count: {
          command_name: 'desc',
        },
      },
      take: limit,
    });
  },

  async getAverageExecutionTime(commandName?: string, guildId?: string) {
    const where: Prisma.CommandLogWhereInput = {};

    if (commandName) {
      where.command_name = commandName;
    }

    if (guildId) {
      where.guild_id = guildId;
    }

    const result = await prisma.commandLog.aggregate({
      where,
      _avg: {
        execution_time_ms: true,
      },
      _max: {
        execution_time_ms: true,
      },
      _min: {
        execution_time_ms: true,
      },
    });

    return {
      average: result._avg.execution_time_ms || 0,
      max: result._max.execution_time_ms || 0,
      min: result._min.execution_time_ms || 0,
    };
  },
};
