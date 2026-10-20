from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.session import Base

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False, index=True)
    threshold_amount = Column(Numeric(precision=12, scale=2), nullable=False)
    period = Column(String(20), nullable=False, default="monthly")
    alert_email = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="budgets")
    category = relationship("Category")
    notifications = relationship("AlertNotification", back_populates="budget", cascade="all, delete-orphan")

class AlertNotification(Base):
    __tablename__ = "alert_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    budget_id = Column(Integer, ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True)
    recipient_email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    threshold_amount = Column(Numeric(precision=12, scale=2), nullable=False)
    current_amount = Column(Numeric(precision=12, scale=2), nullable=False)
    exceeded_by = Column(Numeric(precision=12, scale=2), nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    budget = relationship("Budget", back_populates="notifications")
    user = relationship("User")
    transaction = relationship("Transaction")
