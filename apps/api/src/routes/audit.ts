/**
 * Audit Endpoint - Final verification
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function auditRoutes(fastify: FastifyInstance) {
  fastify.get('/api/audit/final', async (request, reply) => {
    try {
      // 1. MEMBERCOUNT RÉEL
      const guilds = await prisma.guild.findMany({
        orderBy: { id: 'asc' }
      });

      // 2. SERVEUR 1084164655406129162 - Vérification du nom résolu
      const targetGuild = await prisma.guild.findUnique({
        where: { id: '1084164655406129162' }
      });

      const cmdLogs = await prisma.commandLog.findMany({
        where: { guild_id: '1084164655406129162' },
        select: { guild_name: true },
        take: 1
      });

      const auditLogs = await prisma.auditLog.findMany({
        where: { target_id: '1084164655406129162' },
        select: { target_name: true },
        take: 1
      });

      const bannedGuild = await prisma.bannedGuild.findUnique({
        where: { guild_id: '1084164655406129162' }
      });

      // 3. COMMANDCOUNT EXACT
      const cmdCounts = await prisma.commandLog.groupBy({
        by: ['guild_id'],
        _count: true,
        orderBy: { _count: { guild_id: 'desc' } }
      });

      // 4. ERRORCOUNT EXACT
      const errorCounts = await prisma.auditLog.groupBy({
        by: ['guild_id'],
        where: {
          action: { contains: 'ERROR' }
        },
        _count: true,
        orderBy: { _count: { guild_id: 'desc' } }
      });

      // 5. FLUX BANNISSEMENT
      const recentBans = await prisma.bannedGuild.findMany({
        orderBy: { banned_at: 'desc' },
        take: 5
      });

      const banAudits = await prisma.auditLog.findMany({
        where: { action: { contains: 'BAN' } },
        orderBy: { created_at: 'desc' },
        take: 5
      });

      return reply.send({
        data: {
          '1_memberCount_réel': {
            description: 'All guilds with member counts',
            guilds: guilds.map(g => ({
              id: g.id,
              name: g.name,
              memberCount: g.member_count,
              icon_url: g.icon_url,
              created_at: g.created_at,
              updated_at: g.updated_at
            }))
          },
          '2_serveur_1084164655406129162': {
            description: 'Name resolution sources for guild 1084164655406129162',
            guilds_table: targetGuild,
            command_logs_source: cmdLogs[0]?.guild_name || 'NOT FOUND',
            audit_logs_source: auditLogs[0]?.target_name || 'NOT FOUND',
            banned_guilds_source: bannedGuild?.guild_name || 'NOT FOUND',
            resolution_priority: 'command_logs > audit_logs > banned_guilds > guilds.name'
          },
          '3_commandCount_exact': {
            description: 'SELECT guild_id, COUNT(*) FROM command_logs GROUP BY guild_id',
            results: cmdCounts.map(c => ({
              guild_id: c.guild_id,
              count: c._count
            }))
          },
          '4_errorCount_exact': {
            description: 'SELECT guild_id, COUNT(*) FROM audit_logs WHERE severity=error',
            results: errorCounts.map(e => ({
              guild_id: e.guild_id,
              count: e._count
            }))
          },
          '5_flux_bannissement': {
            recent_bans: recentBans,
            ban_audits: banAudits
          }
        },
        meta: { timestamp: new Date().toISOString() }
      });
    } catch (error) {
      console.error('Audit error:', error);
      return reply.status(500).send({ error: 'Audit failed' });
    }
  });
}
