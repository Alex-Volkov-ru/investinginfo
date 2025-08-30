FROM nginx:alpine

# вычищаем дефолтный конфиг, чтобы никто случайно не экспонировал этот nginx наружу
RUN rm -f /etc/nginx/conf.d/default.conf

# кладём статические файлы фронта
COPY ./app/frontend /usr/share/nginx/html
