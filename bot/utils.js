/**
 * utils.js
 * Shared helpers.
 */

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function errorMessage(err) {
  return err?.response?.data?.message || err?.message || String(err);
}

function safeValue(value, fallback = '-') {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

// 🔥 SINGLE TASK FORMAT
function formatTaskRow(row) {
  if (!Array.isArray(row)) return '❌ Invalid task data';

  const [taskId, title, assigned, dueDate, status] = row;

  return `📌 Task Details

📝 ${safeValue(title)}
👤 ${safeValue(assigned)}
📅 ${safeValue(dueDate)}
📌 ${safeValue(status)}
🆔 ${safeValue(taskId)}`;
}

// 🔥 MULTIPLE TASKS FORMAT (MAIN FUNCTION)
function formatTaskRows(title, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `${title}\n\nNo tasks found.`;
  }

  let message = `${title}\n\n`;

  rows.forEach((row, index) => {
    if (Array.isArray(row)) {
      const [taskId, taskTitle, assigned, dueDate, status] = row;

      message += `${index + 1}. 📝 ${safeValue(taskTitle)}\n`;
      message += `   👤 ${safeValue(assigned)}\n`;
      message += `   📅 ${safeValue(dueDate)}\n`;
      message += `   📌 ${safeValue(status)}\n`;
      message += `   🆔 ${safeValue(taskId)}\n\n`;
    }
  });

  return message;
}

// 🔥 SUMMARY FORMAT
function formatSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return '❌ Invalid summary data';
  }

  return `📊 Summary

Total: ${safeValue(summary.total, '0')}
Pending: ${safeValue(summary.pending, '0')}
In Progress: ${safeValue(summary.inProgress, '0')}
Completed: ${safeValue(summary.completed, '0')}`;
}

module.exports = {
  log,
  normalizePhone,
  errorMessage,
  formatTaskRow,
  formatTaskRows,
  formatSummary,
};