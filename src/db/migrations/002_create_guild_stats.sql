-- ============================================
-- GUILD STATS TABLE CREATION
-- ============================================
-- Date: 2026-04-24
-- Purpose: Create guild_stats table for command execution statistics

CREATE TABLE IF NOT EXISTS guild_stats (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(255) NOT NULL,
  command_name VARCHAR(100) NOT NULL,
  stat_date DATE NOT NULL,
  execution_count INTEGER DEFAULT 0,
  total_execution_time_ms INTEGER DEFAULT 0,
  min_execution_ms INTEGER,
  max_execution_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, command_name, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_guild_stats_guild_id ON guild_stats(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_stats_command_name ON guild_stats(command_name);
CREATE INDEX IF NOT EXISTS idx_guild_stats_stat_date ON guild_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_guild_stats_composite ON guild_stats(guild_id, stat_date);

-- Migration Complete: guild_stats table created successfully
