import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import case, func
from sqlalchemy.orm import Session
from app.models.stream import StreamBook, StreamEntry
from app.schemas.stream import (
    PaginatedStreamEntries,
    StreamBookCreate,
    StreamBookSummary,
    StreamBookUpdate,
    StreamEntryCreate,
    StreamEntryResponse,
    StreamEntryUpdate,
)


def list_user_books(db: Session, user_id: int) -> List[StreamBookSummary]:
    books = (
        db.query(StreamBook)
        .filter(StreamBook.user_id == user_id)
        .order_by(StreamBook.created_at.desc(), StreamBook.id.desc())
        .all()
    )
    if not books:
        return []

    book_ids = [b.id for b in books]
    stats_rows = (
        db.query(
            StreamEntry.book_id,
            func.coalesce(
                func.sum(case((StreamEntry.type == "IN", StreamEntry.amount), else_=0)),
                0,
            ).label("total_in"),
            func.coalesce(
                func.sum(case((StreamEntry.type == "OUT", StreamEntry.amount), else_=0)),
                0,
            ).label("total_out"),
            func.count(StreamEntry.id).label("entry_count"),
        )
        .filter(StreamEntry.book_id.in_(book_ids))
        .group_by(StreamEntry.book_id)
        .all()
    )

    stats_map = {
        row.book_id: {
            "total_in": Decimal(str(row.total_in)),
            "total_out": Decimal(str(row.total_out)),
            "count": row.entry_count,
        }
        for row in stats_rows
    }

    result = []
    for b in books:
        st = stats_map.get(
            b.id,
            {"total_in": Decimal("0.00"), "total_out": Decimal("0.00"), "count": 0},
        )
        total_in = st["total_in"]
        total_out = st["total_out"]
        net_balance = total_in - total_out
        result.append(
            StreamBookSummary(
                id=b.id,
                user_id=b.user_id,
                title=b.title,
                description=b.description,
                color=b.color,
                icon=b.icon,
                created_at=b.created_at,
                updated_at=b.updated_at,
                total_income=total_in,
                total_expense=total_out,
                net_balance=net_balance,
                entries_count=st["count"],
            )
        )
    return result


def get_book(db: Session, book_id: int, user_id: int) -> Optional[StreamBook]:
    return (
        db.query(StreamBook)
        .filter(StreamBook.id == book_id, StreamBook.user_id == user_id)
        .first()
    )


def get_book_summary(db: Session, book_id: int, user_id: int) -> Optional[StreamBookSummary]:
    book = get_book(db, book_id, user_id)
    if not book:
        return None

    stats = (
        db.query(
            func.coalesce(
                func.sum(case((StreamEntry.type == "IN", StreamEntry.amount), else_=0)),
                0,
            ).label("total_in"),
            func.coalesce(
                func.sum(case((StreamEntry.type == "OUT", StreamEntry.amount), else_=0)),
                0,
            ).label("total_out"),
            func.count(StreamEntry.id).label("entry_count"),
        )
        .filter(StreamEntry.book_id == book_id)
        .first()
    )

    total_in = Decimal(str(stats.total_in)) if stats else Decimal("0.00")
    total_out = Decimal(str(stats.total_out)) if stats else Decimal("0.00")
    count = stats.entry_count if stats else 0
    net_balance = total_in - total_out

    return StreamBookSummary(
        id=book.id,
        user_id=book.user_id,
        title=book.title,
        description=book.description,
        color=book.color,
        icon=book.icon,
        created_at=book.created_at,
        updated_at=book.updated_at,
        total_income=total_in,
        total_expense=total_out,
        net_balance=net_balance,
        entries_count=count,
    )


def create_book(db: Session, user_id: int, book_in: StreamBookCreate) -> StreamBookSummary:
    book = StreamBook(
        user_id=user_id,
        title=book_in.title.strip(),
        description=book_in.description.strip() if book_in.description else None,
        color=book_in.color or "#3b82f6",
        icon=book_in.icon or "book",
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    return StreamBookSummary(
        id=book.id,
        user_id=book.user_id,
        title=book.title,
        description=book.description,
        color=book.color,
        icon=book.icon,
        created_at=book.created_at,
        updated_at=book.updated_at,
        total_income=Decimal("0.00"),
        total_expense=Decimal("0.00"),
        net_balance=Decimal("0.00"),
        entries_count=0,
    )


def update_book(
    db: Session, book_id: int, user_id: int, book_in: StreamBookUpdate
) -> Optional[StreamBookSummary]:
    book = get_book(db, book_id, user_id)
    if not book:
        return None

    if book_in.title is not None:
        book.title = book_in.title.strip()
    if book_in.description is not None:
        book.description = book_in.description.strip() if book_in.description else None
    if book_in.color is not None:
        book.color = book_in.color
    if book_in.icon is not None:
        book.icon = book_in.icon

    db.commit()
    db.refresh(book)
    return get_book_summary(db, book.id, user_id)


def delete_book(db: Session, book_id: int, user_id: int) -> bool:
    book = get_book(db, book_id, user_id)
    if not book:
        return False
    db.delete(book)
    db.commit()
    return True


def list_book_entries(
    db: Session,
    book_id: int,
    user_id: int,
    search: Optional[str] = None,
    type_filter: Optional[str] = None,
    category_filter: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 50,
) -> Optional[PaginatedStreamEntries]:
    book = get_book(db, book_id, user_id)
    if not book:
        return None

    all_entries = (
        db.query(StreamEntry)
        .filter(StreamEntry.book_id == book_id)
        .order_by(StreamEntry.entry_date.asc(), StreamEntry.id.asc())
        .all()
    )

    running_balance = Decimal("0.00")
    total_in = Decimal("0.00")
    total_out = Decimal("0.00")
    enriched_items = []

    for entry in all_entries:
        amt = Decimal(str(entry.amount))
        if entry.type == "IN":
            running_balance += amt
            total_in += amt
        else:
            running_balance -= amt
            total_out += amt

        enriched_items.append(
            StreamEntryResponse(
                id=entry.id,
                book_id=entry.book_id,
                user_id=entry.user_id,
                type=entry.type,
                amount=amt,
                remarks=entry.remarks,
                category=entry.category,
                entry_date=entry.entry_date,
                created_at=entry.created_at,
                updated_at=entry.updated_at,
                running_balance=running_balance,
            )
        )

    enriched_items.reverse()

    filtered_items = enriched_items
    if type_filter and type_filter in ("IN", "OUT"):
        filtered_items = [item for item in filtered_items if item.type == type_filter]

    if category_filter:
        cat_lower = category_filter.lower()
        filtered_items = [
            item for item in filtered_items if item.category and cat_lower in item.category.lower()
        ]

    if search:
        s_lower = search.lower()
        filtered_items = [
            item
            for item in filtered_items
            if (item.remarks and s_lower in item.remarks.lower())
            or (item.category and s_lower in item.category.lower())
            or (str(item.amount) in s_lower)
        ]

    if start_date:
        filtered_items = [item for item in filtered_items if item.entry_date >= start_date]

    if end_date:
        filtered_items = [item for item in filtered_items if item.entry_date <= end_date]

    total_count = len(filtered_items)
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
    safe_page = max(1, page)
    start_idx = (safe_page - 1) * page_size
    paged_items = filtered_items[start_idx : start_idx + page_size]

    return PaginatedStreamEntries(
        items=paged_items,
        total=total_count,
        page=safe_page,
        page_size=page_size,
        total_pages=total_pages,
        total_income=total_in,
        total_expense=total_out,
        net_balance=total_in - total_out,
    )


def create_entry(
    db: Session, book_id: int, user_id: int, entry_in: StreamEntryCreate
) -> Optional[StreamEntryResponse]:
    book = get_book(db, book_id, user_id)
    if not book:
        return None

    entry = StreamEntry(
        book_id=book_id,
        user_id=user_id,
        type=entry_in.type,
        amount=entry_in.amount,
        remarks=entry_in.remarks.strip() if entry_in.remarks else None,
        category=entry_in.category.strip() if entry_in.category else None,
        entry_date=entry_in.entry_date,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    summary = get_book_summary(db, book_id, user_id)
    return StreamEntryResponse(
        id=entry.id,
        book_id=entry.book_id,
        user_id=entry.user_id,
        type=entry.type,
        amount=Decimal(str(entry.amount)),
        remarks=entry.remarks,
        category=entry.category,
        entry_date=entry.entry_date,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        running_balance=summary.net_balance if summary else Decimal(str(entry.amount)),
    )


def update_entry(
    db: Session, book_id: int, entry_id: int, user_id: int, entry_in: StreamEntryUpdate
) -> Optional[StreamEntryResponse]:
    book = get_book(db, book_id, user_id)
    if not book:
        return None

    entry = (
        db.query(StreamEntry)
        .filter(StreamEntry.id == entry_id, StreamEntry.book_id == book_id)
        .first()
    )
    if not entry:
        return None

    if entry_in.type is not None:
        entry.type = entry_in.type
    if entry_in.amount is not None:
        entry.amount = entry_in.amount
    if entry_in.remarks is not None:
        entry.remarks = entry_in.remarks.strip() if entry_in.remarks else None
    if entry_in.category is not None:
        entry.category = entry_in.category.strip() if entry_in.category else None
    if entry_in.entry_date is not None:
        entry.entry_date = entry_in.entry_date

    db.commit()
    db.refresh(entry)

    return StreamEntryResponse(
        id=entry.id,
        book_id=entry.book_id,
        user_id=entry.user_id,
        type=entry.type,
        amount=Decimal(str(entry.amount)),
        remarks=entry.remarks,
        category=entry.category,
        entry_date=entry.entry_date,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def delete_entry(db: Session, book_id: int, entry_id: int, user_id: int) -> bool:
    book = get_book(db, book_id, user_id)
    if not book:
        return False

    entry = (
        db.query(StreamEntry)
        .filter(StreamEntry.id == entry_id, StreamEntry.book_id == book_id)
        .first()
    )
    if not entry:
        return False

    db.delete(entry)
    db.commit()
    return True


def export_book_csv(db: Session, book_id: int, user_id: int) -> Optional[io.StringIO]:
    book = get_book(db, book_id, user_id)
    if not book:
        return None

    entries = (
        db.query(StreamEntry)
        .filter(StreamEntry.book_id == book_id)
        .order_by(StreamEntry.entry_date.asc(), StreamEntry.id.asc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Entry ID",
            "Book Title",
            "Date",
            "Type",
            "Remarks",
            "Category",
            "Cash In",
            "Cash Out",
            "Running Balance",
        ]
    )

    balance = Decimal("0.00")
    for e in entries:
        amt = Decimal(str(e.amount))
        in_amt = amt if e.type == "IN" else Decimal("0.00")
        out_amt = amt if e.type == "OUT" else Decimal("0.00")
        if e.type == "IN":
            balance += amt
        else:
            balance -= amt

        writer.writerow(
            [
                e.id,
                book.title,
                e.entry_date.strftime("%Y-%m-%d %H:%M:%S"),
                e.type,
                e.remarks or "",
                e.category or "",
                f"{in_amt:.2f}",
                f"{out_amt:.2f}",
                f"{balance:.2f}",
            ]
        )

    output.seek(0)
    return output

