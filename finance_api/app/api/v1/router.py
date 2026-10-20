from fastapi import APIRouter
from app.api.v1 import admin, auth, budgets, categories, recurring, reports, streams, transactions, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
api_router.include_router(recurring.router, tags=["Recurring & Forecasting"])
api_router.include_router(budgets.router, prefix="/budgets", tags=["Budgets & Threshold Alerts"])
api_router.include_router(streams.router, prefix="/streams", tags=["Streams Ledgers"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports & Analytics"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin Management"])
