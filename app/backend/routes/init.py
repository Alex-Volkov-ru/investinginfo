from fastapi import APIRouter
from .health import router as health_router
from .market import router as market_router
from .users import router as users_router
from .portfolio import router as portfolio_router
from .auth import router as auth_router

api_router = APIRouter()

# health
api_router.include_router(health_router, prefix="/health", tags=["health"])

# market (resolve/quotes/candles)
api_router.include_router(market_router, prefix="", tags=["market"])

# auth / users / portfolio
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(portfolio_router, prefix="/portfolio", tags=["portfolio"])
