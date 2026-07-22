import { copyFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUPS_DIR = path.join(__dirname, '../../data/backups');
const DB_PATH = path.join(__dirname, '../../data/players.db');

function getBackupFileName(date = null) {
  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }
  return `backup_${date}.db`;
}

function getBackupFilePath(date) {
  return path.join(BACKUPS_DIR, getBackupFileName(date));
}

export function createBackup() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const backupPath = getBackupFilePath(today);
    
    // Copier la base de données
    copyFileSync(DB_PATH, backupPath);
    
    return { success: true, message: `Sauvegarde créée: ${getBackupFileName(today)}` };
  } catch (error) {
    return { success: false, message: `Erreur lors de la création: ${error.message}` };
  }
}

export function restoreBackup(date) {
  try {
    const backupPath = getBackupFilePath(date);
    
    // Vérifier que la sauvegarde existe
    const exists = readdirSync(BACKUPS_DIR).includes(getBackupFileName(date));
    if (!exists) {
      return { success: false, message: `Sauvegarde du ${date} introuvable` };
    }
    
    // Créer une sauvegarde de l'état actuel d'abord
    const timestamp = new Date().toISOString();
    const currentBackupPath = path.join(BACKUPS_DIR, `backup_restore_${timestamp}.db`);
    copyFileSync(DB_PATH, currentBackupPath);
    
    // Restaurer la sauvegarde
    copyFileSync(backupPath, DB_PATH);
    
    return { success: true, message: `Sauvegarde du ${date} restaurée (sauvegarde actuelle: ${path.basename(currentBackupPath)})` };
  } catch (error) {
    return { success: false, message: `Erreur lors de la restauration: ${error.message}` };
  }
}

export function getAvailableBackups() {
  try {
    const files = readdirSync(BACKUPS_DIR)
      // Filtrer les fichiers de backup normaux
      .filter(f => f.match(/^backup_\d{4}-\d{2}-\d{2}\.db$/))
      .map(f => {
        const date = f.replace('backup_', '').replace('.db', '');
        const filePath = path.join(BACKUPS_DIR, f);
        const stats = statSync(filePath);
        return {
          date,
          fileName: f,
          size: Math.round(stats.size / 1024), // KB
          createdAt: stats.birthtimeMs
        };
      })
      // Trier par date décroissante
      .sort((a, b) => b.createdAt - a.createdAt);
    
    return files;
  } catch (error) {
    console.error('Erreur lors de la lecture des backups:', error);
    return [];
  }
}

export function deleteOldBackups() {
  try {
    const now = Date.now();
    const SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;
    
    const deleted = [];
    
    readdirSync(BACKUPS_DIR).forEach(f => {
      if (f.match(/^backup_\d{4}-\d{2}-\d{2}\.db$/)) {
        const filePath = path.join(BACKUPS_DIR, f);
        const stats = statSync(filePath);
        
        if (now - stats.birthtimeMs > SEVENTY_TWO_HOURS) {
          unlinkSync(filePath);
          deleted.push(f);
        }
      }
    });
    
    return { success: true, deleted, message: `${deleted.length} sauvegarde(s) supprimée(s)` };
  } catch (error) {
    return { success: false, message: `Erreur lors du nettoyage: ${error.message}` };
  }
}

export function getBackupStats() {
  const backups = getAvailableBackups();
  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
  
  return {
    totalBackups: backups.length,
    totalSize: `${totalSize} KB`,
    backups,
    lastBackup: backups[0] || null
  };
}
