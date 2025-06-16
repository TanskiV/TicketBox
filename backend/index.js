const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { Ticket, User, Department } = require('./models');

const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: UPLOAD_DIR });

const sessions = {}; // token -> userId

app.use(express.json());

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token && sessions[token]) {
    const user = await User.findById(sessions[token]);
    if (user) req.user = user;
  }
  next();
}

app.use(authMiddleware);


// Authentication
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = await User.findOne({ username });
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'invalid' });
  }
  const token = crypto.randomBytes(16).toString('hex');
  sessions[token] = user._id;
  res.json({
    token,
    user: { id: user._id, username: user.username, role: user.role, departmentId: user.departmentId }
  });
});

app.post('/api/logout', (req, res) => {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) delete sessions[token];
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const { id, username, role, departmentId } = req.user;
  res.json({ id, username, role, departmentId });
});

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

const FRONTEND = path.join(__dirname, '../frontend');

app.get('/', (req, res) => {
  if (req.user) {
    return res.redirect(req.user.role === 'admin' ? '/admin.html' : '/index.html');
  }
  res.redirect('/login.html');
});

app.get('/index.html', (req, res) => {
  if (!req.user) return res.redirect('/login.html');
  res.sendFile(path.join(FRONTEND, 'index.html'));
});

app.get('/admin.html', (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/login.html');
  res.sendFile(path.join(FRONTEND, 'admin.html'));
});

app.use(express.static(FRONTEND));
app.use('/uploads', express.static(UPLOAD_DIR));

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
  res.json(dept);
});

app.delete('/api/departments/:id', async (req, res) => {
  await Department.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});


// Users (admin only)
app.get('/api/users', requireAdmin, async (req, res) => {
  const list = await User.find();
  res.json(list);
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const user = await User.create({
    username: body.username || '',
    passwordHash: bcrypt.hashSync(body.password || '1234', 10),
    role: body.role || 'user',
    departmentId: body.departmentId || null
  });
  res.json(user);
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

app.post('/api/users/:id/password', requireAdmin, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  user.passwordHash = bcrypt.hashSync(req.body.password || '1234', 10);
  await user.save();
  res.json({ ok: true });
});

// Получить список заявок с фильтрацией
app.get('/api/tickets', async (req, res) => {
  const query = {};
  if (req.query.status) {
    const open = req.query.status === 'open';
    query.isClosed = !open ? true : false;
  }
  if (req.query.room) query.room = req.query.room;
  if (req.query.departmentId) query.departmentId = req.query.departmentId;
  const tickets = await Ticket.find(query);
  res.json(tickets);
});

// Public ticket submission with optional photo
app.post('/api/public-ticket', upload.single('photo'), async (req, res) => {
  const { room = '', description = '' } = req.body || {};
  if (!room) return res.status(400).json({ error: 'missing room' });
  const ticket = await Ticket.create({
    description,
    room,
    departmentId: null,
    createdBy: 'Guest',
    imageUrl: req.file ? '/uploads/' + req.file.filename : ''
  });
  res.json(ticket);
});

// Создать заявку
app.post('/api/tickets', async (req, res) => {
  const body = req.body || {};
  const { description, room } = body;
  if (!description || !room) {
    return res.status(400).json({ error: 'missing fields' });
  }
  const ticket = await Ticket.create({
    description,
    room,
    departmentId: body.departmentId || null,
    createdBy: req.user ? req.user.username : body.createdBy || '',
    imageUrl: body.imageUrl || ''
  });
  res.json(ticket);
});

// Закрыть заявку
app.post('/api/tickets/:id/close', async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'not found' });
  if (!ticket.isClosed) {
    ticket.isClosed = true;
    ticket.closedAt = new Date();
    await ticket.save();
  }
  res.json(ticket);
});

// Delete ticket (admin only)
app.delete('/api/tickets/:id', requireAdmin, async (req, res) => {
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
  res.json({ ok: true });
});

// История по комнате
app.get('/api/rooms/:room', async (req, res) => {
  const tickets = await Ticket.find({ room: req.params.room });
  res.json(tickets);
});

// fallback to index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
