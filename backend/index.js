const express = require('express');
const path = require('path');
const fs = require('fs');
const TICKETS_FILE = path.join(__dirname, 'data', 'tickets.json');
const DEPTS_FILE = path.join(__dirname, 'data', 'departments.json');
const STAFF_FILE = path.join(__dirname, 'data', 'staff.json');

const app = express();
const PORT = process.env.PORT || 3000;

// Разрешаем статику из папки frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

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
const loadStaff = () => loadData(STAFF_FILE);
const saveStaff = (s) => saveData(STAFF_FILE, s);

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

// Staff
app.get('/api/staff', (req, res) => {
  let staff = loadStaff();
  if (req.query.departmentId) {
    staff = staff.filter(s => s.departmentId === req.query.departmentId);
  }
  res.json(staff);
});

app.post('/api/staff', (req, res) => {
  const staff = loadStaff();
  const member = {
    id: 'u' + Date.now(),
    name: req.body.name || '',
    departmentId: req.body.departmentId || ''
  };
  staff.push(member);
  saveStaff(staff);
  res.json(member);
});

app.delete('/api/staff/:id', (req, res) => {
  let staff = loadStaff();
  staff = staff.filter(s => s.id !== req.params.id);
  saveStaff(staff);
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
  const ticket = {
    id: Date.now().toString(),
    description: body.description || '',
    departmentId: body.departmentId || '',
    room: body.room || '',
    openedBy: body.openedBy || '',
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
  const ticket = tickets.find(t => t.id === req.params.id);
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

// История по комнате
app.get('/api/rooms/:room', (req, res) => {
  const tickets = loadTickets().filter(t => t.room === req.params.room);
  res.json(tickets);
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
