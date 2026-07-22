/**
 * Guild Action Service - Bot polls and executes pending actions
 * 
 * Actions:
 * - LEAVE: Bot leaves the guild
 * 
 * Features:
 * - 5 second timeout on API requests
 * - Graceful degradation if API is offline
 * - No spam if API is consistently unavailable
 */

// Module-scope variables for tracking API failures (avoid circular references)
let errorCount = 0;
const maxConsecutiveErrors = 3;

export class GuildActionService {
  /**
   * Poll API for pending actions and execute them
   */
  static getApiUrl() {
    return process.env.API_URL || null;
  }

  static async syncAndExecuteActions(client) {
    try {
      const apiUrl = this.getApiUrl();
      if (!apiUrl) {
        if (process.env.DEBUG_GUILD_ACTIONS) {
          console.log('[GUILD ACTIONS] API_URL not set, skipping guild action polling');
        }
        return;
      }

      const syncUrl = `${apiUrl}/api/bot/guild-actions`;

      // Log the attempt (once per iteration for debugging)
      if (process.env.DEBUG_GUILD_ACTIONS) {
        console.log(`[GUILD ACTIONS] Polling: ${syncUrl}`);
      }

      // Fetch with strict 5 second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      let response;
      try {
        response = await fetch(syncUrl, {
          signal: controller.signal,
          timeout: 5000
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // Handle non-OK responses
      if (!response.ok) {
        console.warn(`[GUILD ACTIONS] API returned status ${response.status} (${response.statusText})`);
        errorCount++;
        return;
      }

      // Parse response
      const result = await response.json();
      const actions = result.data || [];

      // Reset error count on successful sync
      if (errorCount > 0) {
        console.log(`[GUILD ACTIONS] ✅ API recovered after ${errorCount} failed attempt(s)`);
        errorCount = 0;
      }

      if (actions.length === 0) {
        if (process.env.DEBUG_GUILD_ACTIONS) {
          console.log('[GUILD ACTIONS] ✅ Synced (no pending actions)');
        }
        return;
      }

      console.log(`[GUILD ACTIONS] Found ${actions.length} pending action(s)`);

      for (const action of actions) {
        await this.executeAction(client, action, apiUrl);
      }
    } catch (error) {
      // Handle specific error types gracefully
      if (error.name === 'AbortError') {
        errorCount++;
        
        // Only log after multiple failures
        if (errorCount <= maxConsecutiveErrors) {
          console.warn(`[GUILD ACTIONS] Request timeout (${errorCount}/${maxConsecutiveErrors})`);
        }
        return;
      }

      if (error.code === 'ECONNREFUSED') {
        errorCount++;
        
        // Only log after multiple failures to avoid spam
        if (errorCount === 1) {
          console.warn('[GUILD ACTIONS] ⚠️  Cannot reach API (ECONNREFUSED). Web panel/API may be offline.');
          console.warn('[GUILD ACTIONS] Will continue retrying silently...');
        } else if (errorCount > maxConsecutiveErrors && errorCount % 5 === 0) {
          console.warn(`[GUILD ACTIONS] Still unable to reach API (${errorCount} attempts failed)`);
        }
        return;
      }

      if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        errorCount++;
        if (errorCount === 1) {
          console.warn(`[GUILD ACTIONS] Network error: ${error.code}. Continuing...`);
        }
        return;
      }

      // Unexpected error
      console.error('[GUILD ACTIONS] Unexpected error:', error.message);
    }
  }

  /**
   * Execute a single action
   */
  static async executeAction(client, action, apiUrl) {
    try {
      const { id, action_type, guild_id, reason } = action;

      console.log(`[GUILD ACTIONS] Executing ${action_type} for guild ${guild_id} (ID: ${id})`);

      // EXECUTE: LEAVE
      if (action_type === 'LEAVE') {
        try {
          const guild = client.guilds.cache.get(guild_id);
          
          if (!guild) {
            console.warn(`[GUILD ACTIONS] Guild ${guild_id} not in cache (already left?)`);
            await this.markActionFailed(id, apiUrl, 'Guild not in cache');
            return;
          }

          // Leave the guild
          await guild.leave();
          console.log(`[GUILD ACTIONS] ✅ Bot left guild ${guild_id}`);

          // Mark as completed
          await this.markActionCompleted(id, apiUrl);
        } catch (leaveError) {
          console.error(`[GUILD ACTIONS] Error leaving guild ${guild_id}:`, leaveError.message);
          await this.markActionFailed(id, apiUrl, leaveError.message);
        }
      } else {
        console.warn(`[GUILD ACTIONS] Unknown action type: ${action_type}`);
        await this.markActionFailed(id, apiUrl, `Unknown action type: ${action_type}`);
      }
    } catch (error) {
      console.error(`[GUILD ACTIONS] Error executing action:`, error.message);
    }
  }

  /**
   * Mark action as completed in API
   */
  static async markActionCompleted(actionId, apiUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`${apiUrl}/api/bot/guild-actions/${actionId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: controller.signal,
          timeout: 5000
        });

        if (!response.ok) {
          console.warn(`[GUILD ACTIONS] Failed to mark action ${actionId} as completed: ${response.status}`);
          return;
        }

        console.log(`[GUILD ACTIONS] Action ${actionId} marked as COMPLETED in API`);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // Silently ignore network errors on action completion
      if (error.code === 'ECONNREFUSED' || error.name === 'AbortError') {
        if (process.env.DEBUG_GUILD_ACTIONS) {
          console.warn(`[GUILD ACTIONS] Could not notify API about action completion (API offline?)`);
        }
        return;
      }
      console.error(`[GUILD ACTIONS] Error marking action as completed:`, error.message);
    }
  }

  /**
   * Mark action as failed in API
   */
  static async markActionFailed(actionId, apiUrl, reason) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`${apiUrl}/api/bot/guild-actions/${actionId}/fail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
          signal: controller.signal,
          timeout: 5000
        });

        if (!response.ok) {
          console.warn(`[GUILD ACTIONS] Failed to mark action ${actionId} as failed: ${response.status}`);
          return;
        }

        console.log(`[GUILD ACTIONS] Action ${actionId} marked as FAILED in API (${reason})`);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // Silently ignore network errors on action failure reporting
      if (error.code === 'ECONNREFUSED' || error.name === 'AbortError') {
        if (process.env.DEBUG_GUILD_ACTIONS) {
          console.warn(`[GUILD ACTIONS] Could not notify API about action failure (API offline?)`);
        }
        return;
      }
      console.error(`[GUILD ACTIONS] Error marking action as failed:`, error.message);
    }
  }
}

export default GuildActionService;
