# ./app/frontend/Dockerfile
FROM nginx:alpine

# Убираем дефолтный конфиг
COPY ./default.conf /etc/nginx/conf.d/default.conf

# Копируем все html/css/js
COPY . /usr/share/nginx/html
