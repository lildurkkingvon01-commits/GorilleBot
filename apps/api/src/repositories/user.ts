/**
 * User Repository
 */

import { PrismaClient } from '@prisma/client';
import { calculateSkip, PaginationResult } from '@/utils/pagination';

const prisma = new PrismaClient();

export interface UserFilters {
  search?: string;
  banned?: boolean;
  sort?: 'name' | 'activity' | 'joined';
}

export const userRepository = {
  async findMany(
    page: number,
    limit: number,
    filters?: UserFilters
  ): Promise<PaginationResult<any>> {
    // Get users from command logs (they have username)
    const commandUsers = await prisma.commandLog.findMany({
      distinct: ['user_id'],
      select: {
        user_id: true,
        username: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      skip: calculateSkip(page, limit),
      take: limit,
    });

    // Get total unique users
    const totalCount = await prisma.commandLog.findMany({
      distinct: ['user_id'],
      select: { user_id: true },
    });

    return {
      data: commandUsers.map((log: any) => ({
        user_id: log.user_id,
        username: log.username,
        last_activity: log.created_at,
      })),
      total: totalCount.length,
      page,
      limit,
      pages: Math.ceil(totalCount.length / limit),
    };
  },

  async findById(userId: string) {
    // Get user info from logs
    const [auditLogs, commandLogs] = await Promise.all([
      prisma.auditLog.findMany({
        where: { user_id: userId },
        take: 5,
        orderBy: { created_at: 'desc' },
      }),
      prisma.commandLog.findMany({
        where: { user_id: userId },
        take: 5,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const recentLog = [...(auditLogs || []), ...(commandLogs || [])].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    const username = (commandLogs?.[0]?.username) || (recentLog as any)?.username || userId;

    return {
      user_id: userId,
      username,
      last_activity: recentLog?.created_at || null,
      activity_count: (auditLogs?.length || 0) + (commandLogs?.length || 0),
    };
  },

  async getUserActivity(userId: string, limit: number = 20) {
    const [auditLogs, commandLogs] = await Promise.all([
      prisma.auditLog.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: limit,
      }),
      prisma.commandLog.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: limit,
      }),
    ]);

    const activities = [...(auditLogs || []), ...(commandLogs || [])];
    activities.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return activities.slice(0, limit);
  },

  async getStats() {
    const commandLogs = await prisma.commandLog.findMany({
      distinct: ['user_id'],
      select: { user_id: true },
    });

    const todayLogs = await prisma.commandLog.findMany({
      distinct: ['user_id'],
      where: {
        created_at: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      select: { user_id: true },
    });

    return {
      total: commandLogs.length,
      activeToday: todayLogs.length,
      actionsToday: await prisma.commandLog.count({
        where: {
          created_at: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    };
  },

  async getUserStats(userId: string) {
    const [auditCount, commandCount, lastActivity] = await Promise.all([
      prisma.auditLog.count({ where: { user_id: userId } }),
      prisma.commandLog.count({ where: { user_id: userId } }),
      prisma.commandLog.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      auditActions: auditCount,
      commandExecutions: commandCount,
      totalActions: auditCount + commandCount,
      lastActivity: lastActivity?.created_at || null,
    };
  },

  async addNote(userId: string, note: string) {
    // Store in audit log with special action type
    return prisma.auditLog.create({
      data: {
        action: 'user_note_added',
        user_id: userId,
        details: note,
      },
    });
  },

  async banUser(userId: string, reason: string) {
    return prisma.auditLog.create({
      data: {
        action: 'user_banned',
        user_id: userId,
        details: reason,
      },
    });
  },

  async unbanUser(userId: string, reason: string) {
    return prisma.auditLog.create({
      data: {
        action: 'user_unbanned',
        user_id: userId,
        details: reason,
      },
    });
  },
};
