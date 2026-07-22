/**
 * Audit Log Repository
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { calculateSkip, PaginationResult, QueryFilters } from '@/utils/pagination';

const prisma = new PrismaClient();

export interface AuditLogFilters extends QueryFilters {
  action?: string;
}

export const auditLogRepository = {
  async findMany(
    page: number,
    limit: number,
    filters?: AuditLogFilters
  ): Promise<PaginationResult<Prisma.AuditLogGetPayload<{}>>> {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters?.guildId) {
      where.guild_id = filters.guildId;
    }

    if (filters?.userId) {
      where.user_id = filters.userId;
    }

    if (filters?.action) {
      where.action = filters.action;
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
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: calculateSkip(page, limit),
        take: limit,
      }),
      prisma.auditLog.count({ where }),
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
    return prisma.auditLog.findUnique({
      where: { id },
    });
  },

  async getStats(guildId?: string) {
    const where = guildId ? { guild_id: guildId } : {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalCount, todayCount, weekCount, monthCount] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({
        where: {
          ...where,
          created_at: { gte: today },
        },
      }),
      prisma.auditLog.count({
        where: {
          ...where,
          created_at: {
            gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          ...where,
          created_at: {
            gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      total: totalCount,
      today: todayCount,
      week: weekCount,
      month: monthCount,
    };
  },

  async getTopActions(limit: number = 10, guildId?: string) {
    const where = guildId ? { guild_id: guildId } : {};

    return prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: {
        action: true,
      },
      orderBy: {
        _count: {
          action: 'desc',
        },
      },
      take: limit,
    });
  },

  async getTopUsers(limit: number = 10, guildId?: string) {
    const where = guildId ? { guild_id: guildId } : {};

    return prisma.auditLog.groupBy({
      by: ['user_id'],
      where,
      _count: {
        user_id: true,
      },
      orderBy: {
        _count: {
          user_id: 'desc',
        },
      },
      take: limit,
    });
  },
};
