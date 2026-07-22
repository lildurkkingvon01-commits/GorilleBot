/**
 * Ticket Manager - Phase 5.2
 * Système de tickets avec canaux Discord
 */

import db from './postgres.js';

/**
 * Create ticket
 */
export async function createTicket(guildId, userId, categoryId, reason) {
  try {
    const ticket = await db.one(
      `INSERT INTO tickets (guild_id, user_id, category_id, reason, status)
       VALUES ($1, $2, $3, $4, 'open')
       RETURNING *`,
      [guildId, userId, categoryId, reason]
    );
    
    return ticket;
  } catch (error) {
    console.error('[TicketManager] Error creating ticket:', error);
    throw error;
  }
}

/**
 * Get ticket
 */
export async function getTicket(id) {
  try {
    return await db.one(
      `SELECT * FROM tickets WHERE id = $1`,
      [id]
    );
  } catch (error) {
    console.error('[TicketManager] Error getting ticket:', error);
    return null;
  }
}

/**
 * Get tickets for user
 */
export async function getUserTickets(userId, guildId = null) {
  try {
    let query = 'SELECT * FROM tickets WHERE user_id = $1';
    const params = [userId];
    
    if (guildId) {
      query += ' AND guild_id = $2';
      params.push(guildId);
    }
    
    query += ' ORDER BY created_at DESC';
    
    return await db.any(query, params);
  } catch (error) {
    console.error('[TicketManager] Error getting user tickets:', error);
    return [];
  }
}

/**
 * Get open tickets for guild
 */
export async function getOpenTickets(guildId) {
  try {
    return await db.any(
      `SELECT * FROM tickets WHERE guild_id = $1 AND status = 'open' ORDER BY created_at DESC`,
      [guildId]
    );
  } catch (error) {
    console.error('[TicketManager] Error getting open tickets:', error);
    return [];
  }
}

/**
 * Get all guild tickets
 */
export async function getGuildTickets(guildId) {
  try {
    return await db.any(
      `SELECT * FROM tickets WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [guildId]
    );
  } catch (error) {
    console.error('[TicketManager] Error getting guild tickets:', error);
    return [];
  }
}

/**
 * Update ticket status
 */
export async function updateTicketStatus(id, status, closedBy = null) {
  try {
    return await db.one(
      `UPDATE tickets 
       SET status = $2, closed_by = $3, closed_at = CASE WHEN $2 = 'closed' THEN CURRENT_TIMESTAMP ELSE closed_at END, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, status, closedBy]
    );
  } catch (error) {
    console.error('[TicketManager] Error updating status:', error);
    throw error;
  }
}

/**
 * Add message to ticket
 */
export async function addTicketMessage(ticketId, userId, content, isStaff = false) {
  try {
    return await db.one(
      `INSERT INTO ticket_messages (ticket_id, user_id, content, is_staff)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ticketId, userId, content, isStaff]
    );
  } catch (error) {
    console.error('[TicketManager] Error adding message:', error);
    throw error;
  }
}

/**
 * Get ticket messages
 */
export async function getTicketMessages(ticketId, limit = 50) {
  try {
    return await db.any(
      `SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [ticketId, limit]
    );
  } catch (error) {
    console.error('[TicketManager] Error getting messages:', error);
    return [];
  }
}

/**
 * Assign staff to ticket
 */
export async function assignStaff(ticketId, staffId) {
  try {
    return await db.one(
      `UPDATE tickets 
       SET assigned_to = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [ticketId, staffId]
    );
  } catch (error) {
    console.error('[TicketManager] Error assigning staff:', error);
    throw error;
  }
}

/**
 * Get ticket stats
 */
export async function getTicketStats(guildId) {
  try {
    const total = await db.one(
      `SELECT COUNT(*) as count FROM tickets WHERE guild_id = $1`,
      [guildId]
    );
    
    const open = await db.one(
      `SELECT COUNT(*) as count FROM tickets WHERE guild_id = $1 AND status = 'open'`,
      [guildId]
    );
    
    const closed = await db.one(
      `SELECT COUNT(*) as count FROM tickets WHERE guild_id = $1 AND status = 'closed'`,
      [guildId]
    );
    
    const avgResolutionTime = await db.one(
      `SELECT AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/3600) as hours
       FROM tickets WHERE guild_id = $1 AND status = 'closed'`,
      [guildId]
    );
    
    return {
      total: total.count,
      open: open.count,
      closed: closed.count,
      avg_resolution_hours: avgResolutionTime.hours ? Math.round(avgResolutionTime.hours) : 0
    };
  } catch (error) {
    console.error('[TicketManager] Error getting stats:', error);
    return { total: 0, open: 0, closed: 0, avg_resolution_hours: 0 };
  }
}

/**
 * Archive ticket
 */
export async function archiveTicket(ticketId) {
  try {
    // Get all messages
    const messages = await getTicketMessages(ticketId, 1000);
    const transcript = messages.map(m => 
      `[${new Date(m.created_at).toLocaleString()}] ${m.user_id}: ${m.content}`
    ).reverse().join('\n');
    
    // Store archive
    await db.none(
      `UPDATE tickets SET transcript = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [ticketId, transcript]
    );
    
    return true;
  } catch (error) {
    console.error('[TicketManager] Error archiving:', error);
    return false;
  }
}

export default {
  createTicket,
  getTicket,
  getUserTickets,
  getOpenTickets,
  getGuildTickets,
  updateTicketStatus,
  addTicketMessage,
  getTicketMessages,
  assignStaff,
  getTicketStats,
  archiveTicket
};
