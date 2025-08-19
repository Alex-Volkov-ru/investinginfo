# env/frontend/Dockerfile
FROM nginx:alpine
COPY app/frontend/ /usr/share/nginx/html/
# аккуратный конфиг nginx (кеш/ gzip/ статика)
COPY env/frontend/default.conf /etc/nginx/conf.d/default.conf
