from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from tinkoff.invest import Client
from tinkoff.invest.schemas import CandleInterval

from app.backend.core.config import get_settings
from app.backend.core.auth import get_current_user
from app.backend.core.security import decrypt_token
from app.backend.core.cache import cached_json, rate_limit
from app.backend.models.user import User

settings = get_settings()
router = APIRouter()

def q2f(q) -> float:
    if q is None:
        return 0.0
    return float(getattr(q, "units", 0)) + float(getattr(q, "nano", 0)) / 1e9

INTERVAL_MAP = {
    "1min": CandleInterval.CANDLE_INTERVAL_1_MIN,
    "5min": CandleInterval.CANDLE_INTERVAL_5_MIN,
    "15min": CandleInterval.CANDLE_INTERVAL_15_MIN,
    "1h": CandleInterval.CANDLE_INTERVAL_HOUR,
    "1d": CandleInterval.CANDLE_INTERVAL_DAY,
}

# --- Кэши инструментов в памяти процесса (быстрый словарь) ---
INSTR_CACHE: Dict[str, List[dict]] = {}
FIGI_CACHE: Dict[str, dict] = {}

def _add_many(cache_t: Dict[str, List[dict]], cache_f: Dict[str, dict], items, cls: str):
    for it in items:
        t = (getattr(it, "ticker", None) or "").strip().upper()
        if not t:
            continue
        rec = {
            "figi": getattr(it, "figi", None),
            "class": cls,
            "name": getattr(it, "name", None),
            "currency": getattr(it, "currency", None),
            "isin": getattr(it, "isin", None),
            "ticker": t,
        }
        if cls == "bond":
            nominal = q2f(getattr(it, "nominal", None)) or 1000.0
            rec["nominal"] = nominal
        cache_t.setdefault(t, []).append({k: rec.get(k) for k in ("figi", "class", "name", "currency", "isin", "nominal", "ticker")})
        if rec["figi"]:
            cache_f[rec["figi"]] = rec

def refresh_instruments_cache(token: str | None = None):
    t_cache: Dict[str, List[dict]] = {}
    f_cache: Dict[str, dict] = {}
    use_token = token or settings.TINKOFF_TOKEN
    if not use_token:
        return
    with Client(use_token) as client:
        shares = client.instruments.shares().instruments
        bonds = client.instruments.bonds().instruments
        etfs = client.instruments.etfs().instruments
    _add_many(t_cache, f_cache, shares, "share")
    _add_many(t_cache, f_cache, bonds, "bond")
    _add_many(t_cache, f_cache, etfs, "etf")
    INSTR_CACHE.clear(); INSTR_CACHE.update(t_cache)
    FIGI_CACHE.clear(); FIGI_CACHE.update(f_cache)

class ResolveItem(BaseModel):
    figi: str
    class_: str = Field(alias="class")
    name: str
    currency: str | None = None
    isin: str | None = None
    nominal: float | None = None
    class Config:
        populate_by_name = True

class ResolveOut(BaseModel):
    ticker: str
    results: List[ResolveItem]

class QuoteOut(BaseModel):
    figi: str
    price: float
    currency: str | None = None
    ticker: str | None = None
    name: str | None = None
    class_: str | None = Field(None, alias="class")
    price_percent: float | None = None
    nominal: float | None = None
    aci: float | None = None
    dirty_price: float | None = None
    class Config:
        populate_by_name = True

class CandleOut(BaseModel):
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int

@router.on_event("startup")
async def _startup():
    await run_in_threadpool(refresh_instruments_cache)

# --- helpers ---
def _token_from_user(user: User) -> str:
    token = decrypt_token(getattr(user, "tinkoff_token_enc", "") or "")
    if not token:
        raise HTTPException(400, "У пользователя не задан Tinkoff токен")
    return token

def _get_last_price_blocking(figi: str, token: str) -> float:
    with Client(token) as client:
        lp = client.market_data.get_last_prices(figi=[figi])
        if not lp.last_prices:
            raise HTTPException(404, f"Нет данных по FIGI={figi}")
        return q2f(lp.last_prices[0].price)

def _get_last_prices_blocking(figis: List[str], token: str) -> Dict[str, float]:
    with Client(token) as client:
        lp = client.market_data.get_last_prices(figi=figis)
        return {it.figi: q2f(it.price) for it in lp.last_prices}

def _get_candles_blocking(figi: str, from_dt: datetime, to_dt: datetime, interval: CandleInterval, token: str):
    with Client(token) as client:
        return client.market_data.get_candles(figi=figi, from_=from_dt, to=to_dt, interval=interval).candles

def _pick_figi_for_ticker(ticker: str, class_hint: str | None = None) -> dict:
    t = ticker.strip().upper()
    if not t:
        raise HTTPException(400, "Пустой тикер")
    if not INSTR_CACHE:
        raise HTTPException(503, "Кэш инструментов пуст, попробуйте позже")
    cand = INSTR_CACHE.get(t, [])
    if class_hint:
        cand = [x for x in cand if x["class"] == class_hint]
    if not cand:
        raise HTTPException(404, f"FIGI по тикеру {t} не найден")
    return cand[0]

def _normalize_quote(figi: str, raw_price: float) -> QuoteOut:
    meta = FIGI_CACHE.get(figi, {})
    cls = meta.get("class")
    out_common = {
        "figi": figi,
        "currency": meta.get("currency"),
        "ticker": meta.get("ticker"),
        "name": meta.get("name"),
        "class": cls,
    }
    if cls == "bond":
        nominal = meta.get("nominal") or 1000.0
        price_percent = raw_price
        price_clean = price_percent * nominal / 100.0
        return QuoteOut(price=price_clean, price_percent=price_percent, nominal=nominal, **out_common)
    return QuoteOut(price=raw_price, **out_common)

# --- endpoints ---

@router.get("/resolve", response_model=ResolveOut)
async def resolve(ticker: str, user: User = Depends(get_current_user)):
    t = ticker.strip().upper()
    if not t:
        raise HTTPException(400, "Пустой тикер")

    if not INSTR_CACHE:
        token = _token_from_user(user)
        await run_in_threadpool(refresh_instruments_cache, token)

    key = f"resolve:{t}"
    async def _load():
        items = INSTR_CACHE.get(t, [])
        return {
            "ticker": t,
            "results": [
                {"figi": i["figi"], "class": i["class"], "name": i["name"],
                 "currency": i.get("currency"), "isin": i.get("isin"), "nominal": i.get("nominal")}
                for i in items
            ]
        }
    data = await cached_json(key, ttl_sec=12 * 60 * 60, loader=_load)
    return ResolveOut(**data)

@router.get("/quote/{figi}", response_model=QuoteOut)
async def get_quote(figi: str, user: User = Depends(get_current_user)):
    token = _token_from_user(user)
    await rate_limit(f"user:{user.id}:quote:{figi}", limit=30, window_sec=60)

    key = f"quote:{figi}"
    async def _load():
        raw = await run_in_threadpool(_get_last_price_blocking, figi, token)
        return _normalize_quote(figi, raw).model_dump()
    data = await cached_json(key, ttl_sec=60, loader=_load)
    return QuoteOut(**data)

@router.get("/candles/{figi}", response_model=list[CandleOut])
async def get_candles(
    figi: str,
    interval: str = Query("1d", pattern="^(1min|5min|15min|1h|1d)$"),
    from_: Optional[str] = Query(None),
    to: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
):
    token = _token_from_user(user)
    ci = INTERVAL_MAP[interval]
    to_dt = (datetime.fromisoformat((to or datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00"))
             if to else datetime.now(timezone.utc))
    from_dt = (datetime.fromisoformat((from_ or "").replace("Z", "+00:00"))
               if from_ else to_dt - timedelta(days=30))

    await rate_limit(f"user:{user.id}:candles:{figi}:{interval}", limit=60, window_sec=60)

    key = f"candles:{figi}:{interval}:{from_dt.isoformat()}:{to_dt.isoformat()}"

    async def _load():
        candles = await run_in_threadpool(_get_candles_blocking, figi, from_dt, to_dt, ci, token)
        return [CandleOut(time=c.time, open=q2f(c.open), high=q2f(c.high), low=q2f(c.low), close=q2f(c.close), volume=c.volume).model_dump()
                for c in candles]

    data = await cached_json(key, ttl_sec=120, loader=_load)
    return [CandleOut(**it) for it in data]

class BatchTickersIn(BaseModel):
    tickers: list[str]
    class_hint: str | None = None

class BatchQuotesOut(BaseModel):
    results: list[QuoteOut]

@router.post("/quotes_by_tickers", response_model=BatchQuotesOut)
async def quotes_by_tickers(payload: BatchTickersIn, user: User = Depends(get_current_user)):
    if not payload.tickers:
        return BatchQuotesOut(results=[])
    if not INSTR_CACHE:
        token = _token_from_user(user)
        await run_in_threadpool(refresh_instruments_cache, token)

    # Создаем ключ кэша на основе тикеров и class_hint
    tickers_sorted = sorted([t.strip().upper() for t in payload.tickers])
    cache_key = f"quotes_batch:{':'.join(tickers_sorted)}:{payload.class_hint or 'all'}"

    async def _load():
        metas: list[dict] = []
        for t in payload.tickers:
            try:
                m = await run_in_threadpool(_pick_figi_for_ticker, t, payload.class_hint)
                metas.append({"ticker": t.strip().upper(), **m})
            except HTTPException:
                continue
        if not metas:
            return {"results": []}

        token = _token_from_user(user)
        figis = [m["figi"] for m in metas]
        prices_map = await run_in_threadpool(_get_last_prices_blocking, figis, token)

        out: list[dict] = []
        for m in metas:
            raw = prices_map.get(m["figi"])
            if raw is None:
                continue
            qo = _normalize_quote(m["figi"], raw)
            qo.ticker = m["ticker"]
            out.append(qo.model_dump())
        return {"results": out}

    # Кэшируем на 60 секунд - обновляем котировки каждую минуту
    data = await cached_json(cache_key, ttl_sec=60, loader=_load)
    return BatchQuotesOut(**data)
