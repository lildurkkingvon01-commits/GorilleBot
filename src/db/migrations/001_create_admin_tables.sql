-- ============================================
-- ADMIN SYSTEM - TABLES CREATION (OPTIMIZED)
-- ============================================
-- Date: 2026-04-24
-- Purpose: Create missing tables for admin system
-- Reusing existing tables: user_bans, audit_logs, command_status
-- Creating new tables: command_logs, banned_guilds, maintenance, anti_spam_blocks, 
--                     backups_metadata, health_monitoring, error_logs

-- 1. COMMAND LOGS - Log toutes les commandes exécutées
CREATE TABLE IF NOT EXISTS command_logs (
  id SERIAL PRIMARY KEY,
  command_name VARCHAR(50) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  username VARCHAR(100),
  guild_id VARCHAR(255),
  guild_name VARCHAR(100),
  arguments TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_command_logs_user_id ON command_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_command_logs_guild_id ON command_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_command_logs_command_name ON command_logs(command_name);
CREATE INDEX IF NOT EXISTS idx_command_logs_created_at ON command_logs(created_at);

-- 2. BANNED GUILDS - Serveurs bannis (complément à user_bans)
CREATE TABLE IF NOT EXISTS banned_guilds (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(255) NOT NULL UNIQUE,
  guild_name VARCHAR(100),
  reason TEXT,
  banned_by VARCHAR(255),
  banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_permanent BOOLEAN DEFAULT TRUE,
  active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_banned_guilds_guild_id ON banned_guilds(guild_id);
CREATE INDEX IF NOT EXISTS idx_banned_guilds_active ON banned_guilds(active);

-- 3. MAINTENANCE - État de maintenance global et par commande
CREATE TABLE IF NOT EXISTS maintenance (
  id SERIAL PRIMARY KEY,
  maintenance_type VARCHAR(20) NOT NULL, -- 'global' ou 'command'
  target_name VARCHAR(100), -- Nom de la commande ou NULL si global
  enabled BOOLEAN DEFAULT FALSE,
  message TEXT,
  whitelist JSONB, -- {"owner_ids": [], "admin_ids": []}
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  UNIQUE(maintenance_type, target_name)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_global ON maintenance(maintenance_type) 
  WHERE maintenance_type = 'global';
CREATE INDEX IF NOT EXISTS idx_maintenance_command ON maintenance(target_name) 
  WHERE maintenance_type = 'command';

-- Insérer la maintenance globale si n'existe pas
INSERT INTO maintenance (maintenance_type, target_name, enabled, message) 
VALUES ('global', NULL, FALSE, 'Bot en maintenance. Réessayez plus tard.')
ON CONFLICT (maintenance_type, target_name) DO NOTHING;

-- 4. ANTI SPAM BLOCKS - Blocage temporaire pour rate limiting
CREATE TABLE IF NOT EXISTS anti_spam_blocks (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  guild_id VARCHAR(255),
  reason VARCHAR(100),
  blocked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_anti_spam_user_id ON anti_spam_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_anti_spam_blocked_until ON anti_spam_blocks(blocked_until);

-- 5. BACKUPS METADATA - Métadonnées des backups
CREATE TABLE IF NOT EXISTS backups_metadata (
  id SERIAL PRIMARY KEY,
  backup_name VARCHAR(100) NOT NULL UNIQUE,
  backup_type VARCHAR(20), -- 'full', 'partial'
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  file_path TEXT,
  file_size_mb FLOAT,
  description TEXT,
  restored_from BOOLEAN DEFAULT FALSE,
  restored_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups_metadata(created_at);

-- FEATURE FLAGS support removed

-- 7. HEALTH MONITORING - Monitoring santé du bot
CREATE TABLE IF NOT EXISTS health_monitoring (
  id SERIAL PRIMARY KEY,
  check_name VARCHAR(100) NOT NULL,
  is_healthy BOOLEAN DEFAULT TRUE,
  message TEXT,
  details JSONB,
  severity VARCHAR(20), -- 'info', 'warning', 'critical'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_health_monitoring_check ON health_monitoring(check_name);
CREATE INDEX IF NOT EXISTS idx_health_monitoring_created_at ON health_monitoring(created_at);

-- 8. ERROR LOGS - Logs centralisés des erreurs
CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  error_type VARCHAR(100),
  error_message TEXT,
  error_stack TEXT,
  command_name VARCHAR(50),
  user_id VARCHAR(255),
  guild_id VARCHAR(255),
  severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);

-- 9. LOG RETENTION POLICY
-- Auto-cleanup: command_logs older than 30 days
-- Auto-cleanup: error_logs older than 60 days
-- (Implemented via cron job in Node.js - see logPurgeService.js)

-- ============================================
-- Migration Complete
-- ============================================
-- Created 8 new tables:
-- 1. command_logs - Log de toutes les commandes
-- 2. banned_guilds - Serveurs bannis
-- 3. maintenance - État de maintenance
-- 4. anti_spam_blocks - Blocage anti-spam
-- 5. backups_metadata - Métadonnées backups
-- 6. health_monitoring - Monitoring de santé
-- 7. error_logs - Logs centralisés des erreurs
-- 
-- Réutilisé existing tables:
-- - user_bans (para utilisateurs bannis)
-- - audit_logs (pour logs admin)
-- - command_status (pour statut des commandes par guild)
