/**
 * Moderation Routes - Complete Ban/Unban Flow
 * 
 * BAN PROCESS:
 * 1. Create/update banned_guilds with active=true, reason, banned_by, banned_at
 * 2. Create audit_log entry for GUILD_BANNED
 * 3. Set guilds.bot_present = false
 * 4. Create guild_action for bot to execute LEAVE
 * 
 * UNBAN PROCESS:
 * 1. Set banned_guilds.active = false
 * 2. Create audit_log entry for GUILD_UNBANNED
 * 3. Do NOT set bot_present=true (only when bot is reinvited)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function moderationRoutes(fastify: FastifyInstance) {
  // ============================================================
  // BAN A GUILD - Complete implementation
  // ============================================================
  fastify.post<{ Params: { guildId: string } }>(
    '/api/moderation/guilds/:guildId/ban',
    async (request: FastifyRequest<{ Params: { guildId: string } }>, reply: FastifyReply) => {
      try {
        const { guildId } = request.params;
        const { reason } = request.body as { reason?: string };

        if (!guildId) {
          return reply.status(400).send({ error: 'guildId is required' });
        }

        if (!reason || reason.trim() === '') {
          return reply.status(400).send({ error: 'Reason is required' });
        }

        // Check if already banned
        const existing = await prisma.bannedGuild.findUnique({
          where: { guild_id: guildId },
        });

        if (existing && existing.active) {
          return reply.status(409).send({ error: 'Guild is already banned' });
        }

        // STEP 1: Get real guild name from multiple sources
        const realGuildName = await getRealGuildName(guildId);

        // STEP 2: Get admin ID from header (for banned_by)
        const adminId = (request.headers['x-user-id'] as string) || 'admin';

        // STEP 3: Create or update ban in banned_guilds
        const banned = await prisma.bannedGuild.upsert({
          where: { guild_id: guildId },
          update: {
            active: true,
            reason: reason.trim(),
            banned_at: new Date(),
            banned_by: adminId,
            expires_at: null,
            is_permanent: true,
            guild_name: realGuildName, // Store real name, not placeholder
          },
          create: {
            guild_id: guildId,
            guild_name: realGuildName,
            active: true,
            reason: reason.trim(),
            banned_at: new Date(),
            banned_by: adminId,
            is_permanent: true,
          },
        });

        // STEP 4: Create audit log GUILD_BANNED
        await prisma.auditLog.create({
          data: {
            action: 'GUILD_BANNED',
            user_id: adminId,
            guild_id: guildId,
            target_id: guildId,
            target_name: realGuildName,
            details: reason.trim(),
            created_at: new Date(),
          },
        });

        // STEP 5: Set bot_present = false
        await prisma.guild.update({
          where: { id: guildId },
          data: { bot_present: false },
        }).catch(err => {
          console.warn(`[BAN] Guild ${guildId} not in DB or update failed: ${err.message}`);
        });

        // STEP 6: Create guild_action for bot to LEAVE
        try {
          await prisma.guildAction.create({
            data: {
              guild_id: guildId,
              action_type: 'LEAVE',
              status: 'PENDING',
              reason: `Guild banned: ${reason.trim()}`,
              created_at: new Date(),
            },
          });
        } catch (actionErr) {
          console.warn(`[BAN] Could not create guild_action (table may not exist): ${actionErr}`);
        }

        console.log(`[MODERATION] Guild ${guildId} (${realGuildName}) banned by ${adminId}. Reason: ${reason.trim()}`);

        return reply.send({
          data: {
            guildId: banned.guild_id,
            guildName: banned.guild_name,
            status: 'BANNED',
            reason: banned.reason,
            bannedAt: banned.banned_at,
            bannedBy: banned.banned_by,
          },
          meta: { 
            timestamp: new Date().toISOString(),
            message: 'Guild banned. Bot will leave on next sync.' 
          },
        });
      } catch (error) {
        console.error('Error banning guild:', error);
        return reply.status(500).send({
          error: { code: 'BAN_ERROR', message: 'Failed to ban guild' },
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // ============================================================
  // UNBAN A GUILD - Complete implementation
  // ============================================================
  fastify.post<{ Params: { guildId: string } }>(
    '/api/moderation/guilds/:guildId/unban',
    async (request: FastifyRequest<{ Params: { guildId: string } }>, reply: FastifyReply) => {
      try {
        const { guildId } = request.params;

        if (!guildId) {
          return reply.status(400).send({ error: 'guildId is required' });
        }

        // Check if guild is banned
        const banned = await prisma.bannedGuild.findUnique({
          where: { guild_id: guildId },
        });

        if (!banned || !banned.active) {
          return reply.status(404).send({ error: 'Guild is not banned' });
        }

        // Get admin ID
        const adminId = (request.headers['x-user-id'] as string) || 'admin';

        // STEP 1: Set active = false
        const updated = await prisma.bannedGuild.update({
          where: { guild_id: guildId },
          data: {
            active: false,
          },
        });

        // STEP 2: Create audit log GUILD_UNBANNED
        await prisma.auditLog.create({
          data: {
            action: 'GUILD_UNBANNED',
            user_id: adminId,
            guild_id: guildId,
            target_id: guildId,
            target_name: updated.guild_name,
            details: `Unban by ${adminId}`,
            created_at: new Date(),
          },
        });

        // NOTE: Do NOT set bot_present=true here
        // bot_present will be set to true only when bot is reinvited via guildCreate

        console.log(`[MODERATION] Guild ${guildId} (${updated.guild_name}) unbanned by ${adminId}`);

        return reply.send({
          data: {
            guildId: updated.guild_id,
            guildName: updated.guild_name,
            status: 'UNBANNED',
            active: false,
          },
          meta: { 
            timestamp: new Date().toISOString(),
            message: 'Guild unbanned. Bot can be reinvited.' 
          },
        });
      } catch (error) {
        console.error('Error unbanning guild:', error);
        return reply.status(500).send({
          error: { code: 'UNBAN_ERROR', message: 'Failed to unban guild' },
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}

/**
 * Helper: Get real guild name from DB
 * Priority: command_logs.guild_name > audit_logs.target_name > guilds.name > fallback
 */
async function getRealGuildName(guildId: string): Promise<string> {
  try {
    // Source 1: command_logs
    const cmdLog = await prisma.commandLog.findFirst({
      where: {
        guild_id: guildId,
        guild_name: { not: null },
      },
      select: { guild_name: true },
      orderBy: { created_at: 'desc' },
    });

    if (cmdLog?.guild_name) {
      return cmdLog.guild_name;
    }

    // Source 2: audit_logs
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        guild_id: guildId,
        target_name: { not: null },
      },
      select: { target_name: true },
      orderBy: { created_at: 'desc' },
    });

    if (auditLog?.target_name) {
      return auditLog.target_name;
    }

    // Source 3: guilds table
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      select: { name: true },
    });

    if (guild?.name) {
      return guild.name;
    }

    // Fallback
    return `Guild ${guildId}`;
  } catch (err) {
    console.warn(`[getRealGuildName] Error for guild ${guildId}: ${err}`);
    return `Guild ${guildId}`;
  }
}
