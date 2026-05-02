/**
 * config.js
 * Loads and exposes environment variables for the bot.
 */

require('dotenv').config();

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

const ADMIN_NUMBER = normalizePhone(process.env.ADMIN_NUMBER);
const API_URL = String(process.env.API_URL || '').trim();

// Use real WhatsApp group IDs here later (e.g. 1203...@g.us).
// For local testing, it falls back to your admin chat.
const fallbackChat = ADMIN_NUMBER ? `${ADMIN_NUMBER}@c.us` : '';

const GROUPS = {
  Web: '919676460529@c.us',
  Backend: '919676460529@c.us',
  AI: '919676460529@c.us'
};

if (!ADMIN_NUMBER) console.warn('⚠️ ADMIN_NUMBER not set in .env');
if (!API_URL) console.warn('⚠️ API_URL not set in .env');

module.exports = { ADMIN_NUMBER, API_URL, GROUPS };
