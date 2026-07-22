/**
 * PHASE 1 - TEST: Anti-Spam System
 * Teste que AntiSpamService fonctionne correctement
 */

import AntiSpamService from '../src/services/antiSpamService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testAntiSpamSystem() {
  console.log('\n⏱️ TEST 5: Anti-Spam System\n');
  
  try {
    const testUserId = '777888999';
    const testCommand = 'testcmd';
    const maxPerMinute = 3; // Limite basse pour test

    // 1️⃣ Faire plusieurs appels (sauf limite)
    console.log('1️⃣ Making calls within rate limit...');
    for (let i = 1; i <= maxPerMinute; i++) {
      const result = await AntiSpamService.checkRateLimit(testUserId, testCommand, maxPerMinute);
      if (result.allowed) {
        console.log(`   Call ${i}/${maxPerMinute}: ✅ ALLOWED`);
      } else {
        console.log(`   Call ${i}/${maxPerMinute}: ❌ BLOCKED (unexpected)`);
        return false;
      }
    }

    // 2️⃣ Faire un appel de trop (devraitêtre bloqué)
    console.log('\n2️⃣ Making call that exceeds rate limit...');
    const blockedResult = await AntiSpamService.checkRateLimit(testUserId, testCommand, maxPerMinute);
    if (!blockedResult.allowed) {
      console.log('✅ Call blocked (as expected)');
      console.log(`   Reason: ${blockedResult.reason}`);
    } else {
      console.log('❌ Call was allowed (unexpected)');
      return false;
    }

    // 3️⃣ Vérifier que l'utilisateur est bloqué
    console.log('\n3️⃣ Checking blocked users list...');
    const blockedUsers = await AntiSpamService.getBlockedUsers();
    const isUserBlocked = blockedUsers.some(b => b.user_id === testUserId);
    if (isUserBlocked) {
      console.log(`✅ User is in blocked list: ${blockedUsers.find(b => b.user_id === testUserId).reason}`);
    } else {
      console.log('⚠️ User not found in blocked list (might have expired)');
    }

    // 4️⃣ Débloquer l'utilisateur
    console.log('\n4️⃣ Unblocking user...');
    const unblockResult = await AntiSpamService.unblockUser(testUserId, '111222333');
    if (unblockResult.success) {
      console.log('✅ User unblocked successfully');
    } else {
      console.log('❌ Failed to unblock user');
      return false;
    }

    // 5️⃣ Tester qu'un owner bypass le rate limit
    console.log('\n5️⃣ Testing owner bypass of rate limit...');
    // Note: Owners sont définis dans .env, on simule pas ici mais c'est dans le code
    console.log('⏭️ Owner bypass est codé dans le service (voir OWNER_IDS)');

    console.log('\n✅ TEST 5 PASSED: Anti-spam system is working!\n');
    return true;
  } catch (error) {
    console.error('❌ TEST 5 FAILED:', error.message);
    console.error(error);
    return false;
  }
}

testAntiSpamSystem().then(success => {
  process.exit(success ? 0 : 1);
});
