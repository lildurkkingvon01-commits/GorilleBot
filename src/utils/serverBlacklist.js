import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLACKLIST_PATH = path.join(__dirname, '../../data/server-blacklist.json');

function loadBlacklist() {
  try {
    return JSON.parse(readFileSync(BLACKLIST_PATH, 'utf8'));
  } catch (e) {
    return { blacklistedServers: [] };
  }
}

function saveBlacklist(data) {
  writeFileSync(BLACKLIST_PATH, JSON.stringify(data, null, 2));
}

export async function banServer(serverId, serverName, reason, userId) {
  const data = loadBlacklist();
  
  // Vérifier si déjà banni
  if (data.blacklistedServers.some(s => s.serverId === serverId)) {
    return { success: false, message: 'Ce serveur est déjà banni' };
  }
  
  data.blacklistedServers.push({
    serverId,
    serverName,
    reason,
    bannedAt: new Date().toISOString(),
    bannedBy: userId
  });
  
  saveBlacklist(data);
  return { success: true, message: `Serveur **${serverName}** banni avec succès` };
}

export async function unbanServer(serverId) {
  const data = loadBlacklist();
  const index = data.blacklistedServers.findIndex(s => s.serverId === serverId);
  
  if (index === -1) {
    return { success: false, message: 'Ce serveur n\'est pas banni' };
  }
  
  const removed = data.blacklistedServers.splice(index, 1);
  saveBlacklist(data);
  
  return { success: true, message: `Serveur **${removed[0].serverName}** débanni`, removed: removed[0] };
}

export function isServerBanned(serverId) {
  const data = loadBlacklist();
  return data.blacklistedServers.some(s => s.serverId === serverId);
}

export function getServerBanInfo(serverId) {
  const data = loadBlacklist();
  return data.blacklistedServers.find(s => s.serverId === serverId);
}

export function getAllBannedServers() {
  return loadBlacklist().blacklistedServers;
}

export function getBanStats() {
  const data = loadBlacklist();
  return {
    totalBanned: data.blacklistedServers.length,
    servers: data.blacklistedServers
  };
}
