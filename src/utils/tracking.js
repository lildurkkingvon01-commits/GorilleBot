import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export function trackUpdate(type, description, emoji = '📝') {
  try {
    const updatesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'daily-updates.json');
    const today = new Date().toISOString().split('T')[0];
    
    let updates = {};
    try {
      updates = JSON.parse(readFileSync(updatesPath, 'utf8'));
    } catch {
      updates = { updates: [], lastSent: today };
    }
    
    // Trouver ou créer l'entrée du jour
    let todayEntry = updates.updates.find(u => u.date === today);
    if (!todayEntry) {
      todayEntry = {
        date: today,
        changes: [],
        sent: false
      };
      updates.updates.push(todayEntry);
    }
    
    // Ajouter le changement
    todayEntry.changes.push({
      time: new Date().toLocaleTimeString('fr-FR'),
      type: type,
      description: description,
      emoji: emoji
    });
    
    writeFileSync(updatesPath, JSON.stringify(updates, null, 2));
    console.log(`[TRACK] ${emoji} ${type}: ${description}`);
  } catch (error) {
    console.error('Erreur lors du tracking:', error);
  }
}
