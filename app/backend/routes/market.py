from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from tinkoff.invest import Client
from tinkoff.invest.schemas import CandleInterval

from app.backend.core.config import get_settings

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

# --- Кэши инструментов ---
INSTR_CACHE: Dict[str, List[dict]] = {}
FIGI_CACHE: Dict[str, dict] = {}

def _add_many(cache_t: Dict[str, List[dict]], cache_f: Dict[str, dict], items, cls: str):
    for it in items:
        t = (it.ticker or "").upper()
        if not t:
            continue
        rec = {
            "ticker": t,
            "figi": it.figi,
            "class": cls,
            "name": it.name,
            "currency": getattr(it, "currency", None),
            "isin": getattr(it, "isin", None),
        }
        if cls == "bond":
            nominal = q2f(getattr(it, "nominal", None)) or 1000.0
            rec["nominal"] = nominal
        cache_t.setdefault(t, []).append(
            {k: rec.get(k) for k in ("figi", "class", "name", "currency", "isin", "nominal")}
        )
        cache_f[it.figi] = rec

def refresh_instruments_cache():
    t_cache: Dict[str, List[dict]] = {}
    f_cache: Dict[str, dict] = {}
    if not settings.TINKOFF_TOKEN:
        return
    with Client(settings.TINKOFF_TOKEN) as client:
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

# --- blocking helpers ---

def _get_last_price_blocking(figi: str) -> float:
    if not settings.TINKOFF_TOKEN:
        raise HTTPException(500, "TINKOFF_TOKEN не задан")
    with Client(settings.TINKOFF_TOKEN) as client:
        lp = client.market_data.get_last_prices(figi=[figi])
        if not lp.last_prices:
            raise HTTPException(404, f"Нет данных по FIGI={figi}")
        return q2f(lp.last_prices[0].price)

def _get_last_prices_blocking(figis: List[str]) -> Dict[str, float]:
    with Client(settings.TINKOFF_TOKEN) as client:
        lp = client.market_data.get_last_prices(figi=figis)
        return {it.figi: q2f(it.price) for it in lp.last_prices}

def _get_candles_blocking(figi: str, from_dt: datetime, to_dt: datetime, interval: CandleInterval):
    with Client(settings.TINKOFF_TOKEN) as client:
        return client.market_data.get_candles(figi=figi, from_=from_dt, to=to_dt, interval=interval).candles

def _pick_figi_for_ticker(ticker: str, class_hint: str | None = None) -> dict:
    t = ticker.strip().upper()
    if not t:
        raise HTTPException(400, "Пустой тикер")
    if not INSTR_CACHE:
        refresh_instruments_cache()
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
async def resolve(ticker: str):
    t = ticker.strip().upper()
    if not t:
        raise HTTPException(400, "Пустой тикер")
    if not INSTR_CACHE:
        await run_in_threadpool(refresh_instruments_cache)
    items = INSTR_CACHE.get(t, [])
    return ResolveOut(
        ticker=t,
        results=[ResolveItem(**{"class": i["class"]}, figi=i["figi"], name=i["name"],
                             currency=i.get("currency"), isin=i.get("isin"), nominal=i.get("nominal")) for i in items],
    )

@router.get("/quote/{figi}", response_model=QuoteOut)
async def get_quote(figi: str):
    raw = await run_in_threadpool(_get_last_price_blocking, figi)
    return _normalize_quote(figi, raw)

@router.get("/candles/{figi}", response_model=list[CandleOut])
async def get_candles(
    figi: str,
    interval: str = Query("1d", pattern="^(1min|5min|15min|1h|1d)$"),
    from_: Optional[str] = Query(None),
    to: Optional[str] = Query(None),
):
    ci = INTERVAL_MAP[interval]
    to_dt = (datetime.fromisoformat((to or datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00"))
             if to else datetime.now(timezone.utc))
    from_dt = (datetime.fromisoformat((from_ or "").replace("Z", "+00:00"))
               if from_ else to_dt - timedelta(days=30))
    candles = await run_in_threadpool(_get_candles_blocking, figi, from_dt, to_dt, ci)
    return [CandleOut(time=c.time, open=q2f(c.open), high=q2f(c.high), low=q2f(c.low), close=q2f(c.close), volume=c.volume)
            for c in candles]

class BatchTickersIn(BaseModel):
    tickers: list[str]
    class_hint: str | None = None

class BatchQuotesOut(BaseModel):
    results: list[QuoteOut]

@router.post("/quotes_by_tickers", response_model=BatchQuotesOut)
async def quotes_by_tickers(payload: BatchTickersIn):
    if not payload.tickers:
        return BatchQuotesOut(results=[])
    metas: list[dict] = []
    for t in payload.tickers:
        try:
            m = await run_in_threadpool(_pick_figi_for_ticker, t, payload.class_hint)
            metas.append({"ticker": t.strip().upper(), **m})
        except HTTPException:
            continue
    if not metas:
        return BatchQuotesOut(results=[])
    figis = [m["figi"] for m in metas]
    prices_map = await run_in_threadpool(_get_last_prices_blocking, figis)
    out: list[QuoteOut] = []
    for m in metas:
        raw = prices_map.get(m["figi"])
        if raw is None:
            continue
        qo = _normalize_quote(m["figi"], raw)
        qo.ticker = m["ticker"]
        out.append(qo)
    return BatchQuotesOut(results=out)
