require('dotenv').config();
console.log("🔥 Bot started...");

const qrcodeTerminal = require('qrcode-terminal');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');

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
// MESSAGE HANDLER
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
        const r = await getMyTasks(sender);
        if (!r.success || !Array.isArray(r.data) || r.data.length === 0) {
          return message.reply("📋 Your Tasks\n\nNo tasks found.");
        }
        return message.reply(formatTaskRows("📋 Your Tasks", r.data));
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
        const r = await getSummary();
        if (!r.success || !r.data) {
          return message.reply("❌ Failed to fetch summary");
        }
        return message.reply(formatSummary(r.data));
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
// MAIN START FUNCTION
// =======================
async function start() {
  // Connect to MongoDB for persistent session storage
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ MongoDB connected");

  const store = new MongoStore({ mongoose });

  // =======================
  // CLIENT
  // =======================
  const client = new Client({
    authStrategy: new RemoteAuth({
      store,
      backupSyncIntervalMs: 300000, // save session to MongoDB every 5 minutes
    }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',   // required for Railway low-memory containers
        '--no-zygote',        // prevents Chromium crash in containerized env
      ],
    },
  });

  let pairingCodeRequested = false;

  // =======================
  // QR + PAIRING
  // =======================
  client.on('qr', async (qr) => {
    console.log("📱 Scan this QR code in WhatsApp (Linked Devices):");
    qrcodeTerminal.generate(qr, { small: true });

    // Only attempt pairing code if ADMIN_NUMBER env var is set
    if (!pairingCodeRequested && process.env.ADMIN_NUMBER) {
      pairingCodeRequested = true;

      // Wait 5s for WhatsApp Web JS context to fully load
      await new Promise((resolve) => setTimeout(resolve, 5000));

      try {
        const code = await client.requestPairingCode(
          process.env.ADMIN_NUMBER.replace(/\D/g, '') // strip non-digits
        );
        console.log(`🔐 PAIRING CODE: ${code}`);
      } catch (err) {
        console.error("❌ Pairing code failed (scan QR above instead):", err.message);
        // Don't crash — QR above is still usable
      }
    }
  });

  // =======================
  // READY
  // =======================
  client.on('ready', () => {
    console.log("✅ Bot Ready! Listening for messages...");
    pairingCodeRequested = false; // reset for potential future reconnect
  });

  // =======================
  // SESSION SAVED
  // =======================
  client.on('remote_session_saved', () => {
    console.log("💾 Session saved to MongoDB — bot will auto-reconnect after restarts");
  });

  // =======================
  // AUTH FAILURE — auto restart
  // =======================
  client.on('auth_failure', (msg) => {
    console.error('❌ Auth failure:', msg);
    console.log('🔄 Restarting in 5s...');
    setTimeout(() => client.initialize(), 5000);
  });

  // =======================
  // DISCONNECTED — auto restart
  // =======================
  client.on('disconnected', (reason) => {
    console.log('⚠️ Disconnected:', reason);
    console.log('🔄 Restarting in 5s...');
    pairingCodeRequested = false;
    setTimeout(() => client.initialize(), 5000);
  });

  // =======================
  // MESSAGE EVENTS
  // =======================
  client.on('message', handleMessage);

  client.on('message_create', (message) => {
    if (message.fromMe) {
      handleMessage(message);
    }
  });

  // =======================
  // START CLIENT
  // =======================
  client.initialize();
}

// =======================
// RUN
// =======================
start().catch((err) => {
  console.error("💥 Fatal error during startup:", err.message);
  process.exit(1);
});