import pgPromise from 'pg-promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pgp = pgPromise();

// PostgreSQL Connection Config
let dbConfig;

// Prefer a single DATABASE_URL (e.g. from Heroku / Supabase) if provided
if (process.env.DATABASE_URL) {
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    // Some hosted Postgres providers require SSL (disable verification when necessary)
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  };
} else {
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'gorille_bot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,  // max pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

const db = pgp(dbConfig);

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const result = await db.one('SELECT NOW()');
    console.log('✅ PostgreSQL connected successfully');
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    return false;
  }
}

/**
 * Initialize database (create tables if not exist)
 */
export async function initializeDatabase() {
  try {
    // Players table
    await db.none(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        discord_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        faction VARCHAR(100),
        level INT DEFAULT 0,
        guild_id VARCHAR(255) NOT NULL,
        url VARCHAR(500),
        player_status VARCHAR(50) DEFAULT 'online',
        last_check_time TIMESTAMP,
        days_inactive DECIMAL(5, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns if table already exists
    try {
      await db.none('ALTER TABLE players ADD COLUMN IF NOT EXISTS url VARCHAR(500)');
      await db.none('ALTER TABLE players ADD COLUMN IF NOT EXISTS player_status VARCHAR(50) DEFAULT \'online\'');
      await db.none('ALTER TABLE players ADD COLUMN IF NOT EXISTS last_check_time TIMESTAMP');
      await db.none('ALTER TABLE players ADD COLUMN IF NOT EXISTS days_inactive DECIMAL(5, 2) DEFAULT 0');
      await db.none('DELETE FROM players WHERE id NOT IN (SELECT MIN(id) FROM players GROUP BY discord_id, guild_id)');
      await db.none('ALTER TABLE players DROP CONSTRAINT IF EXISTS players_discord_id_key');
      await db.none('CREATE UNIQUE INDEX IF NOT EXISTS idx_players_discord_guild ON players(discord_id, guild_id)');
    } catch (e) {
      // Columns or index might already exist, ignore
    }

    // Guilds table
    await db.none(`
      CREATE TABLE IF NOT EXISTS guilds (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon_url VARCHAR(500),
        member_count INT DEFAULT 0,
        bot_present BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Saved Players table
    await db.none(`
      CREATE TABLE IF NOT EXISTS saved_players (
        id SERIAL PRIMARY KEY,
        discord_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        faction VARCHAR(100),
        url VARCHAR(500),
        guild_id VARCHAR(255) NOT NULL,
        saved_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      )
    `);

    // Saved Factions table
    await db.none(`
      CREATE TABLE IF NOT EXISTS saved_factions (
        id SERIAL PRIMARY KEY,
        faction_name VARCHAR(255) NOT NULL,
        url VARCHAR(500),
        faction_power VARCHAR(255),
        faction_members TEXT,
        faction_claims VARCHAR(255),
        faction_allies_list TEXT,
        faction_emoji VARCHAR(255),
        faction_image_url VARCHAR(1000),
        faction_creation_date VARCHAR(255),
        guild_id VARCHAR(255) NOT NULL,
        saved_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
      )
    `);

    // Migrations for saved_factions table
    await db.none(`
      ALTER TABLE saved_factions 
      ADD COLUMN IF NOT EXISTS faction_power VARCHAR(255)
    `);
    await db.none(`
      ALTER TABLE saved_factions 
      ADD COLUMN IF NOT EXISTS faction_members TEXT
    `);
    await db.none(`
      ALTER TABLE saved_factions 
      ADD COLUMN IF NOT EXISTS faction_claims VARCHAR(255)
    `);
    await db.none(`
      ALTER TABLE saved_factions 
      ADD COLUMN IF NOT EXISTS faction_allies_list TEXT
    `);
    await db.none(`
      ALTER TABLE saved_factions 
      ADD COLUMN IF NOT EXISTS faction_emoji VARCHAR(255)
    `);
    await db.none(`
      ALTER TABLE saved_factions 
      ADD COLUMN IF NOT EXISTS faction_image_url VARCHAR(1000)
    `);
    await db.none(`
      ALTER TABLE saved_factions 
      ADD COLUMN IF NOT EXISTS faction_creation_date VARCHAR(255)
    `);

    // Guild Config table
    await db.none(`
      CREATE TABLE IF NOT EXISTS guild_configs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) UNIQUE NOT NULL,
        inactivity_threshold INT DEFAULT 9,
        check_frequency INT DEFAULT 30,
        reminder_delay INT DEFAULT 24,
        broadcast_channel_id VARCHAR(255),
        command_permissions JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add command_permissions column if it doesn't exist
    try {
      await db.none('ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS command_permissions JSONB DEFAULT \'{}\'');
    } catch (e) {
      // Column might already exist, ignore
    }

    // Add last_check_time column if it doesn't exist
    try {
      await db.none('ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS last_check_time TIMESTAMP');
    } catch (e) {
      // Column might already exist, ignore
    }

    // Add monitor_message_id and monitor_channel_id columns if they don't exist
    try {
      await db.none('ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS monitor_message_id VARCHAR(255)');
      await db.none('ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS monitor_channel_id VARCHAR(255)');
    } catch (e) {
      // Columns might already exist, ignore
    }

    // Command Logs table
    await db.none(`
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
      )
    `);

    await db.none('CREATE INDEX IF NOT EXISTS idx_command_logs_user_id ON command_logs(user_id)');
    await db.none('CREATE INDEX IF NOT EXISTS idx_command_logs_guild_id ON command_logs(guild_id)');
    await db.none('CREATE INDEX IF NOT EXISTS idx_command_logs_command_name ON command_logs(command_name)');
    await db.none('CREATE INDEX IF NOT EXISTS idx_command_logs_created_at ON command_logs(created_at)');

    // Maintenance table
    await db.none(`
      CREATE TABLE IF NOT EXISTS maintenance (
        id SERIAL PRIMARY KEY,
        maintenance_type VARCHAR(20) NOT NULL,
        target_name VARCHAR(100),
        enabled BOOLEAN DEFAULT FALSE,
        message TEXT,
        whitelist JSONB,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        UNIQUE(maintenance_type, target_name)
      )
    `);

    await db.none(`
      INSERT INTO maintenance (maintenance_type, target_name, enabled, message)
      VALUES ('global', NULL, FALSE, 'Bot en maintenance. Réessayez plus tard.')
      ON CONFLICT (maintenance_type, target_name) DO NOTHING
    `);

    // Anti-spam blocks table
    await db.none(`
      CREATE TABLE IF NOT EXISTS anti_spam_blocks (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255),
        reason VARCHAR(100),
        blocked_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.none('CREATE INDEX IF NOT EXISTS idx_anti_spam_user_id ON anti_spam_blocks(user_id)');
    await db.none('CREATE INDEX IF NOT EXISTS idx_anti_spam_blocked_until ON anti_spam_blocks(blocked_until)');

    // Backups metadata table
    await db.none(`
      CREATE TABLE IF NOT EXISTS backups_metadata (
        id SERIAL PRIMARY KEY,
        backup_name VARCHAR(100) NOT NULL UNIQUE,
        backup_type VARCHAR(20),
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        file_path TEXT,
        file_size_mb FLOAT,
        description TEXT,
        restored_from BOOLEAN DEFAULT FALSE,
        restored_at TIMESTAMP
      )
    `);

    await db.none('CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups_metadata(created_at)');

    // Feature flags table
    await db.none(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        id SERIAL PRIMARY KEY,
        flag_name VARCHAR(100) NOT NULL UNIQUE,
        enabled BOOLEAN DEFAULT FALSE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.none('CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(flag_name)');
    await db.none(`
      INSERT INTO feature_flags (flag_name, enabled, description) VALUES
      ('command_logs_enabled', TRUE, 'Activer le logging de toutes les commandes'),
      ('audit_logs_enabled', TRUE, 'Activer le logging des actions admin'),
      ('error_logging_enabled', TRUE, 'Activer le logging centralisé des erreurs'),
      ('anti_spam_enabled', TRUE, 'Activer le système anti-spam'),
      ('health_monitoring_enabled', TRUE, 'Activer la surveillance de la santé du bot'),
      ('feature_flags_enabled', TRUE, 'Activer le système de feature flags'),
      ('cache_enabled', TRUE, 'Activer le cache global'),
      ('global_maintenance', FALSE, 'Mettre le bot en maintenance globale')
      ON CONFLICT (flag_name) DO NOTHING
    `);

    // Health monitoring table
    await db.none(`
      CREATE TABLE IF NOT EXISTS health_monitoring (
        id SERIAL PRIMARY KEY,
        check_name VARCHAR(100) NOT NULL,
        is_healthy BOOLEAN DEFAULT TRUE,
        message TEXT,
        details JSONB,
        severity VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.none('CREATE INDEX IF NOT EXISTS idx_health_monitoring_check ON health_monitoring(check_name)');
    await db.none('CREATE INDEX IF NOT EXISTS idx_health_monitoring_created_at ON health_monitoring(created_at)');

    // Error logs table
    await db.none(`
      CREATE TABLE IF NOT EXISTS error_logs (
        id SERIAL PRIMARY KEY,
        error_type VARCHAR(100),
        error_message TEXT,
        error_stack TEXT,
        command_name VARCHAR(50),
        user_id VARCHAR(255),
        guild_id VARCHAR(255),
        severity VARCHAR(20),
        resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.none('CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type)');
    await db.none('CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity)');
    await db.none('CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at)');

    // Global Config table
    await db.none(`
      CREATE TABLE IF NOT EXISTS global_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(255) UNIQUE NOT NULL,
        config_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Audit Logs table
    await db.none(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(255) NOT NULL,
        user_id VARCHAR(255),
        guild_id VARCHAR(255),
        target_id VARCHAR(255),
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Middleware performance table
    await db.none(`
      CREATE TABLE IF NOT EXISTS middleware_performance (
        id SERIAL PRIMARY KEY,
        middleware_name VARCHAR(255) NOT NULL,
        command_name VARCHAR(255),
        user_id VARCHAR(255),
        execution_time_ms INTEGER,
        checks_performed JSONB,
        result VARCHAR(50),
        blocked_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User Bans table
    await db.none(`
      CREATE TABLE IF NOT EXISTS user_bans (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        reason TEXT,
        banned_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      )
    `);

    // Banned Guilds table
    await db.none(`
      CREATE TABLE IF NOT EXISTS banned_guilds (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL UNIQUE,
        guild_name VARCHAR(255),
        reason TEXT,
        banned_by VARCHAR(255),
        banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        is_permanent BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE
      )
    `);

    // Guild stats table
    await db.none(`
      CREATE TABLE IF NOT EXISTS guild_stats (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        command_name VARCHAR(255) NOT NULL,
        stat_date DATE NOT NULL,
        execution_count INTEGER DEFAULT 0,
        total_execution_time_ms INTEGER DEFAULT 0,
        min_execution_ms INTEGER DEFAULT 0,
        max_execution_ms INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (guild_id, command_name, stat_date)
      )
    `);

    // Command Maintenance table
    await db.none(`
      CREATE TABLE IF NOT EXISTS command_maintenance (
        id SERIAL PRIMARY KEY,
        command_name VARCHAR(255) UNIQUE NOT NULL,
        enabled BOOLEAN DEFAULT FALSE,
        updated_by VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Maintenance Whitelist table (with scope and expiration support)
    await db.none(`
      CREATE TABLE IF NOT EXISTS maintenance_whitelist (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        command_name VARCHAR(100),
        scope VARCHAR(20) DEFAULT 'global',
        reason TEXT NOT NULL,
        expires_at TIMESTAMP,
        added_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add migration for existing tables to add missing columns
    try {
      await db.none(`ALTER TABLE maintenance_whitelist ADD COLUMN IF NOT EXISTS command_name VARCHAR(100)`);
      await db.none(`ALTER TABLE maintenance_whitelist ADD COLUMN IF NOT EXISTS scope VARCHAR(20) DEFAULT 'global'`);
      await db.none(`ALTER TABLE maintenance_whitelist ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`);
      await db.none(`ALTER TABLE maintenance_whitelist DROP CONSTRAINT IF EXISTS maintenance_whitelist_user_id_key`);
    } catch (e) {
      // Columns might already exist, ignore
    }

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
  }
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  await pgp.end();
}

export default db;
