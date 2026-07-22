import db from '../src/utils/postgres.js';

/**
 * Script pour vérifier et mettre à jour les données sauvegardées
 */

async function checkAndFixSavedPlayers() {
  try {
    console.log('🔍 Vérification des joueurs sauvegardés...\n');
    
    const savedPlayers = await db.any('SELECT * FROM saved_players');
    
    if (savedPlayers.length === 0) {
      console.log('❌ Aucun joueur sauvegardé trouvé');
      return;
    }
    
    console.log(`✅ ${savedPlayers.length} joueur(s) trouvé(s):\n`);
    savedPlayers.forEach((player, idx) => {
      console.log(`${idx + 1}. Username: "${player.username}" | URL: "${player.url}" | Faction: "${player.faction}"`);
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Vérifier s'il y a des URLs ou usernames vides
    const incomplete = savedPlayers.filter(p => !p.username || !p.url);
    if (incomplete.length > 0) {
      console.log(`⚠️  ${incomplete.length} joueur(s) avec données incomplètes:`);
      incomplete.forEach(p => {
        console.log(`   - ID: ${p.id} | Username: "${p.username}" | URL: "${p.url}"`);
      });
    } else {
      console.log('✅ Toutes les données sont complètes!');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    process.exit(0);
  }
}

checkAndFixSavedPlayers();
