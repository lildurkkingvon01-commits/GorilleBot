// Formatter les jours/heures en format lisible
export function formatInactivityTime(daysInactive) {
  const totalHours = Math.round(daysInactive * 24);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days === 0) {
    return `${hours}h`;
  } else if (hours === 0) {
    return `${days}j`;
  } else {
    return `${days}j ${hours}h`;
  }
}

// Créer une barre de progression
export function createProgressBar(current, max, length = 20) {
  const percentage = Math.min(current / max, 1);
  const filled = Math.round((length * percentage));
  const empty = length - filled;
  
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = Math.round(percentage * 100);
  
  return `${bar} ${percent}%`;
}

// Déterminer la couleur basée sur l'inactivité
export function getColorByStatus(status, daysInactive, threshold) {
  switch (status) {
    case 'online':
      return 0x00d26a; // Vert
    case 'inactive':
      if (daysInactive >= threshold) {
        return 0xff0000; // Rouge vif
      } else if (daysInactive >= threshold * 0.7) {
        return 0xff6b6b; // Rouge clair
      } else {
        return 0xffa500; // Orange
      }
    default:
      return 0x3498db; // Bleu
  }
}

// Créer un emoji basé sur le statut
export function getStatusEmoji(status, daysInactive, threshold) {
  if (status === 'online') {
    return '🟢';
  } else if (daysInactive >= threshold) {
    return '🔴';
  } else if (daysInactive >= threshold * 0.7) {
    return '🟠';
  } else {
    return '🟡';
  }
}
