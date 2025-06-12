const express = require('express');
const path = require('path');
const fs = require('fs');
const DATA_FILE = path.join(__dirname, 'data', 'tickets.json');

const app = express();
const PORT = process.env.PORT || 3000;

// Разрешаем статику из папки frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

function loadTickets() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveTickets(tickets) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tickets, null, 2));
}

app.get('/api/status', (req, res) => {
  res.json({ message: 'Сервер работает' });
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
  if (req.query.department) {
    tickets = tickets.filter(t => t.department === req.query.department);
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
    department: body.department || '',
    room: body.room || '',
    user: body.user || '',
    createdAt: new Date().toISOString(),
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
    ticket.closedBy = req.body.user || '';
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
