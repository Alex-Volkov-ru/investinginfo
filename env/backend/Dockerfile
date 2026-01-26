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
RUN cd /tmp && git clone --depth 1 https://github.com/RussianInvestments/invest-python.git && \
    cd invest-python && \
    pip install --no-cache-dir --no-deps . && \
    pip install --no-cache-dir cachetools deprecation python-dateutil && \
    rm -rf /tmp/invest-python

# 2) удаляем сборочные пакеты, ставим только рантайм libpq5 и postgresql-client для бэкапов
RUN apt-get update \
 && apt-get purge -y --auto-remove build-essential gcc libpq-dev \
 && apt-get install -y --no-install-recommends libpq5 postgresql-client \
 && rm -rf /var/lib/apt/lists/* /root/.cache/pip

# код
COPY ./app /app/app

RUN useradd -ms /bin/bash appuser
USER appuser

EXPOSE 8000
CMD ["uvicorn","app.backend.main:app","--host","0.0.0.0","--port","8000"]
