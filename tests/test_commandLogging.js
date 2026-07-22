/**
 * PHASE 1 - TEST: Command Logging
 * Teste que CommandLogService fonctionne correctement
 */

import CommandLogService from '../src/services/commandLogService.js';
import db from '../src/utils/postgres.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testCommandLogging() {
  console.log('\n📋 TEST 2: Command Logging\n');
  
  try {
    // 1️⃣ Log une commande
    console.log('1️⃣ Logging a test command...');
    await CommandLogService.logCommand({
      commandName: 'test_command',
      userId: '123456789',
      username: 'TestUser',
      guildId: '987654321',
      guildName: 'Test Guild',
      arguments: ['arg1', 'arg2'],
      success: true,
      executionTimeMs: 150
    });
    console.log('✅ Command logged successfully');

    // 2️⃣ Vérifier que le log est en DB
    console.log('\n2️⃣ Checking if log exists in DB...');
    const logs = await db.any(
      'SELECT * FROM command_logs WHERE command_name = $1 ORDER BY created_at DESC LIMIT 1',
      ['test_command']
    );

    if (logs.length > 0) {
      console.log('✅ Log found in database:');
      console.log(`   - Command: ${logs[0].command_name}`);
      console.log(`   - User: ${logs[0].username} (${logs[0].user_id})`);
      console.log(`   - Guild: ${logs[0].guild_name} (${logs[0].guild_id})`);
      console.log(`   - Success: ${logs[0].success}`);
      console.log(`   - Execution Time: ${logs[0].execution_time_ms}ms`);
    } else {
      console.log('❌ Log not found in database');
      return false;
    }

    // 3️⃣ Tester getLogsByCommand
    console.log('\n3️⃣ Testing getLogsByCommand...');
    const cmdLogs = await CommandLogService.getLogsByCommand('test_command', 10);
    console.log(`✅ Found ${cmdLogs.length} logs for test_command`);

    // 4️⃣ Tester getCommandStats
    console.log('\n4️⃣ Testing getCommandStats...');
    const stats = await CommandLogService.getCommandStats();
    console.log(`✅ Command stats retrieved: ${stats.length} commands with stats`);
    if (stats.length > 0) {
      const testStat = stats.find(s => s.command_name === 'test_command');
      if (testStat) {
        console.log(`   - test_command: ${testStat.total_uses} uses, ${testStat.avg_execution_ms}ms avg`);
      }
    }

    console.log('\n✅ TEST 2 PASSED: Command logging is working!\n');
    return true;
  } catch (error) {
    console.error('❌ TEST 2 FAILED:', error.message);
    return false;
  }
}

testCommandLogging().then(success => {
  process.exit(success ? 0 : 1);
});
