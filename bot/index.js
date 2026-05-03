require('dotenv').config();
console.log("🔥 Bot started...");

const express = require('express');
const QRCode = require('qrcode');
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
// EXPRESS — QR WEB PAGE
// =======================
const app = express();
let lastQR = null;

app.get('/', async (req, res) => {
  if (!lastQR) return res.send('<h2>QR not ready yet, refresh in 10 seconds...</h2>');
  const img = await QRCode.toDataURL(lastQR);
  res.send(`
    <html>
      <body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif;margin-top:50px">
        <h2>📱 Scan with WhatsApp</h2>
        <img src="${img}" style="width:300px;height:300px"/>
        <p>WhatsApp → Linked Devices → Link a Device → Scan this QR</p>
        <p style="color:grey;font-size:12px">Refresh this page if QR expires</p>
      </body>
    </html>
  `);
});

app.listen(process.env.PORT || 3000, () => {
  console.log('🌐 QR page running on port', process.env.PORT || 3000);
});

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
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ MongoDB connected");

  const store = new MongoStore({ mongoose });

  const client = new Client({
    authStrategy: new RemoteAuth({
      store,
      backupSyncIntervalMs: 300000,
    }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
      ],
    },
  });

  let pairingRequested = false;

  // =======================
  // QR EVENT
  // =======================
  client.on('qr', async (qr) => {
    lastQR = qr;
    console.log("📱 QR ready — open your Railway URL to scan");
    qrcodeTerminal.generate(qr, { small: true });

    // ✅ KEY FIX: request pairing code only on first QR, with longer delay
    if (!pairingRequested && process.env.ADMIN_NUMBER) {
      pairingRequested = true;

      // Wait 8 seconds for WhatsApp Web to fully initialize
      console.log("⏳ Waiting 8s before requesting pairing code...");
      await new Promise(r => setTimeout(r, 8000));

      const phone = process.env.ADMIN_NUMBER.replace(/\D/g, '');
      console.log(`📞 Requesting pairing code for ${phone}...`);

      try {
        const code = await client.requestPairingCode(phone);
        console.log(`\n🔐 ============================`);
        console.log(`🔐 PAIRING CODE: ${code}`);
        console.log(`🔐 ============================\n`);
        console.log(`👉 Open WhatsApp → Linked Devices → Link a Device → Link with phone number → Enter: ${code}`);
      } catch (err) {
        console.error("❌ Pairing code error:", err.message);
        console.log("👉 Use the QR code at your Railway URL instead");
      }
    }
  });

  // =======================
  // READY
  // =======================
  client.on('ready', () => {
    lastQR = null;
    pairingRequested = false;
    console.log("✅ Bot Ready! Listening for messages...");
  });

  client.on('remote_session_saved', () => {
    console.log("💾 Session saved to MongoDB");
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Auth failure:', msg);
    pairingRequested = false;
    setTimeout(() => client.initialize(), 5000);
  });

  client.on('disconnected', (reason) => {
    console.log('⚠️ Disconnected:', reason);
    pairingRequested = false;
    setTimeout(() => client.initialize(), 5000);
  });

  client.on('message', handleMessage);
  client.on('message_create', (message) => {
    if (message.fromMe) handleMessage(message);
  });

  client.initialize();
}

start().catch((err) => {
  console.error("💥 Fatal error during startup:", err.message);
  process.exit(1);
});