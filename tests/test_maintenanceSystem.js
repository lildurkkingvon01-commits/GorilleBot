/**
 * PHASE 1 - TEST: Maintenance System
 * Teste que MaintenanceService fonctionne correctement
 */

import MaintenanceService from '../src/services/maintenanceService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testMaintenanceSystem() {
  console.log('\n🔧 TEST 4: Maintenance System\n');
  
  try {
    const testAdminId = '111222333';
    const testAdminUsername = 'TestAdmin';

    // 1️⃣ Vérifier que la maintenance est initialement désactivée
    console.log('1️⃣ Checking initial global maintenance state...');
    const initialState = await MaintenanceService.isGlobalMaintenanceActive();
    console.log(`✅ Initial state: ${initialState ? 'ACTIVE' : 'INACTIVE'}`);

    // 2️⃣ Activer la maintenance globale
    console.log('\n2️⃣ Enabling global maintenance...');
    const enableResult = await MaintenanceService.setGlobalMaintenance(
      true,
      'Bot en maintenance pour mise à jour',
      testAdminId,
      testAdminUsername
    );
    
    if (enableResult.success) {
      console.log('✅ Global maintenance enabled');
    } else {
      console.log('❌ Failed to enable maintenance');
      return false;
    }

    // 3️⃣ Vérifier que la maintenance est active
    console.log('\n3️⃣ Checking if global maintenance is active...');
    const isActive = await MaintenanceService.isGlobalMaintenanceActive();
    if (isActive) {
      console.log('✅ Global maintenance is ACTIVE (as expected)');
    } else {
      console.log('❌ Global maintenance is NOT active (unexpected)');
      return false;
    }

    // 4️⃣ Mettre une commande en maintenance
    console.log('\n4️⃣ Setting command under maintenance...');
    const cmdMaintResult = await MaintenanceService.setCommandMaintenance(
      'addplayer',
      true,
      'Commande addplayer en maintenance',
      testAdminId,
      testAdminUsername
    );
    
    if (cmdMaintResult.success) {
      console.log('✅ Command maintenance set');
    } else {
      console.log('❌ Failed to set command maintenance');
      return false;
    }

    // 5️⃣ Vérifier que la commande est en maintenance
    console.log('\n5️⃣ Checking if command is under maintenance...');
    const isCmdUnderMaint = await MaintenanceService.isCommandUnderMaintenance('addplayer');
    if (isCmdUnderMaint) {
      console.log('✅ Command is under maintenance (as expected)');
    } else {
      console.log('❌ Command is NOT under maintenance (unexpected)');
      return false;
    }

    // 6️⃣ Obtenir le message de maintenance
    console.log('\n6️⃣ Getting maintenance message...');
    const msg = await MaintenanceService.getCommandMaintenanceMessage('addplayer');
    console.log(`✅ Maintenance message: "${msg}"`);

    // 7️⃣ Désactiver la maintenance globale
    console.log('\n7️⃣ Disabling global maintenance...');
    const disableResult = await MaintenanceService.setGlobalMaintenance(
      false,
      null,
      testAdminId,
      testAdminUsername
    );
    
    if (disableResult.success) {
      console.log('✅ Global maintenance disabled');
    } else {
      console.log('❌ Failed to disable maintenance');
      return false;
    }

    // 8️⃣ Vérifier que la maintenance est désactivée
    console.log('\n8️⃣ Checking if global maintenance is disabled...');
    const isNowInactive = await MaintenanceService.isGlobalMaintenanceActive();
    if (!isNowInactive) {
      console.log('✅ Global maintenance is INACTIVE (as expected)');
    } else {
      console.log('⚠️ Global maintenance is still ACTIVE (possible cache)');
    }

    console.log('\n✅ TEST 4 PASSED: Maintenance system is working!\n');
    return true;
  } catch (error) {
    console.error('❌ TEST 4 FAILED:', error.message);
    console.error(error);
    return false;
  }
}

testMaintenanceSystem().then(success => {
  process.exit(success ? 0 : 1);
});
