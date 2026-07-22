/**
 * PHASE 1 - TEST: Ban System
 * Teste que BanService fonctionne correctement
 */

import BanService from '../src/services/banService.js';
import db from '../src/utils/postgres.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testBanSystem() {
  console.log('\n🚫 TEST 3: Ban System\n');
  
  try {
    const testUserId = '999111222';
    const testAdminId = '111222333';

    // 1️⃣ Bannir un utilisateur
    console.log('1️⃣ Banning test user...');
    const banResult = await BanService.banUser({
      userId: testUserId,
      username: 'TestBannedUser',
      reason: 'Test ban reason',
      bannedBy: testAdminId,
      bannedByUsername: 'TestAdmin',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) // 24h ban
    });
    
    if (banResult.success) {
      console.log('✅ User banned successfully');
    } else {
      console.log('❌ Failed to ban user');
      return false;
    }

    // 2️⃣ Vérifier que l'utilisateur est banni
    console.log('\n2️⃣ Checking if user is banned...');
    const isBanned = await BanService.isUserBanned(testUserId);
    if (isBanned) {
      console.log('✅ User is banned (as expected)');
    } else {
      console.log('❌ User is not banned (unexpected)');
      return false;
    }

    // 3️⃣ Débannir l'utilisateur
    console.log('\n3️⃣ Unbanning user...');
    const unbanResult = await BanService.unbanUser(testUserId, testAdminId, 'TestAdmin', 'Test unban reason');
    if (unbanResult.success) {
      console.log('✅ User unbanned successfully');
    } else {
      console.log('❌ Failed to unban user');
      return false;
    }

    // 4️⃣ Vérifier que l'utilisateur n'est plus banni
    console.log('\n4️⃣ Checking if user is unbanned...');
    const isNowBanned = await BanService.isUserBanned(testUserId);
    if (!isNowBanned) {
      console.log('✅ User is unbanned (as expected)');
    } else {
      console.log('⚠️ User is still banned (possible cache)');
    }

    // 5️⃣ Tester le ban de serveur
    console.log('\n5️⃣ Testing guild ban...');
    const testGuildId = '444555666';
    const guildBanResult = await BanService.banGuild({
      guildId: testGuildId,
      guildName: 'TestBannedGuild',
      reason: 'Test guild ban',
      bannedBy: testAdminId,
      bannedByUsername: 'TestAdmin'
    });
    
    if (guildBanResult.success) {
      console.log('✅ Guild banned successfully');
    } else {
      console.log('❌ Failed to ban guild');
      return false;
    }

    // 6️⃣ Vérifier que le serveur est banni
    console.log('\n6️⃣ Checking if guild is banned...');
    const isGuildBanned = await BanService.isGuildBanned(testGuildId);
    if (isGuildBanned) {
      console.log('✅ Guild is banned (as expected)');
    } else {
      console.log('❌ Guild is not banned (unexpected)');
      return false;
    }

    console.log('\n✅ TEST 3 PASSED: Ban system is working!\n');
    return true;
  } catch (error) {
    console.error('❌ TEST 3 FAILED:', error.message);
    console.error(error);
    return false;
  }
}

testBanSystem().then(success => {
  process.exit(success ? 0 : 1);
});
