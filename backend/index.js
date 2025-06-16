const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

const TICKETS_FILE = path.join(__dirname, 'data', 'tickets.json');
const DEPTS_FILE = path.join(__dirname, 'data', 'departments.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

const app = express();
const PORT = process.env.PORT || 3000;

const sessions = {}; // token -> userId

app.use(express.json());
app.use(cookieParser());

function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (token && sessions[token]) {
    const user = loadUsers().find(u => u.id === sessions[token]);
    if (user) req.user = user;
  }
  next();
}

app.use(authMiddleware);

function loadData(file) {
  try {
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const loadTickets = () => loadData(TICKETS_FILE);
const saveTickets = (tickets) => saveData(TICKETS_FILE, tickets);
const loadDepartments = () => loadData(DEPTS_FILE);
const saveDepartments = (d) => saveData(DEPTS_FILE, d);
const loadUsers = () => loadData(USERS_FILE);
const saveUsers = (u) => saveData(USERS_FILE, u);

// Authentication
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password || '', user.password)) {
    return res.status(401).json({ error: 'invalid' });
  }
  const token = crypto.randomBytes(16).toString('hex');
  sessions[token] = user.id;
  res.cookie('token', token, { httpOnly: true });
  res.json({ id: user.id, username: user.username, role: user.role, departmentId: user.departmentId });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies.token;
  if (token) delete sessions[token];
  res.clearCookie('token');
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

app.get('/api/status', (req, res) => {
  res.json({ message: 'Сервер работает' });
});

// Departments
app.get('/api/departments', (req, res) => {
  res.json(loadDepartments());
});

app.post('/api/departments', (req, res) => {
  const depts = loadDepartments();
  const dept = { id: 'd' + Date.now(), name: req.body.name || '' };
  depts.push(dept);
  saveDepartments(depts);
  res.json(dept);
});

app.delete('/api/departments/:id', (req, res) => {
  let depts = loadDepartments();
  depts = depts.filter(d => d.id !== req.params.id);
  saveDepartments(depts);
  res.json({ ok: true });
});


// Users (admin only)
app.get('/api/users', requireAdmin, (req, res) => {
  res.json(loadUsers());
});

app.post('/api/users', requireAdmin, (req, res) => {
  const users = loadUsers();
  const body = req.body || {};
  const user = {
    id: 'u' + Date.now(),
    username: body.username || '',
    password: bcrypt.hashSync(body.password || '1234', 10),
    role: body.role || 'user',
    departmentId: body.departmentId || ''
  };
  users.push(user);
  saveUsers(users);
  res.json(user);
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  let users = loadUsers();
  users = users.filter(u => u.id !== req.params.id);
  saveUsers(users);
  res.json({ ok: true });
});

app.post('/api/users/:id/password', requireAdmin, (req, res) => {
  const users = loadUsers();
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  user.password = bcrypt.hashSync(req.body.password || '1234', 10);
  saveUsers(users);
  res.json({ ok: true });
});

// Получить список заявок с фильтрацией
app.get('/api/tickets', (req, res) => {
  let tickets = loadTickets();
  if (req.query.status) {
    const open = req.query.status === 'open';
    tickets = tickets.filter(t => (t.closedAt ? !open : open));
  }
  if (req.query.room) {
    tickets = tickets.filter(t => t.room === req.query.room);
  }
  if (req.query.departmentId) {
    tickets = tickets.filter(t => t.departmentId === req.query.departmentId);
  }
  res.json(tickets);
});

// Создать заявку
app.post('/api/tickets', (req, res) => {
  const tickets = loadTickets();
  const body = req.body || {};
  const { description, room, openedBy } = body;
  if (!description || !room || !openedBy) {
    return res.status(400).json({ error: 'missing fields' });
  }
  const maxId = tickets.reduce((m, t) => {
    const n = parseInt(t.id, 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 100000);
  const ticket = {
    id: maxId + 1,
    description,
    departmentId: body.departmentId || '',
    room,
    openedBy,
    openedAt: new Date().toISOString(),
    closedAt: null,
    closedBy: null,
    comment: ''
  };
  tickets.push(ticket);
  saveTickets(tickets);
  res.json(ticket);
});

// Закрыть заявку
app.post('/api/tickets/:id/close', (req, res) => {
  const tickets = loadTickets();
  const ticket = tickets.find(t => t.id == req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'not found' });
  }
  if (!ticket.closedAt) {
    ticket.closedAt = new Date().toISOString();
    ticket.closedBy = req.body.userId || '';
    ticket.comment = req.body.comment || '';
    saveTickets(tickets);
  }
  res.json(ticket);
});

// Delete ticket (admin only)
app.delete('/api/tickets/:id', requireAdmin, (req, res) => {
  let tickets = loadTickets();
  const index = tickets.findIndex(t => t.id == req.params.id);
  if (index === -1) return res.status(404).json({ error: 'not found' });
  tickets.splice(index, 1);
  saveTickets(tickets);
  res.json({ ok: true });
});

// Download backup of tickets
app.get('/api/tickets/backup', requireAdmin, (req, res) => {
  const tickets = loadTickets();
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="tickets-backup-${date}.json"`);
  res.json(tickets);
});

// Restore tickets from uploaded backup
app.post('/api/tickets/restore', requireAdmin, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'invalid data' });
  saveTickets(req.body);
  res.json({ ok: true });
});

// История по комнате
app.get('/api/rooms/:room', (req, res) => {
  const tickets = loadTickets().filter(t => t.room === req.params.room);
  res.json(tickets);
});

// fallback to index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
