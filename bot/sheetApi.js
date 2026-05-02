/**
 * sheetApi.js
 * All HTTP calls from the WhatsApp bot to Google Apps Script.
 * Uses axios. Responses are normalized to { success, data?, message? }.
 */

const axios = require('axios');
const { API_URL } = require('./config');

// ---------- helpers ----------

function normalize(raw) {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { success: false, message: raw };
    }
  }

  if (!raw || typeof raw !== 'object') {
    return { success: false, message: 'Invalid response from API' };
  }

  if (typeof raw.success !== 'boolean') {
    raw.success = !raw.error;
  }

  return raw;
}

async function post(body) {
  if (!API_URL) {
    return { success: false, message: 'API_URL is not configured' };
  }

  try {
    const res = await axios.post(API_URL, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    return normalize(res.data);
  } catch (error) {
    return { success: false, message: error.response?.data?.message || error.message };
  }
}

async function get(params) {
  if (!API_URL) {
    return { success: false, message: 'API_URL is not configured' };
  }

  try {
    const res = await axios.get(API_URL, {
      params,
      timeout: 15000,
    });
    return normalize(res.data);
  } catch (error) {
    return { success: false, message: error.response?.data?.message || error.message };
  }
}

// ---------- API functions ----------

async function updateTaskStatus(taskId, command) {
  const map = {
    done: 'Completed',
    start: 'In Progress',
  };

  return post({
    action: 'updateStatus',
    taskId,
    status: map[command],
  });
}

async function addTask(data) {
  return post({
    action: 'addTask',
    ...data,
  });
}

async function getTaskStatus(taskId) {
  return get({ action: 'status', taskId });
}

async function getMyTasks(phone) {
  return get({ action: 'mytasks', phone });
}

async function getPendingTasks() {
  return get({ action: 'pending' });
}

async function getOverdueTasks() {
  return get({ action: 'overdue' });
}

async function assignTask(taskId, assigned) {
  return post({ action: 'assignTask', taskId, assigned });
}

async function deleteTask(taskId) {
  return post({ action: 'deleteTask', taskId });
}

async function getSummary() {
  return get({ action: 'summary' });
}

module.exports = {
  updateTaskStatus,
  addTask,
  getTaskStatus,
  getMyTasks,
  getPendingTasks,
  getOverdueTasks,
  assignTask,
  deleteTask,
  getSummary,
};