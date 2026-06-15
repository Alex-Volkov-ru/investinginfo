FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libpq-dev git \
 && rm -rf /var/lib/apt/lists/*

# зависимости
COPY ./app/backend/requirements.txt /app/requirements.txt
RUN python -m pip install --upgrade pip \
 && pip install --no-cache-dir -r /app/requirements.txt
# T-Invest SDK: фиксируем тег — clone main без версии ломает сборку при изменениях в репо
RUN cd /tmp && git clone --depth 1 --branch 0.2.0-beta117 https://github.com/RussianInvestments/invest-python.git && \
    cd invest-python && \
    pip install --no-cache-dir --no-deps . && \
    pip install --no-cache-dir cachetools deprecation python-dateutil grpcio-tools && \
    rm -rf /tmp/invest-python

# 2) удаляем сборочные пакеты, ставим только рантайм libpq5 и postgresql-client для бэкапов
RUN apt-get update \
 && apt-get purge -y --auto-remove build-essential gcc libpq-dev \
 && apt-get install -y --no-install-recommends libpq5 postgresql-client wget \
 && rm -rf /var/lib/apt/lists/* /root/.cache/pip

# код
COPY ./app /app/app
COPY ./env/backend/start.sh /app/start.sh
RUN chmod +x /app/start.sh

RUN useradd -ms /bin/bash appuser
USER appuser

EXPOSE 8000
CMD ["/app/start.sh"]
