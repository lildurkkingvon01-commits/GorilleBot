/**
 * PHASE 2 - Integration Tests
 * Teste l'intégration du middleware global dans le handler interactionCreate
 */

import CommandLogService from '../src/services/commandLogService.js';
import BanService from '../src/services/banService.js';
import MaintenanceService from '../src/services/maintenanceService.js';
import AntiSpamService from '../src/services/antiSpamService.js';
import db from '../src/utils/postgres.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function runPhase2Tests() {
  console.log('\n🧪 PHASE 2 - INTEGRATION TESTS\n');
  
  const results = [];
  
  try {
    // ========================================
    // TEST 1: Normal Command (Scenario 1)
    // ========================================
    console.log('1️⃣ TEST 1: Normal Command Execution');
    try {
      await CommandLogService.logCommand({
        commandName: 'help',
        userId: '888999111',
        username: 'NormalUser',
        guildId: '555666777',
        guildName: 'Test Guild',
        arguments: [],
        success: true,
        executionTimeMs: 250
      });

      const logs = await db.any('SELECT * FROM command_logs WHERE command_name = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1', ['help', '888999111']);
      
      if (logs.length > 0 && logs[0].success === true) {
        console.log('   ✅ Normal command logged successfully\n');
        results.push({ test: 'Normal Command', status: 'PASS' });
      } else {
        console.log('   ❌ Command not logged properly\n');
        results.push({ test: 'Normal Command', status: 'FAIL' });
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message, '\n');
      results.push({ test: 'Normal Command', status: 'ERROR' });
    }

    // ========================================
    // TEST 2: Admin Command (Scenario 2)
    // ========================================
    console.log('2️⃣ TEST 2: Admin Command Execution');
    try {
      await CommandLogService.logCommand({
        commandName: 'admin',
        userId: '111222333',
        username: 'AdminUser',
        guildId: '555666777',
        guildName: 'Test Guild',
        arguments: ['action=ban', 'user=12345'],
        success: true,
        executionTimeMs: 450
      });

      const logs = await db.any('SELECT * FROM command_logs WHERE command_name = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1', ['admin', '111222333']);
      
      if (logs.length > 0 && logs[0].command_name === 'admin') {
        console.log('   ✅ Admin command logged successfully\n');
        results.push({ test: 'Admin Command', status: 'PASS' });
      } else {
        console.log('   ❌ Admin command not logged properly\n');
        results.push({ test: 'Admin Command', status: 'FAIL' });
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message, '\n');
      results.push({ test: 'Admin Command', status: 'ERROR' });
    }

    // ========================================
    // TEST 3: Banned User (Scenario 3)
    // ========================================
    console.log('3️⃣ TEST 3: Banned User Blocked');
    try {
      const bannedUserId = '777888999';
      
      // Ban the user
      await BanService.banUser({
        userId: bannedUserId,
        username: 'BannedUser',
        reason: 'Test ban',
        bannedBy: '111222333',
        bannedByUsername: 'Admin'
      });

      // Check if banned
      const isBanned = await BanService.isUserBanned(bannedUserId);
      
      if (isBanned) {
        console.log('   ✅ User properly banned and detected\n');
        results.push({ test: 'Banned User', status: 'PASS' });
      } else {
        console.log('   ❌ Ban check failed\n');
        results.push({ test: 'Banned User', status: 'FAIL' });
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message, '\n');
      results.push({ test: 'Banned User', status: 'ERROR' });
    }

    // ========================================
    // TEST 4: Banned Guild (Scenario 4)
    // ========================================
    console.log('4️⃣ TEST 4: Banned Guild Blocked');
    try {
      const bannedGuildId = '111222333';
      
      // Ban the guild
      await BanService.banGuild({
        guildId: bannedGuildId,
        guildName: 'BadGuild',
        reason: 'Test guild ban',
        bannedBy: '111222333',
        bannedByUsername: 'Admin'
      });

      // Check if banned
      const isBanned = await BanService.isGuildBanned(bannedGuildId);
      
      if (isBanned) {
        console.log('   ✅ Guild properly banned and detected\n');
        results.push({ test: 'Banned Guild', status: 'PASS' });
      } else {
        console.log('   ❌ Guild ban check failed\n');
        results.push({ test: 'Banned Guild', status: 'FAIL' });
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message, '\n');
      results.push({ test: 'Banned Guild', status: 'ERROR' });
    }

    // ========================================
    // TEST 5: Global Maintenance (Scenario 5)
    // ========================================
    console.log('5️⃣ TEST 5: Global Maintenance Block');
    try {
      // Enable maintenance
      await MaintenanceService.setGlobalMaintenance(
        true,
        'Bot under maintenance',
        '111222333',
        'Admin'
      );

      // Check if active
      const isActive = await MaintenanceService.isGlobalMaintenanceActive();
      
      if (isActive) {
        console.log('   ✅ Global maintenance properly enabled\n');
        results.push({ test: 'Global Maintenance', status: 'PASS' });
      } else {
        console.log('   ❌ Maintenance check failed\n');
        results.push({ test: 'Global Maintenance', status: 'FAIL' });
      }

      // Disable for next tests
      await MaintenanceService.setGlobalMaintenance(
        false,
        null,
        '111222333',
        'Admin'
      );
    } catch (error) {
      console.error('   ❌ Error:', error.message, '\n');
      results.push({ test: 'Global Maintenance', status: 'ERROR' });
    }

    // ========================================
    // TEST 6: Per-Command Maintenance (Scenario 6)
    // ========================================
    console.log('6️⃣ TEST 6: Per-Command Maintenance');
    try {
      const testCmd = 'addplayer';
      
      // Set command maintenance
      await MaintenanceService.setCommandMaintenance(
        testCmd,
        true,
        'Command under maintenance',
        '111222333',
        'Admin'
      );

      // Check if under maintenance
      const isUnderMaint = await MaintenanceService.isCommandUnderMaintenance(testCmd);
      
      if (isUnderMaint) {
        console.log('   ✅ Command maintenance properly set\n');
        results.push({ test: 'Per-Command Maintenance', status: 'PASS' });
      } else {
        console.log('   ❌ Command maintenance check failed\n');
        results.push({ test: 'Per-Command Maintenance', status: 'FAIL' });
      }

      // Disable for next tests
      await MaintenanceService.setCommandMaintenance(
        testCmd,
        false,
        null,
        '111222333',
        'Admin'
      );
    } catch (error) {
      console.error('   ❌ Error:', error.message, '\n');
      results.push({ test: 'Per-Command Maintenance', status: 'ERROR' });
    }

    // ========================================
    // TEST 7: Spam/Rate Limit (Scenario 7)
    // ========================================
    console.log('7️⃣ TEST 7: Spam Rate Limit');
    try {
      const spamUserId = '444555666';
      const maxPerMinute = 3;

      // Make calls until rate limited
      let lastResult = null;
      for (let i = 0; i < 4; i++) {
        lastResult = await AntiSpamService.checkRateLimit(spamUserId, 'testcmd', maxPerMinute);
      }

      // The 4th call should be blocked
      if (!lastResult.allowed) {
        console.log('   ✅ Rate limit properly enforced\n');
        results.push({ test: 'Spam Rate Limit', status: 'PASS' });
      } else {
        console.log('   ❌ Rate limit not enforced\n');
        results.push({ test: 'Spam Rate Limit', status: 'FAIL' });
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message, '\n');
      results.push({ test: 'Spam Rate Limit', status: 'ERROR' });
    }

    // ========================================
    // TEST 8: Command Error Logging (Scenario 8)
    // ========================================
    console.log('8️⃣ TEST 8: Command Error Logging');
    try {
      const errorUserId = '666777888';
      const errorMsg = 'Test error: Division by zero';
      
      // Log an error
      await CommandLogService.logCommand({
        commandName: 'test_error_cmd',
        userId: errorUserId,
        username: 'ErrorTestUser',
        guildId: '555666777',
        guildName: 'Test Guild',
        arguments: ['--error'],
        success: false,
        errorMessage: errorMsg,
        executionTimeMs: 150
      });

      // Verify the error log
      const logs = await db.any(
        'SELECT * FROM command_logs WHERE command_name = $1 AND user_id = $2 AND success = false ORDER BY created_at DESC LIMIT 1',
        ['test_error_cmd', errorUserId]
      );
      
      if (logs.length > 0 && logs[0].error_message && logs[0].success === false) {
        console.log('   ✅ Command error properly logged\n');
        results.push({ test: 'Command Error Logging', status: 'PASS' });
      } else {
        console.log('   ❌ Error logging failed\n');
        results.push({ test: 'Command Error Logging', status: 'FAIL' });
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message, '\n');
      results.push({ test: 'Command Error Logging', status: 'ERROR' });
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n📊 TEST SUMMARY\n');
    console.log('┌─────────────────────────────┬────────┐');
    console.log('│ Test                        │ Result │');
    console.log('├─────────────────────────────┼────────┤');
    
    let passed = 0;
    results.forEach(r => {
      const status = r.status === 'PASS' ? '✅ PASS' : r.status === 'FAIL' ? '❌ FAIL' : '⚠️  ERR ';
      console.log(`│ ${r.test.padEnd(27)} │ ${status} │`);
      if (r.status === 'PASS') passed++;
    });
    
    console.log('└─────────────────────────────┴────────┘');
    console.log(`\nTotal: ${passed}/${results.length} passed\n`);

    return passed === results.length;
  } catch (error) {
    console.error('Fatal error:', error);
    return false;
  }
}

runPhase2Tests().then(success => {
  process.exit(success ? 0 : 1);
});
