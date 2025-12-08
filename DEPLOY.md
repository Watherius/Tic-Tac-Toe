# Инструкция по деплою на Timeweb Cloud

## Вариант 1: Деплой на VDS/VPS сервер (рекомендуется)

### Шаг 1: Создание сервера на Timeweb Cloud

1. Зайдите на [timeweb.cloud](https://timeweb.cloud/)
2. Создайте аккаунт или войдите в существующий
3. Перейдите в раздел "Облачные серверы" → "VDS/VPS"
4. Создайте новый сервер:
   - **ОС**: Ubuntu 22.04 LTS или Debian 12
   - **Конфигурация**: минимум 1 CPU, 1 GB RAM, 10 GB диска
   - **Регион**: выберите ближайший к вашим пользователям

### Шаг 2: Подключение к серверу

```bash
ssh root@YOUR_SERVER_IP
```

### Шаг 3: Установка зависимостей на сервере

```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Python и pip
apt install -y python3 python3-pip python3-venv git

# Установка nginx (для проксирования)
apt install -y nginx

# Установка supervisor (для автозапуска)
apt install -y supervisor
```

### Шаг 4: Клонирование репозитория

```bash
# Создание директории для проекта
mkdir -p /var/www/app
cd /var/www/app

# Клонирование репозитория (замените на ваш URL)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git .

# Или загрузите файлы через SCP с локальной машины:
# scp -r * root@YOUR_SERVER_IP:/var/www/app/
```

### Шаг 5: Настройка виртуального окружения

```bash
cd /var/www/app
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Шаг 6: Создание .env файла

```bash
nano .env
```

Добавьте:
```
TELEGRAM_BOT_TOKEN=ваш_токен_бота
```

### Шаг 7: Настройка Supervisor для автозапуска

```bash
nano /etc/supervisor/conf.d/app.conf
```

Добавьте:
```ini
[program:app]
directory=/var/www/app
command=/var/www/app/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
user=root
autostart=true
autorestart=true
stderr_logfile=/var/log/app.err.log
stdout_logfile=/var/log/app.out.log
environment=HOME="/var/www/app",USER="root"
```

Запустите:
```bash
supervisorctl reread
supervisorctl update
supervisorctl start app
```

### Шаг 8: Настройка Nginx

```bash
nano /etc/nginx/sites-available/app
```

Добавьте:
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте конфигурацию:
```bash
ln -s /etc/nginx/sites-available/app /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Шаг 9: Настройка файрвола

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## Вариант 2: Деплой через Docker

### Шаг 1: Установка Docker на сервере

```bash
apt install -y docker.io docker-compose
systemctl start docker
systemctl enable docker
```

### Шаг 2: Клонирование и запуск

```bash
cd /var/www/app
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git .

# Создайте .env файл
nano .env
# Добавьте TELEGRAM_BOT_TOKEN=ваш_токен

# Запуск через docker-compose
docker-compose up -d --build
```

## Получение публичной ссылки

После деплоя ваше приложение будет доступно по адресу:
- `http://YOUR_SERVER_IP` (если используете IP)
- `http://YOUR_DOMAIN` (если настроили домен)

### Настройка домена (опционально)

1. В панели Timeweb Cloud добавьте домен
2. Настройте DNS записи (A-запись на IP вашего сервера)
3. Обновите конфигурацию Nginx с вашим доменом

## Проверка работы

```bash
# Проверка статуса приложения
supervisorctl status app

# Просмотр логов
tail -f /var/log/app.out.log

# Проверка работы API
curl http://localhost:8000/api/session
```

## Обновление приложения

```bash
cd /var/www/app
git pull
source venv/bin/activate
pip install -r requirements.txt
supervisorctl restart app
```

