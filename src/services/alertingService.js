/**
 * AlertingService - Automated Discord alerts for critical issues
 * Monitors database performance, error rates, and system health
 * Sends real-time notifications to admin channel
 */

import { getDb } from '../utils/database.js';
import { EmbedBuilder } from 'discord.js';

let client;
let alertChannel = null;
let alertThresholds = {
  dbPerformance: 300,      // ms - Alert if DB avg > 300ms
  errorRate: 1000,         // errors/hour - Alert if > 1000 errors in 1 hour
  memoryUsage: 500,        // MB - Alert if > 500 MB
  commandFailRate: 10,     // % - Alert if > 10% failures
  pactifyTimeoutRate: 10,  // % - Alert if > 10% Pactify timeouts
};

let alertCooldown = {};    // Prevent spam of same alert
const COOLDOWN_MS = 60000; // 1 minute between same alerts

export default {
  /**
   * Initialize alerting service
   */
  initialize(discordClient, channelId) {
    client = discordClient;
    
    if (channelId) {
      client.on('ready', () => {
        try {
          alertChannel = client.channels.cache.get(channelId);
          if (alertChannel) {
            console.log(`✅ Alert channel configured: ${alertChannel.name}`);
          } else {
            console.warn(`⚠️ Alert channel not found: ${channelId}`);
          }
        } catch (error) {
          console.error('Error setting alert channel:', error);
        }
      });
    }
    
    // Start automated monitoring
    this.startMonitoring();
  },
  
  /**
   * Start automated monitoring
   */
  startMonitoring() {
    // Check every 5 minutes
    setInterval(async () => {
      try {
        await this.checkDatabasePerformance();
        await this.checkErrorRate();
        await this.checkCommandHealth();
        await this.checkPactifyHealth();
      } catch (error) {
        console.error('Error in monitoring loop:', error);
      }
    }, 5 * 60 * 1000);
    
    console.log('🚨 Alert monitoring started (checks every 5 minutes)');
  },
  
  /**
   * Check database performance
   */
  async checkDatabasePerformance() {
    try {
      // Database performance checks do not include legacy middleware performance metrics.
      return;
      
      const avgMs = parseFloat(result.avg_ms);
      
      if (avgMs > alertThresholds.dbPerformance) {
        await this.sendAlert({
          title: '⚠️ DATABASE PERFORMANCE DEGRADED',
          color: 0xFF9900,
          fields: [
            { name: 'Average Execution Time', value: `${avgMs}ms`, inline: true },
            { name: 'Threshold', value: `${alertThresholds.dbPerformance}ms`, inline: true },
            { name: 'Max Time', value: `${result.max_ms}ms`, inline: true },
            { name: 'Sample Size', value: `${result.executions} queries`, inline: true },
            { name: 'Action Required', value: '• Check slow queries\n• Review indices\n• Check table sizes', inline: false }
          ],
          alertKey: 'db_performance'
        });
      }
    } catch (error) {
      console.error('Error checking DB performance:', error);
    }
  },
  
  /**
   * Check error rate
   */
  async checkErrorRate() {
    try {
      const result = await getDb().oneOrNone(
        `SELECT 
          COUNT(*) as error_count,
          COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
          COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count
        FROM error_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'`
      );
      
      if (!result) return;
      
      const errorCount = parseInt(result.error_count);
      const criticalCount = parseInt(result.critical_count);
      const highCount = parseInt(result.high_count);
      
      // Alert on critical/high errors
      if (criticalCount > 0) {
        const errors = await getDb().manyOrNone(
          `SELECT DISTINCT error_message FROM error_logs
           WHERE created_at > NOW() - INTERVAL '1 hour'
           AND severity IN ('critical', 'high')
           LIMIT 5`
        );
        
        await this.sendAlert({
          title: '🔴 CRITICAL/HIGH ERRORS DETECTED',
          color: 0xFF0000,
          fields: [
            { name: 'Critical Count', value: String(criticalCount), inline: true },
            { name: 'High Count', value: String(highCount), inline: true },
            { name: 'Total Errors (1h)', value: String(errorCount), inline: true },
            { 
              name: 'Sample Errors', 
              value: errors.map(e => `• ${e.error_message.substring(0, 80)}`).join('\n') || 'N/A',
              inline: false 
            }
          ],
          alertKey: 'critical_errors'
        });
      } else if (errorCount > alertThresholds.errorRate) {
        await this.sendAlert({
          title: '⚠️ HIGH ERROR RATE',
          color: 0xFF9900,
          fields: [
            { name: 'Error Count (1h)', value: String(errorCount), inline: true },
            { name: 'Threshold', value: String(alertThresholds.errorRate), inline: true },
            { name: 'Action', value: 'Review error_logs table for patterns', inline: false }
          ],
          alertKey: 'high_error_rate'
        });
      }
    } catch (error) {
      console.error('Error checking error rate:', error);
    }
  },
  
  /**
   * Check command execution health
   */
  async checkCommandHealth() {
    try {
      const result = await getDb().oneOrNone(
        `SELECT 
          COUNT(*) as total_commands,
          COUNT(CASE WHEN success = true THEN 1 END) as successful,
          COALESCE(ROUND(100.0 * COUNT(CASE WHEN success = false THEN 1 END) / NULLIF(COUNT(*), 0), 2), 0) as fail_rate
        FROM command_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'`
      );
      
      if (!result || result.total_commands < 10) return;
      
      const failRate = parseFloat(result.fail_rate || 0);
      
      if (failRate > alertThresholds.commandFailRate) {
        await this.sendAlert({
          title: '⚠️ HIGH COMMAND FAILURE RATE',
          color: 0xFF9900,
          fields: [
            { name: 'Failure Rate', value: `${failRate}%`, inline: true },
            { name: 'Threshold', value: `${alertThresholds.commandFailRate}%`, inline: true },
            { name: 'Failed Commands', value: String(result.total_commands - result.successful), inline: true },
            { name: 'Total Commands', value: String(result.total_commands), inline: true }
          ],
          alertKey: 'command_failures'
        });
      }
    } catch (error) {
      console.error('Error checking command health:', error);
    }
  },
  
  /**
   * Check Pactify scraping health
   */
  async checkPactifyHealth() {
    try {
      const result = await getDb().oneOrNone(
        `SELECT 
          COUNT(*) as total_pactify_calls,
          COUNT(CASE WHEN error_message LIKE '%pactify%' OR error_message LIKE '%timeout%' THEN 1 END) as pactify_errors
        FROM error_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'
        AND (error_message LIKE '%pactify%' OR error_message LIKE '%scrape%' OR error_message LIKE '%timeout%')`
      );
      
      if (!result) return;
      
      const totalCalls = parseInt(result.total_pactify_calls) || 0;
      const errors = parseInt(result.pactify_errors) || 0;
      
      if (totalCalls > 0) {
        const errorRate = (errors / totalCalls) * 100;
        
        if (errorRate > alertThresholds.pactifyTimeoutRate) {
          await this.sendAlert({
            title: '⚠️ PACTIFY SCRAPING ISSUES',
            color: 0xFF9900,
            fields: [
              { name: 'Error Rate', value: `${errorRate.toFixed(2)}%`, inline: true },
              { name: 'Threshold', value: `${alertThresholds.pactifyTimeoutRate}%`, inline: true },
              { name: 'Errors (1h)', value: String(errors), inline: true },
              { name: 'Recent Calls', value: String(totalCalls), inline: true },
              { name: 'Action', value: 'Check Pactify availability / Review retry logic', inline: false }
            ],
            alertKey: 'pactify_errors'
          });
        }
      }
    } catch (error) {
      console.error('Error checking Pactify health:', error);
    }
  },
  
  /**
   * Send alert to Discord channel
   */
  async sendAlert({ title, color, fields, alertKey }) {
    if (!alertChannel) {
      console.warn('⚠️ Alert channel not configured, skipping Discord alert');
      return;
    }
    
    // Cooldown check - prevent spam of same alert
    if (alertCooldown[alertKey]) {
      const timeSinceLastAlert = Date.now() - alertCooldown[alertKey];
      if (timeSinceLastAlert < COOLDOWN_MS) {
        console.log(`ℹ️ Alert '${alertKey}' on cooldown (${(timeSinceLastAlert / 1000).toFixed(0)}s)`);
        return;
      }
    }
    
    try {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: 'PHASE 2+ Monitoring' });
      
      fields.forEach(field => {
        embed.addFields({ 
          name: field.name, 
          value: field.value, 
          inline: field.inline || false 
        });
      });
      
      await alertChannel.send({ embeds: [embed] });
      
      // Update cooldown
      alertCooldown[alertKey] = Date.now();
      
      console.log(`📢 Alert sent: ${title}`);
    } catch (error) {
      console.error('Error sending alert to Discord:', error);
    }
  },
  
  /**
   * Update alert thresholds
   */
  setThreshold(metric, value) {
    if (alertThresholds.hasOwnProperty(metric)) {
      alertThresholds[metric] = value;
      console.log(`✅ Alert threshold updated: ${metric} = ${value}`);
    } else {
      console.warn(`⚠️ Unknown threshold metric: ${metric}`);
    }
  },
  
  /**
   * Get current thresholds
   */
  getThresholds() {
    return { ...alertThresholds };
  }
};
