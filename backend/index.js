require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const mongoose = require('mongoose');
const { Ticket, User, Department, Photo, News } = require('./models');

const PORT = process.env.PORT || 3000;

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const NEWS_UPLOAD_DIR = path.join(UPLOAD_DIR, 'news');
if (!fs.existsSync(NEWS_UPLOAD_DIR)) {
  fs.mkdirSync(NEWS_UPLOAD_DIR, { recursive: true });
}

const app = express();
const upload = multer({ dest: UPLOAD_DIR });
const newsUpload = multer({
  storage: multer.diskStorage({
    destination: NEWS_UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
      cb(null, name);
    }
  })
});

const DAY_MS = 24 * 60 * 60 * 1000;
const sessions = {}; // token -> { userId, expires }

async function getNextTicketNumber() {
  const last = await Ticket.findOne().sort('-ticketNumber').select('ticketNumber');
  return last && last.ticketNumber ? last.ticketNumber + 1 : 100001;
}

// Connected Server-Sent Events clients
const eventClients = [];
function sendEvent(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  eventClients.forEach(res => res.write(payload));
}

app.use(express.json());

function getTokenFromCookie(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|; )token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  let token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) token = getTokenFromCookie(req);
  if (token && sessions[token]) {
    const session = sessions[token];
    if (session.expires > Date.now()) {
      const user = await User.findById(session.userId);
      if (user) req.user = user;
    } else {
      delete sessions[token];
    }
  }
  next();
}

app.use(authMiddleware);

// Events stream for real-time updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  eventClients.push(res);
  req.on('close', () => {
    const idx = eventClients.indexOf(res);
    if (idx !== -1) eventClients.splice(idx, 1);
  });
});


// Authentication
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = await User.findOne({ username });
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'invalid' });
  }
  const token = crypto.randomBytes(16).toString('hex');
  sessions[token] = { userId: user._id, expires: Date.now() + DAY_MS };
  res.cookie('token', token, { path: '/', maxAge: DAY_MS });
  res.json({
    token,
    user: { id: user._id, username: user.username, role: user.role, departmentId: user.departmentId }
  });
});

app.post('/api/logout', (req, res) => {
  const auth = req.headers.authorization;
  let token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) token = getTokenFromCookie(req);
  if (token) delete sessions[token];
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const { id, username, role, departmentId } = req.user;
  res.json({ id, username, role, departmentId });
});

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    console.log(`[403] ${req.method} ${req.originalUrl} - role:${req.user ? req.user.role : 'none'} requires admin`);
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

function requireAdminOrSuperuser(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superuser')) {
    console.log(`[403] ${req.method} ${req.originalUrl} - role:${req.user ? req.user.role : 'none'} requires admin/superuser`);
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

function requireSuperuser(req, res, next) {
  if (!req.user || req.user.role !== 'superuser') {
    console.log(`[403] ${req.method} ${req.originalUrl} - role:${req.user ? req.user.role : 'none'} requires superuser`);
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

const FRONTEND = path.join(__dirname, '../frontend');
const PUBLIC_DIR = path.join(__dirname, '../public');
const SRC_DIR = path.join(__dirname, '../src');

app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND, 'index.html'));
});

app.get(['/faults', '/faults.html', '/tickets', '/tickets.html'], (req, res) => {
  if (!req.user) return res.redirect('/login.html');
  res.sendFile(path.join(FRONTEND, 'tickets.html'));
});

app.get('/admin/news', (req, res) => {
  if (!req.user || req.user.role !== 'superuser') return res.redirect('/login.html');
  res.sendFile(path.join(FRONTEND, 'admin-news.html'));
});

app.get('/admin', (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/login.html');
  res.sendFile(path.join(FRONTEND, 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/login.html');
  res.sendFile(path.join(FRONTEND, 'admin.html'));
});

app.get(['/search', '/requests/search'], (req, res) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superuser')) return res.redirect('/login.html');
  res.sendFile(path.join(FRONTEND, 'search.html'));
});

app.use(express.static(PUBLIC_DIR));
app.use(express.static(SRC_DIR));
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));
app.use(express.static(FRONTEND));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/status', (req, res) => {
  res.json({ message: 'Сервер работает' });
});

// Departments
app.get('/api/departments', async (req, res) => {
  const list = await Department.find();
  res.json(list);
});

app.post('/api/departments', async (req, res) => {
  const dept = await Department.create({ name: req.body.name || '' });
  console.log('Saved to DB');
  res.json(dept);
});

app.delete('/api/departments/:id', async (req, res) => {
  await Department.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});


// Users (admin or superuser)
app.get('/api/users', requireAdminOrSuperuser, async (req, res) => {
  const list = await User.find();
  res.json(list);
});

app.post('/api/users', requireAdminOrSuperuser, async (req, res) => {
  const body = req.body || {};
  const user = await User.create({
    username: body.username || '',
    passwordHash: bcrypt.hashSync(body.password || '1234', 10),
    role: body.role || 'user',
    departmentId: body.departmentId || null,
    email: body.email || '',
    name: body.name || ''
  });
  console.log('Saved to DB');
  res.json(user);
});

app.delete('/api/users/:id', requireAdminOrSuperuser, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

app.post('/api/users/:id/password', requireAdminOrSuperuser, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  user.passwordHash = bcrypt.hashSync(req.body.password || '1234', 10);
  await user.save();
  console.log('Saved to DB');
  res.json({ ok: true });
});

app.patch('/api/users/:id', requireAdminOrSuperuser, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  const { username, password, role, departmentId, email, name } = req.body || {};
  if (username !== undefined) user.username = username;
  if (email !== undefined) user.email = email;
  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (departmentId !== undefined) user.departmentId = departmentId;
  if (password) user.passwordHash = bcrypt.hashSync(password, 10);
  await user.save();
  console.log('Saved to DB');
  res.json(user);
});

// Получить список заявок с фильтрацией
app.get('/api/tickets', async (req, res) => {
  const query = {};
  if (req.query.status === 'open') {
    // include documents missing `isClosed` when fetching open tickets
    query.isClosed = { $ne: true };
  }
  if (req.query.room) query.room = req.query.room;
  if (req.user && req.user.role !== 'admin' && req.user.role !== 'superuser') {
    query.departmentId = req.user.departmentId;
  } else if (req.query.departmentId) {
    query.departmentId = req.query.departmentId;
  }
  const tickets = await Ticket.find(query);
  const list = [];
  for (const t of tickets) {
    const hasPhoto = await Photo.exists({ ticketId: t._id });
    list.push({ ...t.toObject(), photoUrl: hasPhoto ? `/api/photos/${t._id}` : '' });
  }
  res.json(list);
});

// Получить закрытые заявки с фильтрами
app.get('/api/tickets/closed', async (req, res) => {
  const query = { isClosed: true };
  if (req.query.room) query.room = req.query.room;
  if (req.query.from || req.query.to) {
    query.closedAt = {};
    if (req.query.from) query.closedAt.$gte = new Date(req.query.from);
    if (req.query.to) query.closedAt.$lte = new Date(req.query.to);
  }
  if (req.user && req.user.role !== 'admin' && req.user.role !== 'superuser') {
    query.departmentId = req.user.departmentId;
  } else if (req.query.departmentId) {
    query.departmentId = req.query.departmentId;
  }
  const tickets = await Ticket.find(query);
  res.json(tickets);
});

// Search tickets with various filters
app.get('/api/tickets/search', async (req, res) => {
  const query = {};
  if (req.query.openFrom || req.query.openTo) {
    query.openedAt = {};
    if (req.query.openFrom) query.openedAt.$gte = new Date(req.query.openFrom);
    if (req.query.openTo) query.openedAt.$lte = new Date(req.query.openTo);
  }
  if (req.query.closeFrom || req.query.closeTo) {
    query.closedAt = {};
    if (req.query.closeFrom) query.closedAt.$gte = new Date(req.query.closeFrom);
    if (req.query.closeTo) query.closedAt.$lte = new Date(req.query.closeTo);
  }
  if (req.query.room) query.room = req.query.room;
  if (req.query.status) {
    if (req.query.status === 'closed') query.isClosed = true;
    else if (req.query.status === 'open' || req.query.status === 'inprogress') query.isClosed = false;
  }
  if (req.query.openedBy) query.openedBy = new RegExp(req.query.openedBy, 'i');
  if (req.query.closedBy) query.closedBy = new RegExp(req.query.closedBy, 'i');
  if (req.query.departmentId) query.departmentId = req.query.departmentId;
  if (req.query.keyword) query.description = new RegExp(req.query.keyword, 'i');
  if (req.user && req.user.role !== 'admin' && req.user.role !== 'superuser') {
    query.departmentId = req.user.departmentId;
  }
  const tickets = await Ticket.find(query);
  const list = [];
  for (const t of tickets) {
    const hasPhoto = await Photo.exists({ ticketId: t._id });
    list.push({ ...t.toObject(), photoUrl: hasPhoto ? `/api/photos/${t._id}` : '' });
  }
  res.json(list);
});

// Public ticket submission with optional photo
app.post('/api/public-ticket', upload.single('photo'), async (req, res) => {
  const { room = '', description = '', departmentId = null } = req.body || {};
  if (!room || !departmentId) return res.status(400).json({ error: 'missing fields' });
  const ticketNumber = await getNextTicketNumber();
  const ticket = await Ticket.create({
    ticketNumber,
    description,
    room,
    departmentId,
    openedBy: 'guest',
    openedAt: new Date()
  });
  if (req.file) {
    await Photo.create({
      ticketId: ticket._id,
      data: fs.readFileSync(req.file.path),
      contentType: req.file.mimetype
    });
    fs.unlink(req.file.path, () => {});
  }
  console.log('Saved to DB');
  sendEvent({ type: 'ticket:new', ticketId: ticket.id, room: ticket.room });
  res.json(ticket);
});

// Создать заявку
app.post('/api/tickets', async (req, res) => {
  const body = req.body || {};
  const { description, room, departmentId } = body;
  if (!description || !room || !departmentId) {
    return res.status(400).json({ error: 'missing fields' });
  }
  const ticketNumber = await getNextTicketNumber();
  const ticket = await Ticket.create({
    ticketNumber,
    description,
    room,
    departmentId,
    openedBy: req.user ? req.user.username : 'guest',
    openedAt: new Date()
  });
  console.log('Saved to DB');
  sendEvent({ type: 'ticket:new', ticketId: ticket.id, room: ticket.room });
  res.json(ticket);
});

// Закрыть заявку
app.post('/api/tickets/:id/close', requireAuth, async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'not found' });
  if (!ticket.isClosed) {
    ticket.isClosed = true;
    ticket.closedAt = new Date();
    ticket.closedBy = req.user ? req.user.username : '';
    await ticket.save();
    await Photo.deleteMany({ ticketId: ticket._id });
    console.log('Saved to DB');
    sendEvent({ type: 'ticket:closed', ticketId: ticket.id });
  }
  res.json(ticket);
});

// Переоткрыть заявку
app.post('/api/tickets/:id/reopen', requireAdminOrSuperuser, async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'not found' });
  if (ticket.isClosed) {
    ticket.isClosed = false;
    ticket.closedAt = undefined;
    ticket.closedBy = undefined;
    await ticket.save();
    console.log('Saved to DB');
    sendEvent({ type: 'ticket:reopened', ticketId: ticket.id });
  }
  res.json(ticket);
});

// Обновить заявку
app.patch('/api/tickets/:id', requireAdminOrSuperuser, async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'not found' });
  if (ticket.isClosed) return res.status(400).json({ error: 'closed' });
  const { description, room, departmentId } = req.body || {};
  const depId = departmentId || req.body.department;
  if (description !== undefined) ticket.description = description;
  if (room !== undefined) ticket.room = room;
  if (depId !== undefined) {
    if (!depId) return res.status(400).json({ error: 'missing fields' });
    ticket.departmentId = depId;
  }
  await ticket.save();
  console.log('Saved to DB');
  res.json(ticket);
});

// Delete ticket (admin only)
app.delete('/api/tickets/:id', requireAdminOrSuperuser, async (req, res) => {
  await Ticket.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// Download backup of tickets
app.get('/api/tickets/backup', requireAdmin, async (req, res) => {
  const tickets = await Ticket.find();
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="tickets-backup-${date}.json"`);
  res.json(tickets);
});

// Restore tickets from uploaded backup
app.post('/api/tickets/restore', requireAdmin, async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'invalid data' });
  await Ticket.deleteMany({});
  await Ticket.insertMany(req.body);
  console.log('Saved to DB');
  res.json({ ok: true });
});

// История по комнате
app.get('/api/rooms/:room', async (req, res) => {
  const tickets = await Ticket.find({ room: req.params.room });
  res.json(tickets);
});

app.get('/api/photos/:ticketId', async (req, res) => {
  const photo = await Photo.findOne({ ticketId: req.params.ticketId });
  if (!photo) return res.status(404).end();
  res.contentType(photo.contentType);
  res.send(photo.data);
});

// News endpoints
app.get('/api/news', async (req, res) => {
  const list = await News.find().sort('-createdAt');
  res.json(list);
});

app.post('/api/news', requireAdminOrSuperuser, newsUpload.single('image'), async (req, res) => {
  const { title = '', content = '' } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'missing fields' });
  const news = await News.create({
    title,
    content,
    imageUrl: req.file ? '/uploads/news/' + req.file.filename : ''
  });
  res.json(news);
});

app.delete('/api/news/:id', requireAdminOrSuperuser, async (req, res) => {
  await News.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// fallback to index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND, 'index.html'));
});

let server;
async function start() {
  await new Promise((resolve) => {
    mongoose.connection.once('open', async () => {
      console.log('MongoDB connected');

      const userCount = await User.countDocuments();
      if (userCount === 0) {
        const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
        const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin';
        await User.create({
          username,
          passwordHash: bcrypt.hashSync(password, 10),
          role: 'admin',
          name: 'Admin',
          email: ''
        });
        console.log(`Default admin created: ${username}/${password}`);
      }

      const deptCount = await Department.countDocuments();
      if (deptCount === 0) {
        const name = process.env.DEFAULT_DEPARTMENT_NAME || 'General';
        await Department.create({ name });
        console.log(`Default department created: ${name}`);
      }

      server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        resolve();
      });
    });
  });
  return server;
}

async function stop() {
  await new Promise((resolve, reject) => {
    if (server) {
      server.close(err => (err ? reject(err) : resolve()));
    } else {
      resolve();
    }
  });
  await mongoose.connection.close();
}

if (require.main === module) {
  start();
}

module.exports = { app, start, stop };
