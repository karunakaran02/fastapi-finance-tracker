from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.session import Base


class StreamBook(Base):
    __tablename__ = "stream_books"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(120), nullable=False)
    description = Column(String(500), nullable=True)
    color = Column(String(20), nullable=True, default="#3b82f6")
    icon = Column(String(50), nullable=True, default="book")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="stream_books")
    entries = relationship(
        "StreamEntry",
        back_populates="book",
        cascade="all, delete-orphan",
        order_by="StreamEntry.entry_date.desc(), StreamEntry.id.desc()",
    )


class StreamEntry(Base):
    __tablename__ = "stream_entries"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("stream_books.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(10), nullable=False, index=True)
    amount = Column(Numeric(precision=12, scale=2), nullable=False)
    remarks = Column(String(500), nullable=True)
    category = Column(String(100), nullable=True, index=True)
    entry_date = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    book = relationship("StreamBook", back_populates="entries")
    user = relationship("User")

