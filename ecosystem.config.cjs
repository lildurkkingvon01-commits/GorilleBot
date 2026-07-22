/**
 * PM2 Ecosystem Configuration
 * Production deployment with auto-restart, log rotation, and monitoring
 */

module.exports = {
  apps: [
    {
      name: 'gorille-bot',
      script: './src/index.js',
      namespace: 'gorille',
      instances: 1,
      exec_mode: 'fork',
      
      // Auto-restart settings
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'backups', '.git'],
      max_memory_restart: '512M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Logging with rotation
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=1024'
      },
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Instance settings
      merge_logs: true,
      
      // Disable file watching
      instance_var: 'INSTANCE_ID'
    }
  ],
  
  /**
   * Log rotation settings
   * Rotate logs when they exceed max_size
   */
  module_conf: {
    max_size: '100M',    // Rotate when log exceeds 100MB
    max_file: 10,        // Keep last 10 rotated files
    compress: true,      // Compress rotated logs
    date_format: 'YYYY-MM-DD'
  }
};
