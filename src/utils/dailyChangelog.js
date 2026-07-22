import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHANGELOG_PATH = path.join(__dirname, '../../data/daily-changelog.json');

function loadChangelog() {
  try {
    return JSON.parse(readFileSync(CHANGELOG_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveChangelog(data) {
  writeFileSync(CHANGELOG_PATH, JSON.stringify(data, null, 2));
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// Initialiser et vérifier si on doit réinitialiser à cause d'un changement de jour
export function checkAndResetIfNewDay() {
  const data = loadChangelog();
  const today = getTodayDate();
  
  // Si aujourd'hui n'existe pas dans le changelog, c'est un nouveau jour!
  if (!data[today]) {
    data[today] = [];
    saveChangelog(data);
    console.log(`📅 Nouveau jour détecté (${today}) - Changelog réinitialisé`);
  }
}

// Cronjob pour réinitialiser le changelog à minuit
export function initDailyResetJob() {
  // Réinitialiser à 00:00 (minuit)
  cron.schedule('0 0 * * *', () => {
    const data = loadChangelog();
    const today = getTodayDate();
    
    if (!data[today]) {
      data[today] = [];
      saveChangelog(data);
      console.log(`🌙 Minuit détecté - Nouveau jour (${today}) - Changelog réinitialisé`);
    }
  });
}

export function addChange(change) {
  const data = loadChangelog();
  const today = getTodayDate();
  
  // Initialiser le jour s'il n'existe pas
  if (!data[today]) {
    data[today] = [];
  }
  
  // Vérifier si ce changement existe déjà (anti-doublon)
  const exists = data[today].some(c => {
    // Normaliser les textes pour comparaison (ignorer casse, espaces multiples)
    return c.toLowerCase().trim() === change.toLowerCase().trim();
  });
  
  if (exists) {
    // Changement en doublon, ne pas ajouter
    return { success: false, message: `Changement déjà enregistré: "${change}"` };
  }
  
  data[today].push(change);
  saveChangelog(data);
  
  return { success: true, message: `Changement ajouté: "${change}"` };
}

export function getTodayChanges() {
  const data = loadChangelog();
  const today = getTodayDate();
  
  return data[today] || [];
}

export function clearTodayChanges() {
  const data = loadChangelog();
  const today = getTodayDate();
  
  // La sauvegarde d'aujourd'hui reste, on ne supprime rien
  // Les anciennes entrées restent en historique
  if (data[today]) {
    data[today] = [];
    saveChangelog(data);
  }
  
  return { success: true, message: 'Changelog du jour réinitialisé' };
}

export function getHistory(date = null) {
  const data = loadChangelog();
  
  if (date) {
    return data[date] || [];
  }
  
  return data;
}

export function formatChangelogEmbed(changes) {
  if (!changes || changes.length === 0) {
    return '📭 Aucun changement enregistré';
  }
  
  return changes.slice(0, 20)
    .map((change, i) => `${i + 1}. ${change}`)
    .join('\n');
}
