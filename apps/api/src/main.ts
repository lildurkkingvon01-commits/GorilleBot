/**
 * API Server Entry Point
 * Phase D - API Routes Implementation
 */

import Fastify from 'fastify';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..', '..');
const projectRoot = path.resolve(__dirname, '..', '..', '..');

const initialEnvKeys = new Set(Object.keys(process.env));
const envKeysFromDotenv = new Set();

function loadEnvFile(fileName, basePath, allowOverride = false) {
  const envPath = path.join(basePath, fileName);
  if (!existsSync(envPath)) {
    return;
  }

  const parsed = dotenv.parse(readFileSync(envPath, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    const existing = process.env[key];
    const shouldSet = existing === undefined || existing === '' || (allowOverride && envKeysFromDotenv.has(key));
    if (shouldSet) {
      process.env[key] = value;
      envKeysFromDotenv.add(key);
    }
  }
}

loadEnvFile('.env', appRoot, false);
loadEnvFile('.env.local', appRoot, true);
loadEnvFile('.env', projectRoot, false);
loadEnvFile('.env.local', projectRoot, true);

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Import middleware setup
import {
  setupErrorHandler,
  setupCors,
  setupRequestLogging,
  setupResponseTiming,
} from '@/middleware';

// Import routes
import { dashboardRoutes } from '@/routes/dashboard';
import { logsRoutes } from '@/routes/logs';
import { guildRoutes } from '@/routes/guilds';
import { usersRoutes } from '@/routes/users';
import { commandsRoutes } from '@/routes/commands';
import { maintenanceRoutes, backupsRoutes, flagsRoutes, settingsRoutes } from '@/routes/support';
import { analyticsRoutes } from '@/routes/analytics';
import { debugRoutes } from '@/routes/debug';
import { moderationRoutes } from '@/routes/moderation';
import { auditRoutes } from '@/routes/audit';
import { botRoutes } from '@/routes/bot';

// Types
import { ApiResponse } from '@/types';

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Register middleware
setupCors(fastify);
setupErrorHandler(fastify);
setupRequestLogging(fastify);
setupResponseTiming(fastify);

// Health check endpoint
fastify.get('/api/health', async (request, reply) => {
  const response: ApiResponse = {
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    meta: { timestamp: new Date().toISOString() },
  };
  return reply.send(response);
});

// API version endpoint
fastify.get('/api/version', async (request, reply) => {
  const response: ApiResponse = {
    data: {
      version: '1.0.0',
      phase: 'Phase D - API Routes',
      environment: process.env.NODE_ENV || 'development',
    },
    meta: { timestamp: new Date().toISOString() },
  };
  return reply.send(response);
});

// Register route groups
async function registerRoutes() {
  await dashboardRoutes(fastify);
  await logsRoutes(fastify);
  await guildRoutes(fastify);
  await usersRoutes(fastify);
  await commandsRoutes(fastify);
  await maintenanceRoutes(fastify);
  await backupsRoutes(fastify);
  await flagsRoutes(fastify);
  await settingsRoutes(fastify);
  await analyticsRoutes(fastify);
  await debugRoutes(fastify);
  await moderationRoutes(fastify);
  await auditRoutes(fastify);
  await botRoutes(fastify);
}

// Start server
async function start() {
  try {
    await registerRoutes();

    const port = parseInt(process.env.PORT || '4000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });

    console.log(`
╔════════════════════════════════════════════════════╗
║  🚀 API Server Started                             ║
║  Phase D - API Routes Implementation (Complete)    ║
╠════════════════════════════════════════════════════╣
║  URL:    http://${host}:${port}                         ║
║  Env:    ${(process.env.NODE_ENV || 'development').padEnd(44)}║
║  Status: ✅ Ready                                   ║
╚════════════════════════════════════════════════════╝

📋 Available Endpoints (55 total):

Dashboard (5):
  GET  /api/dashboard/overview
  GET  /api/dashboard/bot-status
  GET  /api/dashboard/activity
  GET  /api/dashboard/command-stats
  GET  /api/dashboard/growth

Logs (7):
  GET  /api/logs/audit
  GET  /api/logs/audit/:id
  GET  /api/logs/commands
  GET  /api/logs/commands/:id
  GET  /api/logs/errors
  GET  /api/logs/errors/:id
  GET  /api/logs/stats

Guilds (5):
  GET  /api/guilds
  GET  /api/guilds/:guildId
  GET  /api/guilds/:guildId/stats
  GET  /api/guilds/top
  GET  /api/guilds/total

Users (6):
  GET  /api/users
  GET  /api/users/:userId
  GET  /api/users/:userId/activity
  PATCH /api/users/:userId/notes
  POST  /api/users/:userId/ban
  POST  /api/users/:userId/unban

Commands (6):
  GET  /api/commands
  GET  /api/commands/:commandId/stats
  PATCH /api/commands/:commandId
  POST  /api/commands/:commandId/enable
  POST  /api/commands/:commandId/disable
  POST  /api/commands/:commandId/reset-stats

Maintenance (7):
  GET  /api/maintenance
  POST  /api/maintenance/enable
  POST  /api/maintenance/disable
  PATCH /api/maintenance/message
  GET  /api/maintenance/whitelist
  POST  /api/maintenance/whitelist
  DELETE /api/maintenance/whitelist/:entryId

Backups (4):
  GET  /api/backups
  POST  /api/backups
  POST  /api/backups/:backupId/restore
  DELETE /api/backups/:backupId

Flags (2):
  GET  /api/flags
  PATCH /api/flags/:flagKey

Settings (3):
  GET  /api/settings
  PATCH /api/settings
  PATCH /api/settings/bulk

Analytics (5):
  GET  /api/analytics/overview
  GET  /api/analytics/guild-growth
  GET  /api/analytics/command-usage
  GET  /api/analytics/moderation
  GET  /api/analytics/activity-heatmap

Health (2):
  GET  /api/health
  GET  /api/version
    `);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await fastify.close();
  process.exit(0);
});

// Start the server
start();

export default fastify;
