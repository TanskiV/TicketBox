const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Разрешаем статику из папки frontend
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/api/status', (req, res) => {
  res.json({ message: 'Сервер работает' });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
