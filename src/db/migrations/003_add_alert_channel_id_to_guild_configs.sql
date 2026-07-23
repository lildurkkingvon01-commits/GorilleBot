-- ============================================
-- GUILD CONFIGS SCHEMA UPDATE
-- ============================================
-- Date: 2026-07-23
-- Purpose: Add missing columns used by the alert and monitor system.

ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS alert_channel_id VARCHAR(255);

ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS monitor_channel_id VARCHAR(255);

ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS monitor_message_id VARCHAR(255);

ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS last_check_time TIMESTAMP;

ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS reminder_delay INT DEFAULT 24;

ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS command_permissions JSONB DEFAULT '{}';

-- Migration complete
