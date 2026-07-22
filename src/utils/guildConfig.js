import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(__dirname, '../../data/guild_configs');

// Créer le répertoire s'il n'existe pas
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  console.log('✓ Dossier guild_configs/ créé');
}

// Générer une clé secrète aléatoire
function generateWebKey() {
  return crypto.randomBytes(16).toString('hex');
}

function getConfigPath(guildId) {
  return path.join(CONFIG_DIR, `${guildId}.json`);
}

function getDefaultConfig(guildId) {
  return {
    guildId,
    alertChannelId: null,
    monitorChannelId: null,
    monitorMessageId: null,
    alertsViaDM: false,
    inactivityThreshold: 9,
    webKey: generateWebKey(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function getGuildConfig(guildId) {
  try {
    if (!guildId) {
      // Avoid logging spam when guildId is missing
      return getDefaultConfig('unknown');
    }

    const configPath = getConfigPath(guildId);
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(data);
      return config;
    }
    return getDefaultConfig(guildId);
  } catch (error) {
    console.error(`Erreur lecture config ${guildId}:`, error);
    return getDefaultConfig(guildId);
  }
}

export async function setGuildConfig(guildId, alertChannelId, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const configPath = getConfigPath(guildId);
      let config = getGuildConfig(guildId) || getDefaultConfig(guildId);
      
      // Mettre à jour les champs sans écraser si undefined
      if (alertChannelId !== undefined) {
        config.alertChannelId = alertChannelId || null;
      }
      config.updatedAt = Date.now();
      
      // S'assurer qu'il y a une clé web (pour les anciennes configs)
      if (!config.webKey) {
        config.webKey = generateWebKey();
        console.log(`✓ Clé web générée pour ${guildId}: ${config.webKey}`);
      }
      
      if (options.alertsViaDM !== undefined) {
        config.alertsViaDM = options.alertsViaDM;
      }
      if (options.monitorChannelId !== undefined) {
        config.monitorChannelId = options.monitorChannelId;
      }
      if (options.monitorMessageId !== undefined) {
        config.monitorMessageId = options.monitorMessageId;
      }
      if (options.inactivityThreshold !== undefined) {
        config.inactivityThreshold = options.inactivityThreshold;
      }

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log(`✓ Config sauvegardée pour ${guildId}: ${alertChannelId}`);
      resolve(config);
    } catch (error) {
      console.error(`Erreur sauvegarde config ${guildId}:`, error);
      reject(error);
    }
  });
}

export async function updateGuildThreshold(guildId, threshold) {
  return new Promise((resolve, reject) => {
    try {
      const configPath = getConfigPath(guildId);
      let config = getGuildConfig(guildId) || getDefaultConfig(guildId);
      
      config.inactivityThreshold = threshold;
      config.updatedAt = Date.now();

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log(`✓ Seuil mis à jour pour ${guildId}: ${threshold} jours`);
      resolve(config);
    } catch (error) {
      console.error(`Erreur mise à jour seuil ${guildId}:`, error);
      reject(error);
    }
  });
}

export async function setGuildDMAlert(guildId, enabled) {
  return new Promise((resolve, reject) => {
    try {
      const configPath = getConfigPath(guildId);
      let config = getGuildConfig(guildId) || getDefaultConfig(guildId);
      
      config.alertsViaDM = enabled;
      config.updatedAt = Date.now();

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log(`✓ DM alerts ${enabled ? 'activées' : 'désactivées'} pour ${guildId}`);
      resolve(config);
    } catch (error) {
      console.error(`Erreur mise à jour DM alert ${guildId}:`, error);
      reject(error);
    }
  });
}

export function deleteGuildConfig(guildId) {
  try {
    const configPath = getConfigPath(guildId);
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      console.log(`✓ Config supprimée pour ${guildId}`);
    }
  } catch (error) {
    console.error(`Erreur suppression config ${guildId}:`, error);
    throw error;
  }
}

// Gestion des clés secrètes web
export async function setGuildWebKey(guildId, webKey) {
  return new Promise((resolve, reject) => {
    try {
      const configPath = getConfigPath(guildId);
      let config = getGuildConfig(guildId) || getDefaultConfig(guildId);
      
      config.webKey = webKey;
      config.updatedAt = Date.now();

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log(`✓ Clé web générée pour ${guildId}`);
      resolve(config);
    } catch (error) {
      console.error(`Erreur sauvegarde clé web ${guildId}:`, error);
      reject(error);
    }
  });
}

export function getGuildByWebKey(webKey) {
  try {
    // Lire tous les fichiers de config et trouver celui avec la clé
    const files = fs.readdirSync(CONFIG_DIR);
    for (const file of files) {
      const configPath = path.join(CONFIG_DIR, file);
      const data = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(data);
      if (config.webKey === webKey) {
        return config;
      }
    }
    return null;
  } catch (error) {
    console.error('Erreur lecture clé web:', error);
    return null;
  }
}
