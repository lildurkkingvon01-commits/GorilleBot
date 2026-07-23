/**
 * STRESS TEST - Performance sous Charge
 * Simule plusieurs commandes simultanées pour tester le middleware
 */

import CommandLogService from '../src/services/commandLogService.js';
import db from '../src/utils/postgres.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function stressTest() {
  console.log('\n⚡ STRESS TEST - Performance sous Charge\n');
  
  const iterations = 50;  // 50 commandes
  const concurrentBatches = 10; // 10 en parallèle
  const delays = [];
  
  console.log(`Simulating ${iterations} commands (${concurrentBatches} concurrent)`);
  console.log('This simulates normal bot usage\n');

  try {
    const startTime = performance.now();
    let successCount = 0;
    let errorCount = 0;

    // Process in batches
    for (let batch = 0; batch < Math.ceil(iterations / concurrentBatches); batch++) {
      const batchStart = performance.now();
      const promises = [];
      
      const batchSize = Math.min(concurrentBatches, iterations - (batch * concurrentBatches));
      
      for (let i = 0; i < batchSize; i++) {
        const commandNum = batch * concurrentBatches + i + 1;
        const cmdStart = performance.now();
        
        const promise = (async () => {
          try {
            // Simulate middleware performance logging
            // Also log command
            await CommandLogService.logCommand({
              commandName: 'test_' + (commandNum % 5),
              userId: 'user_' + (commandNum % 20),
              username: 'TestUser' + commandNum,
              guildId: 'guild_' + (commandNum % 3),
              guildName: 'TestGuild' + (commandNum % 3),
              arguments: ['arg1=val1', 'arg2=val2'],
              success: Math.random() > 0.05,
              executionTimeMs: Math.random() * 500 + 50
            });

            const executionTime = performance.now() - cmdStart;
            delays.push(executionTime);
            successCount++;
            
            return { success: true, time: executionTime };
          } catch (error) {
            errorCount++;
            console.error(`Command ${commandNum} failed:`, error.message);
            return { success: false, error: error.message };
          }
        })();

        promises.push(promise);
      }

      // Wait for batch to complete
      const results = await Promise.allSettled(promises);
      const batchTime = performance.now() - batchStart;
      
      console.log(`Batch ${batch + 1}/${Math.ceil(iterations / concurrentBatches)} completed in ${batchTime.toFixed(2)}ms (${batchSize} commands)`);
    }

    const totalTime = performance.now() - startTime;

    // Calculate statistics
    delays.sort((a, b) => a - b);
    const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
    const minDelay = delays[0];
    const maxDelay = delays[delays.length - 1];
    const p95Delay = delays[Math.floor(delays.length * 0.95)];
    const p99Delay = delays[Math.floor(delays.length * 0.99)];

    // Get database stats
    const dbStats = await db.one(`
      SELECT
        COUNT(*) as total_commands,
        AVG(execution_time_ms) as avg_time,
        MAX(execution_time_ms) as max_time,
        COUNT(CASE WHEN success = false THEN 1 END) as errors
      FROM command_logs
      WHERE created_at > NOW() - INTERVAL '5 minutes'
    `);

    // Print results
    console.log('\n📊 STRESS TEST RESULTS\n');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│ TIMING METRICS                          │');
    console.log('├─────────────────────────────────────────┤');
    console.log(`│ Total Duration:  ${totalTime.toFixed(2).padStart(28)}ms │`);
    console.log(`│ Commands/sec:    ${(iterations / (totalTime / 1000)).toFixed(1).padStart(28)} │`);
    console.log(`│ Avg Response:    ${avgDelay.toFixed(2).padStart(28)}ms │`);
    console.log(`│ Min Response:    ${minDelay.toFixed(2).padStart(28)}ms │`);
    console.log(`│ Max Response:    ${maxDelay.toFixed(2).padStart(28)}ms │`);
    console.log(`│ P95 Response:    ${p95Delay.toFixed(2).padStart(28)}ms │`);
    console.log(`│ P99 Response:    ${p99Delay.toFixed(2).padStart(28)}ms │`);
    console.log('└─────────────────────────────────────────┘');

    console.log('\n┌─────────────────────────────────────────┐');
    console.log('│ SUCCESS RATE                            │');
    console.log('├─────────────────────────────────────────┤');
    console.log(`│ Success:         ${successCount.toString().padStart(28)} │`);
    console.log(`│ Errors:          ${errorCount.toString().padStart(28)} │`);
    console.log(`│ Success Rate:    ${((successCount / iterations * 100).toFixed(1)).padStart(26)}% │`);
    console.log('└─────────────────────────────────────────┘');

    const dbAvgTime = Math.round(parseFloat(dbStats.avg_time));
    const dbWarning = dbAvgTime > 300 ? ' ⚠️ SLOW' : '';
    
    console.log('\n┌─────────────────────────────────────────┐');
    console.log('│ DATABASE STATS                          │');
    console.log('├─────────────────────────────────────────┤');
    console.log(`│ Total Commands:  ${parseInt(dbStats.total_commands).toString().padStart(28)} │`);
    console.log(`│ Avg Time:        ${dbAvgTime.toString().padStart(22)}ms${dbWarning} │`);
    console.log(`│ Max Time:        ${parseInt(dbStats.max_time).toString().padStart(26)}ms │`);
    console.log(`│ Errors:          ${parseInt(dbStats.errors).toString().padStart(28)} │`);
    console.log('└─────────────────────────────────────────┘');
    
    if (dbAvgTime > 300) {
      console.log('\n⚠️  DATABASE PERFORMANCE WARNING');
      console.log('   Avg DB time > 300ms - Monitor query performance');
      console.log('   Consider: indices, table sizes, query optimization');
    }

    // Performance verdict
    console.log('\n🏆 PERFORMANCE VERDICT\n');
    
    const isGood = avgDelay < 200 && successCount === iterations && p99Delay < 500;
    const isWarning = avgDelay < 300 && successCount > (iterations * 0.98) && p99Delay < 700;
    
    if (isGood) {
      console.log('✅ EXCELLENT - Bot performs well under load');
      console.log('   - Response times are good (<200ms avg)');
      console.log('   - 100% success rate');
      console.log('   - P99 latency is acceptable (<500ms)');
      return true;
    } else if (isWarning) {
      console.log('⚠️  WARNING - Bot can handle load but with some degradation');
      console.log('   - Response times acceptable (<300ms avg)');
      console.log('   - Success rate >98%');
      console.log('   - Consider optimization');
      return true;
    } else {
      console.log('❌ POOR - Bot performance degraded under load');
      console.log('   - Response times high (>300ms avg)');
      console.log('   - Success rate <98%');
      console.log('   - Requires optimization');
      return false;
    }

  } catch (error) {
    console.error('❌ Stress test error:', error);
    return false;
  }
}

stressTest().then(success => {
  process.exit(success ? 0 : 1);
});
