/**
 * parser.js
 * Parses incoming WhatsApp messages into structured command objects.
 */

const CORE_COMMANDS = ['done', 'start', 'status'];
const USER_COMMANDS = ['mytasks', 'pending', 'overdue'];
const ADMIN_COMMANDS = ['add', 'assign', 'reassign', 'delete', 'summary', 'broadcast'];
const UTILITY_COMMANDS = ['help'];

const ALL_COMMANDS = [
  ...CORE_COMMANDS,
  ...USER_COMMANDS,
  ...ADMIN_COMMANDS,
  ...UTILITY_COMMANDS,
];

/**
 * Parses a raw message string into a command object.
 * @param {string} text
 * @returns {{ command: string, taskId: string|null, data: object|null } | null}
 */
function parseCommand(text) {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  // Split on whitespace but keep quoted strings together
  const regex = /[^\s"]+|"([^"]*)"/gi;
  const parts = [];
  let match;

  while ((match = regex.exec(trimmed)) !== null) {
    parts.push(match[1] !== undefined ? match[1] : match[0]);
  }

  if (parts.length === 0) return null;

  const command = parts[0].replace(/^!/, '').toLowerCase();
  if (!ALL_COMMANDS.includes(command)) return null;

  let taskId = null;
  let data = null;

  switch (command) {
    case 'done':
    case 'start':
    case 'status':
    case 'delete':
      if (parts.length < 2) return null;
      taskId = parts[1];
      break;

    case 'assign':
    case 'reassign':
      if (parts.length < 3) return null;
      taskId = parts[1];
      data = { assigned: parts[2] };
      break;

    case 'add':
      if (parts.length < 6) return null;
      data = {
        title: parts[1],
        assigned: parts[2],
        dueDate: parts[3],
        projectType: parts[4],
        contact: parts[5],
      };
      break;

    case 'broadcast':
      data = {
        text: parts.slice(1).join(' ').trim(),
      };
      break;

    case 'mytasks':
    case 'pending':
    case 'overdue':
    case 'summary':
    case 'help':
      break;

    default:
      return null;
  }

  return { command, taskId, data };
}

module.exports = {
  parseCommand,
  CORE_COMMANDS,
  USER_COMMANDS,
  ADMIN_COMMANDS,
  UTILITY_COMMANDS,
};