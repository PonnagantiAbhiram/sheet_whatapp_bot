require('dotenv').config();

console.log("🔥 Bot started...");

const qrcodeTerminal = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const { parseCommand, ADMIN_COMMANDS } = require('./parser');
const {
  updateTaskStatus,
  addTask,
  updateTask,
  getTaskStatus,
  getMyTasks,
  getPendingTasks,
  getOverdueTasks,
  assignTask,
  deleteTask,
  getSummary,
} = require('./sheetApi');

const { ADMIN_NUMBER } = require('./config');
const {
  formatTaskRow,
  formatTaskRows,
  formatSummary,
} = require('./utils');
// =======================
// CLIENT
// =======================
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || require('puppeteer').executablePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  },
});
// =======================
// QR + PAIRING
// =======================
client.on('qr', async (qr) => {
  console.log("📱 Scan QR OR use pairing code");
  qrcodeTerminal.generate(qr, { small: true });

  // Wait for the client to fully initialize before requesting the pairing code
  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    const code = await client.requestPairingCode(ADMIN_NUMBER);
    console.log(`🔐 PAIRING CODE: ${code}`);
  } catch (err) {
    console.error("❌ Pairing error:", err.message || err);
    if (err.stack) console.error("❌ Pairing error stack:", err.stack);
  }
});

// =======================
// READY
// =======================
client.on('ready', () => {
  console.log("✅ Bot Ready");
});

// =======================
// HANDLER
// =======================
async function handleMessage(message) {
  const text = message.body?.trim();
  console.log("📩 Received:", text);

  if (!text) return;

  const sender = message.from.replace('@c.us', '');
  const parsed = parseCommand(text);

  if (!parsed) return;

  const { command, taskId, data } = parsed;
  const isAdmin = sender === ADMIN_NUMBER;

  if (ADMIN_COMMANDS.includes(command) && !isAdmin) {
    return message.reply("❌ Admin only");
  }

  try {
    let res;

    switch (command) {

      case 'help':
        return message.reply(
          `📖 Commands:

done <id>
start <id>
status <id>
mytasks
pending
overdue
add "title" name date project contact
update <id> "title" name date project contact
delete <id>
summary`
        );

      case 'done':
      case 'start':
        res = await updateTaskStatus(taskId, command);
        return message.reply(res.success ? "✅ Updated" : "❌ Failed");

      case 'add':
        res = await addTask(data);
        return message.reply(res.success ? "✅ Task added" : "❌ Failed");

      case 'update':
        res = await updateTask(data);
        return message.reply(res.success ? "✅ Task updated" : "❌ Failed");

      case 'delete':
        res = await deleteTask(taskId);
        return message.reply(res.success ? "✅ Deleted" : "❌ Failed");

      case 'status':
        res = await getTaskStatus(taskId);
        return message.reply(formatTaskRow(res.data));

      case 'mytasks': {
        const res = await getMyTasks(sender);

        if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
          return message.reply("📋 Your Tasks\n\nNo tasks found.");
        }

        return message.reply(formatTaskRows("📋 Your Tasks", res.data));
      }
      case 'pending':
        res = await getPendingTasks();
        return message.reply(formatTaskRows("📌 Pending Tasks", res.data));

      case 'overdue':
        res = await getOverdueTasks();
        return message.reply(formatTaskRows("⚠️ Overdue Tasks", res.data));

      case 'assign':
      case 'reassign':
        res = await assignTask(taskId, data.assigned);
        return message.reply(res.success ? "✅ Assigned" : "❌ Failed");

      case 'summary': {
        const res = await getSummary();

        if (!res.success || !res.data) {
          return message.reply("❌ Failed to fetch summary");
        }

        return message.reply(formatSummary(res.data));
      }

      default:
        return message.reply("❌ Unknown command");
    }

  } catch (err) {
    console.error("🔥 ERROR:", err.message);
    message.reply(`❌ ERROR: ${err.message}`);
  }
}

// =======================
// EVENTS
// =======================
client.on('message', handleMessage);

client.on('message_create', (message) => {
  if (message.fromMe) {
    handleMessage(message);
  }
});

// =======================
// START
// =======================
client.initialize();