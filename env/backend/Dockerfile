FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

# 1) ставим build deps, собираем колёса, потом чистим их в ЭТОМ ЖЕ слое
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libpq-dev git \
 && rm -rf /var/lib/apt/lists/*

# зависимости
COPY ./app/backend/requirements.txt /app/requirements.txt
RUN python -m pip install --upgrade pip \
 && pip install --no-cache-dir -r /app/requirements.txt

# 2) удаляем сборочные пакеты, ставим только рантайм libpq5
RUN apt-get update \
 && apt-get purge -y --auto-remove build-essential gcc libpq-dev \
 && apt-get install -y --no-install-recommends libpq5 \
 && rm -rf /var/lib/apt/lists/* /root/.cache/pip

# код
COPY ./app /app/app

# непривилегированный пользователь
RUN useradd -ms /bin/bash appuser
USER appuser

EXPOSE 8000
CMD ["uvicorn","app.backend.main:app","--host","0.0.0.0","--port","8000"]
