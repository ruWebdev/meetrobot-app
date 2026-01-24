# Инструкция по запуску проекта MeetRobot через PM2

Этот проект состоит из NestJS бэкенда и React (Vite) фронтенда. Бэкенд управляется через PM2 для обеспечения стабильной работы и автоматического перезапуска.

## 1. Предварительные требования

Убедитесь, что на сервере установлены:
- Node.js (LTS)
- PostgreSQL
- Redis
- PM2 (`npm install -g pm2`)
- Nginx

## 2. Подготовка окружения

1. Перейдите в корень проекта:
   ```bash
   cd /var/www/meetrobot.ru/app
   ```

2. Настройте переменные окружения:
   ```bash
   cp .env.example .env
   # Отредактируйте .env, указав актуальные данные для БД, Redis и Telegram
   nano .env
   ```

3. Установите зависимости:
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   cd ..
   ```

## 3. Сборка проекта

### Бэкенд:
```bash
cd backend
npm run build
# Примените миграции Prisma
npx prisma migrate deploy
cd ..
```

### Фронтенд:
```bash
cd frontend
npm run build
cd ..
```

## 4. Запуск через PM2

В корне проекта находится файл `ecosystem.config.js`. Для запуска бэкенда выполните:

```bash
pm2 start ecosystem.config.js
```

### Основные команды PM2:

- **Просмотр статуса:** `pm2 status`
- **Логи в реальном времени:** `pm2 logs meetrobot-backend`
- **Перезапуск:** `pm2 restart meetrobot-backend`
- **Остановка:** `pm2 stop meetrobot-backend`
- **Сохранение списка процессов (для автозагрузки):** `pm2 save`

## 5. Настройка Nginx

Проект использует Nginx как Reverse Proxy. Конфигурационные файлы находятся в директории `/nginx`.

1. Скопируйте конфигурации в `sites-available`:
   ```bash
   sudo cp nginx/backend.conf /etc/nginx/sites-available/meetrobot-api.conf
   sudo cp nginx/frontend.conf /etc/nginx/sites-available/meetrobot-frontend.conf
   ```

2. Создайте символические ссылки:
   ```bash
   sudo ln -s /etc/nginx/sites-available/meetrobot-api.conf /etc/nginx/sites-enabled/
   sudo ln -s /etc/nginx/sites-available/meetrobot-frontend.conf /etc/nginx/sites-enabled/
   ```

3. Проверьте конфигурацию и перезапустите Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## 6. Примечания
- Бэкенд запускается в режиме `fork` с одним экземпляром (согласно спецификации для работы с Telegram-ботом).
- Все логи бэкенда доступны через PM2.
- Фронтенд раздается как статика через Nginx из папки `frontend/dist`.
