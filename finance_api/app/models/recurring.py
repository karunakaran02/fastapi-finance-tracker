from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.session import Base

class RecurringItem(Base):
    __tablename__ = "recurring_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id = Column(Integer, ForeignKey("stream_books.id", ondelete="SET NULL"), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(20), nullable=False, default="EXPENSE")
    amount = Column(Numeric(precision=12, scale=2), nullable=False)
    frequency = Column(String(20), nullable=False, default="MONTHLY")
    next_due_date = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="ACTIVE", index=True)
    auto_log = Column(Boolean, nullable=False, default=False)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="recurring_items")
    book = relationship("StreamBook")
    category = relationship("Category")

