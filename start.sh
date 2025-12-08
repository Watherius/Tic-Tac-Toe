#!/bin/bash

# Скрипт для запуска приложения на сервере

# Активация виртуального окружения (если используется)
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Установка зависимостей
pip install -r requirements.txt

# Запуск приложения
uvicorn main:app --host 0.0.0.0 --port 8000

