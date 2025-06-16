# TicketBox

Минимальный проект для учёта поломок в гостинице "Шарон". Содержит backend на Express.js и
простую HTML‑страницу в каталоге `frontend`.

Реализованы базовые возможности:

- добавление и закрытие заявки;
- просмотр всех заявок с фильтром по комнате;
- история обращений по комнате через API.

Дополнительно:

- ID заявок генерируются последовательно как числа (100001, 100002 и т.д.);
- интерфейс оформлен в фирменном стиле Sharon, логотип вверху страницы ведёт на https://sharon.co.il/.

## Запуск

1. Установите зависимости:
   ```bash
   npm install
   ```
2. Запустите сервер:
   ```bash
  npm start
  ```

Сервер будет доступен на `http://localhost:3000`, а главная страница откроется по корневому пути.

При обращении к `http://localhost:3000` откроется простая страница с формой добавления
заявок и таблицей существующих. Данные сохраняются в базе MongoDB (коллекция `ticketbox`).

Создайте файл `.env` на основе `.env.example` и укажите переменную `MONGO_URI` с вашим
подключением к MongoDB.

## Deploy to Render

1. Create a new **Web Service** in your Render account and connect this
   repository.
2. Set the build and start commands:
   ```bash
   npm install
   npm start
   ```
3. Render will provide the `PORT` environment variable automatically.
