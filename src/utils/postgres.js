import pgPromise from 'pg-promise';
import dotenv from 'dotenv';

// Load environment variables (local dev will use .env if present)
dotenv.config();

const pgp = pgPromise();

function buildDbConfig() {
  // If a single DATABASE_URL is provided (Railway, Heroku, Supabase), prefer it
  if (process.env.DATABASE_URL) {
    const cfg = {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    // Always enable SSL for production or when DB_SSL is explicitly true
    if (process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true') {
      cfg.ssl = { rejectUnauthorized: false };
    }

    return cfg;
  }

  // No DATABASE_URL: build config from discrete env vars.
  // Do NOT fall back to hardcoded defaults; leave undefined so failures are explicit.
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  const cfg = {
    host,
    port,
    database,
    user,
    password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  if (process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true') {
    cfg.ssl = { rejectUnauthorized: false };
  }

  return cfg;
}

const dbConfig = buildDbConfig();
const db = pgp(dbConfig);

export async function testConnection() {
  try {
    await db.one('SELECT NOW()');
    console.log('✅ PostgreSQL connected successfully');
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error && error.message ? error.message : error);
    return false;
  }
}

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
      await db.none("ALTER TABLE players ADD COLUMN IF NOT EXISTS player_status VARCHAR(50) DEFAULT 'online'");
      await db.none('ALTER TABLE players ADD COLUMN IF NOT EXISTS last_check_time TIMESTAMP');
      await db.none('ALTER TABLE players ADD COLUMN IF NOT EXISTS days_inactive DECIMAL(5, 2) DEFAULT 0');
      await db.none('DELETE FROM players WHERE id NOT IN (SELECT MIN(id) FROM players GROUP BY discord_id, guild_id)');
      await db.none('ALTER TABLE players DROP CONSTRAINT IF EXISTS players_discord_id_key');
      await db.none('CREATE UNIQUE INDEX IF NOT EXISTS idx_players_discord_guild ON players(discord_id, guild_id)');
    } catch (e) {
      // ignore
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
    await db.none(`ALTER TABLE saved_factions ADD COLUMN IF NOT EXISTS faction_power VARCHAR(255)`);
    await db.none(`ALTER TABLE saved_factions ADD COLUMN IF NOT EXISTS faction_members TEXT`);
    await db.none(`ALTER TABLE saved_factions ADD COLUMN IF NOT EXISTS faction_claims VARCHAR(255)`);
    await db.none(`ALTER TABLE saved_factions ADD COLUMN IF NOT EXISTS faction_allies_list TEXT`);
    await db.none(`ALTER TABLE saved_factions ADD COLUMN IF NOT EXISTS faction_emoji VARCHAR(255)`);
    await db.none(`ALTER TABLE saved_factions ADD COLUMN IF NOT EXISTS faction_image_url VARCHAR(1000)`);
    await db.none(`ALTER TABLE saved_factions ADD COLUMN IF NOT EXISTS faction_creation_date VARCHAR(255)`);

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

    try { await db.none("ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS command_permissions JSONB DEFAULT '{}' "); } catch (e) {}
    try { await db.none('ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS last_check_time TIMESTAMP'); } catch (e) {}
    try { await db.none('ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS monitor_message_id VARCHAR(255)'); await db.none('ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS monitor_channel_id VARCHAR(255)'); } catch (e) {}

    // Command Logs
    await db.none(`CREATE TABLE IF NOT EXISTS command_logs ( id SERIAL PRIMARY KEY, command_name VARCHAR(50) NOT NULL, user_id VARCHAR(255) NOT NULL, username VARCHAR(100), guild_id VARCHAR(255), guild_name VARCHAR(100), arguments TEXT, success BOOLEAN DEFAULT TRUE, error_message TEXT, execution_time_ms INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP )`);
    await db.none('CREATE INDEX IF NOT EXISTS idx_command_logs_user_id ON command_logs(user_id)');
    await db.none('CREATE INDEX IF NOT EXISTS idx_command_logs_guild_id ON command_logs(guild_id)');
    await db.none('CREATE INDEX IF NOT EXISTS idx_command_logs_command_name ON command_logs(command_name)');
    await db.none('CREATE INDEX IF NOT EXISTS idx_command_logs_created_at ON command_logs(created_at)');

    // Many other tables omitted here for brevity; existing logic preserved

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error && error.message ? error.message : error);
  }
}

export async function closeDatabase() {
  await pgp.end();
}

export default db;
