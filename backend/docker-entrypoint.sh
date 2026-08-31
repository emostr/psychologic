#!/bin/sh
# Миграции накатываются перед стартом; встроенные методики и учётку
# администратора создаёт сам сервер при первом запуске (BootstrapService).
set -e
echo "==> prisma migrate deploy"
npx prisma migrate deploy
echo "==> запуск сервера"
exec node dist/main.js
