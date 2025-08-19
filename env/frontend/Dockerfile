# ./env/frontend/Dockerfile
FROM nginx:alpine

# Убираем дефолтный конфиг и ставим свой
COPY ./env/frontend/default.conf /etc/nginx/conf.d/default.conf

# Копируем статику (html/css/js)
COPY ./app/frontend /usr/share/nginx/html
