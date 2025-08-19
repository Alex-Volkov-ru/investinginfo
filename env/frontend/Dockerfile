FROM nginx:alpine

# убираем дефолтный конфиг
RUN rm /etc/nginx/conf.d/default.conf

# конфиг фронта не нужен, он будет у верхнего nginx
# просто кладём статику
COPY ./app/frontend /usr/share/nginx/html
