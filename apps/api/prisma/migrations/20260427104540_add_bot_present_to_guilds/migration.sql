-- CreateTable
CREATE TABLE "guilds" (
    "id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "icon_url" VARCHAR(500),
    "member_count" INTEGER DEFAULT 0,
    "bot_present" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_configs" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "inactivity_threshold" INTEGER DEFAULT 9,
    "check_frequency" INTEGER DEFAULT 30,
    "reminder_delay" INTEGER DEFAULT 24,
    "broadcast_channel_id" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "command_permissions" JSONB DEFAULT '{}',

    CONSTRAINT "guild_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_modules" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "module_name" VARCHAR(255) NOT NULL,
    "enabled" BOOLEAN DEFAULT true,
    "config" TEXT,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_by" VARCHAR(255),

    CONSTRAINT "guild_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_stats" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "command_name" VARCHAR(100) NOT NULL,
    "stat_date" DATE NOT NULL,
    "execution_count" INTEGER DEFAULT 0,
    "total_execution_time_ms" INTEGER DEFAULT 0,
    "min_execution_ms" INTEGER,
    "max_execution_ms" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guild_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255),
    "guild_id" VARCHAR(255),
    "target_id" VARCHAR(255),
    "details" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "target_name" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_logs" (
    "id" SERIAL NOT NULL,
    "command_name" VARCHAR(50) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "username" VARCHAR(100),
    "guild_id" VARCHAR(255),
    "guild_name" VARCHAR(100),
    "arguments" TEXT,
    "success" BOOLEAN DEFAULT true,
    "error_message" TEXT,
    "execution_time_ms" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" SERIAL NOT NULL,
    "error_type" VARCHAR(100),
    "error_message" TEXT,
    "error_stack" TEXT,
    "command_name" VARCHAR(50),
    "user_id" VARCHAR(255),
    "guild_id" VARCHAR(255),
    "severity" VARCHAR(20),
    "resolved" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discord_events" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "target_id" VARCHAR(255),
    "executor_id" VARCHAR(255),
    "details" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discord_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_status" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "command_name" VARCHAR(255) NOT NULL,
    "enabled" BOOLEAN DEFAULT true,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_by" VARCHAR(255),

    CONSTRAINT "command_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_cooldowns" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "command_name" VARCHAR(255) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "cooldown_type" VARCHAR(50) DEFAULT 'user',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_by" VARCHAR(255),

    CONSTRAINT "command_cooldowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_permissions" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "command_name" VARCHAR(255) NOT NULL,
    "role_id" VARCHAR(255),
    "user_id" VARCHAR(255),
    "permission_type" VARCHAR(50) NOT NULL,
    "allowed" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_by" VARCHAR(255),

    CONSTRAINT "command_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "action_type" VARCHAR(50) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "moderator_id" VARCHAR(255),
    "reason" TEXT,
    "duration_ms" INTEGER,
    "expires_at" TIMESTAMP(6),
    "status" VARCHAR(50) DEFAULT 'active',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_bans" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "reason" TEXT,
    "banned_by" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6),

    CONSTRAINT "user_bans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banned_guilds" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "guild_name" VARCHAR(100),
    "reason" TEXT,
    "banned_by" VARCHAR(255),
    "banned_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6),
    "is_permanent" BOOLEAN DEFAULT true,
    "active" BOOLEAN DEFAULT true,

    CONSTRAINT "banned_guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance" (
    "id" SERIAL NOT NULL,
    "maintenance_type" VARCHAR(20) NOT NULL,
    "target_name" VARCHAR(100),
    "enabled" BOOLEAN DEFAULT false,
    "message" TEXT,
    "whitelist" JSONB,
    "started_at" TIMESTAMP(6),
    "ended_at" TIMESTAMP(6),

    CONSTRAINT "maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_whitelist" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "reason" TEXT,
    "added_by" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "command_name" VARCHAR(100),
    "scope" VARCHAR(20) DEFAULT 'global',
    "expires_at" TIMESTAMP(6),

    CONSTRAINT "maintenance_whitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backups_metadata" (
    "id" SERIAL NOT NULL,
    "backup_name" VARCHAR(100) NOT NULL,
    "backup_type" VARCHAR(20),
    "created_by" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "file_path" TEXT,
    "file_size_mb" DOUBLE PRECISION,
    "description" TEXT,
    "restored_from" BOOLEAN DEFAULT false,
    "restored_at" TIMESTAMP(6),

    CONSTRAINT "backups_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_config" (
    "id" SERIAL NOT NULL,
    "config_key" VARCHAR(255) NOT NULL,
    "config_value" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_monitoring" (
    "id" SERIAL NOT NULL,
    "check_name" VARCHAR(100) NOT NULL,
    "is_healthy" BOOLEAN DEFAULT true,
    "message" TEXT,
    "details" JSONB,
    "severity" VARCHAR(20),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_monitoring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anti_spam_blocks" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "guild_id" VARCHAR(255),
    "reason" VARCHAR(100),
    "blocked_until" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anti_spam_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooldown_tracking" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "command_name" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "cooldown_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automod_config" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "setting_key" VARCHAR(255) NOT NULL,
    "setting_value" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automod_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automod_violations" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "channel_id" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "violation_type" VARCHAR(50) NOT NULL,
    "message_content" TEXT,
    "action_taken" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automod_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "channel_id" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(6),
    "sent_at" TIMESTAMP(6),
    "status" VARCHAR(50) DEFAULT 'pending',
    "created_by" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" SERIAL NOT NULL,
    "guild_id" VARCHAR(255) NOT NULL,
    "channel_id" VARCHAR(255) NOT NULL,
    "creator_id" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) DEFAULT 'open',
    "subject" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(6),
    "closed_by" VARCHAR(255),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" SERIAL NOT NULL,
    "discord_id" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "faction" VARCHAR(100),
    "level" INTEGER DEFAULT 0,
    "guild_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "url" VARCHAR(500),
    "player_status" VARCHAR(50) DEFAULT 'online',
    "last_check_time" TIMESTAMP(6),
    "days_inactive" DECIMAL(5,2) DEFAULT 0,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_players" (
    "id" SERIAL NOT NULL,
    "discord_id" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "faction" VARCHAR(100),
    "url" VARCHAR(500),
    "guild_id" VARCHAR(255) NOT NULL,
    "saved_by" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_factions" (
    "id" SERIAL NOT NULL,
    "faction_name" VARCHAR(255) NOT NULL,
    "url" VARCHAR(500),
    "guild_id" VARCHAR(255) NOT NULL,
    "saved_by" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "faction_power" VARCHAR(255),
    "faction_members" TEXT,
    "faction_claims" VARCHAR(255),
    "faction_allies_list" TEXT,
    "faction_emoji" VARCHAR(255),
    "faction_image_url" VARCHAR(1000),
    "faction_creation_date" VARCHAR(255),

    CONSTRAINT "saved_factions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_guilds_bot_present" ON "guilds"("bot_present");

-- CreateIndex
CREATE UNIQUE INDEX "guild_configs_guild_id_key" ON "guild_configs"("guild_id");

-- CreateIndex
CREATE UNIQUE INDEX "guild_modules_guild_id_module_name_key" ON "guild_modules"("guild_id", "module_name");

-- CreateIndex
CREATE INDEX "idx_guild_stats_command_name" ON "guild_stats"("command_name");

-- CreateIndex
CREATE INDEX "idx_guild_stats_composite" ON "guild_stats"("guild_id", "stat_date");

-- CreateIndex
CREATE INDEX "idx_guild_stats_guild_id" ON "guild_stats"("guild_id");

-- CreateIndex
CREATE INDEX "idx_guild_stats_stat_date" ON "guild_stats"("stat_date");

-- CreateIndex
CREATE UNIQUE INDEX "guild_stats_guild_id_command_name_stat_date_key" ON "guild_stats"("guild_id", "command_name", "stat_date");

-- CreateIndex
CREATE INDEX "idx_command_logs_command_name" ON "command_logs"("command_name");

-- CreateIndex
CREATE INDEX "idx_command_logs_created_at" ON "command_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_command_logs_guild_id" ON "command_logs"("guild_id");

-- CreateIndex
CREATE INDEX "idx_command_logs_user_id" ON "command_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_error_logs_created_at" ON "error_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_error_logs_severity" ON "error_logs"("severity");

-- CreateIndex
CREATE INDEX "idx_error_logs_type" ON "error_logs"("error_type");

-- CreateIndex
CREATE INDEX "idx_discord_events_guild" ON "discord_events"("guild_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_discord_events_type" ON "discord_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "idx_events" ON "discord_events"("guild_id", "event_type", "created_at");

-- CreateIndex

CREATE UNIQUE INDEX "command_status_guild_id_command_name_key" ON "command_status"("guild_id", "command_name");

-- CreateIndex
CREATE INDEX "idx_cooldowns" ON "command_cooldowns"("guild_id", "command_name");

-- CreateIndex
CREATE UNIQUE INDEX "command_cooldowns_guild_id_command_name_cooldown_type_key" ON "command_cooldowns"("guild_id", "command_name", "cooldown_type");

-- CreateIndex
CREATE INDEX "idx_cmd_perms" ON "command_permissions"("guild_id", "command_name");

-- CreateIndex
CREATE UNIQUE INDEX "command_permissions_guild_id_command_name_role_id_user_id_p_key" ON "command_permissions"("guild_id", "command_name", "role_id", "user_id", "permission_type");

-- CreateIndex
CREATE INDEX "idx_moderation" ON "moderation_actions"("guild_id", "user_id", "action_type");

-- CreateIndex
CREATE UNIQUE INDEX "banned_guilds_guild_id_key" ON "banned_guilds"("guild_id");

-- CreateIndex
CREATE INDEX "idx_banned_guilds_active" ON "banned_guilds"("active");

-- CreateIndex
CREATE INDEX "idx_banned_guilds_guild_id" ON "banned_guilds"("guild_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_maintenance_type_target" ON "maintenance"("maintenance_type", "target_name");

-- CreateIndex
CREATE UNIQUE INDEX "backups_metadata_backup_name_key" ON "backups_metadata"("backup_name");

-- CreateIndex
CREATE INDEX "idx_backups_created_at" ON "backups_metadata"("created_at");


-- CreateIndex
CREATE UNIQUE INDEX "global_config_config_key_key" ON "global_config"("config_key");

-- CreateIndex
CREATE INDEX "idx_health_monitoring_check" ON "health_monitoring"("check_name");

-- CreateIndex
CREATE INDEX "idx_health_monitoring_created_at" ON "health_monitoring"("created_at");

-- CreateIndex
CREATE INDEX "idx_anti_spam_blocked_until" ON "anti_spam_blocks"("blocked_until");

-- CreateIndex
CREATE INDEX "idx_anti_spam_user_id" ON "anti_spam_blocks"("user_id");

-- CreateIndex
CREATE INDEX "idx_tracking" ON "cooldown_tracking"("guild_id", "command_name", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "automod_config_guild_id_setting_key_key" ON "automod_config"("guild_id", "setting_key");

-- CreateIndex
CREATE INDEX "idx_violations" ON "automod_violations"("guild_id", "user_id", "violation_type");

-- CreateIndex
CREATE INDEX "idx_announcements" ON "announcements"("guild_id", "status");

-- CreateIndex
CREATE INDEX "idx_tickets" ON "tickets"("guild_id", "status", "creator_id");

-- CreateIndex
CREATE UNIQUE INDEX "players_discord_id_key" ON "players"("discord_id");

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
