import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session
from app.models.category import Category
from app.models.stream import StreamBook, StreamEntry
from app.models.transaction import Transaction
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
                transaction_id=entry.transaction_id,
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

    cat_type = "income" if entry_in.type == "IN" else "expense"
    category = None
    if entry_in.category:
        category = (
            db.query(Category)
            .filter(
                func.lower(Category.name) == func.lower(entry_in.category.strip()),
                Category.type == cat_type,
                or_(Category.is_system == True, Category.user_id == user_id),
            )
            .first()
        )
    if not category:
        category = (
            db.query(Category)
            .filter(
                Category.type == cat_type,
                or_(Category.is_system == True, Category.user_id == user_id),
            )
            .order_by(Category.id.asc())
            .first()
        )

    tx = Transaction(
        user_id=user_id,
        book_id=book_id,
        category_id=category.id if category else 1,
        type=cat_type,
        amount=entry_in.amount,
        description=entry_in.remarks.strip() if entry_in.remarks else (entry_in.category or "Stream Entry"),
        transaction_date=entry_in.entry_date,
    )
    db.add(tx)
    db.flush()

    entry = StreamEntry(
        book_id=book_id,
        user_id=user_id,
        transaction_id=tx.id,
        type=entry_in.type,
        amount=entry_in.amount,
        remarks=entry_in.remarks.strip() if entry_in.remarks else None,
        category=entry_in.category.strip() if entry_in.category else (category.name if category else None),
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
        transaction_id=entry.transaction_id,
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

    if entry.transaction_id:
        tx = db.query(Transaction).filter(Transaction.id == entry.transaction_id).first()
        if tx:
            if entry_in.type is not None:
                tx.type = "income" if entry.type == "IN" else "expense"
            if entry_in.amount is not None:
                tx.amount = entry.amount
            if entry_in.remarks is not None:
                tx.description = entry.remarks
            if entry_in.entry_date is not None:
                tx.transaction_date = entry.entry_date

    db.commit()
    db.refresh(entry)

    summary = get_book_summary(db, book_id, user_id)
    return StreamEntryResponse(
        id=entry.id,
        book_id=entry.book_id,
        user_id=entry.user_id,
        transaction_id=entry.transaction_id,
        type=entry.type,
        amount=Decimal(str(entry.amount)),
        remarks=entry.remarks,
        category=entry.category,
        entry_date=entry.entry_date,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        running_balance=summary.net_balance if summary else Decimal(str(entry.amount)),
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

    if entry.transaction_id:
        tx = db.query(Transaction).filter(Transaction.id == entry.transaction_id).first()
        if tx:
            db.delete(tx)

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

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 30, 576, 30)
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(36, 18, "Finance Intel  *  Official Stream Book Ledger Statement  *  Verified Audit")
        self.drawRightString(576, 18, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

def clean_pdf_string(val: Optional[str]) -> str:
    if val is None:
        return ""
    s = str(val).replace("₹", "INR ").replace("–", "-").replace("—", "-").replace("•", " * ").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return s.encode("latin-1", "replace").decode("latin-1")

def generate_stream_pdf(book_title: str, book_desc: Optional[str], entries: List[StreamEntry]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=44,
    )
    styles = getSampleStyleSheet()

    title_clean = clean_pdf_string(book_title or "Stream Book")
    desc_clean = clean_pdf_string(book_desc or "Isolated financial cash book ledger")

    header_data = [
        [
            Paragraph(f'<font size=7 color="#38bdf8"><b>FINANCE INTEL  |  ISOLATED CASH BOOK STATEMENT</b></font><br/><font size=15 color="#ffffff"><b>{title_clean}</b></font><br/><font size=8 color="#94a3b8">{desc_clean}</font>', styles["Normal"]),
            Paragraph('<font size=8 color="#00f5d4"><b>VERIFIED LEDGER</b></font><br/><font size=7.5 color="#cbd5e1">Official CashBook Record</font><br/><font size=7.5 color="#cbd5e1">Currency: INR (Rs.)</font>', styles["Normal"]),
        ]
    ]
    header_table = Table(header_data, colWidths=[370, 170])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#090e1a")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))

    total_in = Decimal("0.00")
    total_out = Decimal("0.00")
    for e in entries:
        amt = Decimal(str(e.amount))
        if e.type == "IN":
            total_in += amt
        else:
            total_out += amt
    net_bal = total_in - total_out
    bal_hex = "#059669" if net_bal >= 0 else "#dc2626"

    kpi_data = [
        [
            Paragraph(f'<font size=7 color="#047857"><b>TOTAL CASH INFLOW</b></font><br/><font size=12 color="#059669"><b>+INR {total_in:,.2f}</b></font>', styles["Normal"]),
            Paragraph(f'<font size=7 color="#b91c1c"><b>TOTAL CASH OUTFLOW</b></font><br/><font size=12 color="#dc2626"><b>-INR {total_out:,.2f}</b></font>', styles["Normal"]),
            Paragraph(f'<font size=7 color="#0369a1"><b>NET RUNNING BALANCE</b></font><br/><font size=12 color="{bal_hex}"><b>INR {net_bal:,.2f}</b></font>', styles["Normal"]),
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[176, 176, 176])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#f0fdf4")),
        ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#fef2f2")),
        ("BACKGROUND", (2, 0), (2, 0), colors.HexColor("#f0f9ff")),
        ("BOX", (0, 0), (0, 0), 0.75, colors.HexColor("#86efac")),
        ("BOX", (1, 0), (1, 0), 0.75, colors.HexColor("#fca5a5")),
        ("BOX", (2, 0), (2, 0), 0.75, colors.HexColor("#7dd3fc")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    table_data = [
        ["#", "Date", "Type", "Category", "Remarks / Description", "Cash In", "Cash Out", "Balance"]
    ]

    table_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7.5),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("ALIGN", (5, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 1), (-1, -1), 7),
        ("TOPPADDING", (0, 1), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]

    running_bal = Decimal("0.00")
    for idx, e in enumerate(entries, 1):
        amt = Decimal(str(e.amount))
        is_in = e.type == "IN"
        if is_in:
            running_bal += amt
            in_val = f"+{amt:,.2f}"
            out_val = "-"
            type_str = "IN"
        else:
            running_bal -= amt
            in_val = "-"
            out_val = f"-{amt:,.2f}"
            type_str = "OUT"

        row_idx = len(table_data)
        bg = colors.HexColor("#f8fafc") if idx % 2 == 1 else colors.white
        table_styles.append(("BACKGROUND", (0, row_idx), (-1, row_idx), bg))

        type_color = colors.HexColor("#059669") if is_in else colors.HexColor("#dc2626")
        table_styles.append(("TEXTCOLOR", (2, row_idx), (2, row_idx), type_color))
        table_styles.append(("FONTNAME", (2, row_idx), (2, row_idx), "Helvetica-Bold"))

        if is_in:
            table_styles.append(("TEXTCOLOR", (5, row_idx), (5, row_idx), colors.HexColor("#059669")))
            table_styles.append(("FONTNAME", (5, row_idx), (5, row_idx), "Helvetica-Bold"))
        else:
            table_styles.append(("TEXTCOLOR", (6, row_idx), (6, row_idx), colors.HexColor("#dc2626")))
            table_styles.append(("FONTNAME", (6, row_idx), (6, row_idx), "Helvetica-Bold"))

        table_styles.append(("FONTNAME", (7, row_idx), (7, row_idx), "Helvetica-Bold"))

        date_val = e.entry_date.strftime("%Y-%m-%d") if e.entry_date else "-"
        cat_val = clean_pdf_string(e.category or "General")[:20]
        rem_val = clean_pdf_string(e.remarks or "-")[:36]

        table_data.append([
            str(idx),
            date_val,
            type_str,
            cat_val,
            rem_val,
            in_val,
            out_val,
            f"{running_bal:,.2f}",
        ])

    ledger_table = Table(
        table_data,
        colWidths=[20, 62, 34, 76, 172, 58, 58, 60],
        repeatRows=1,
    )
    ledger_table.setStyle(TableStyle(table_styles))

    elements = [
        header_table,
        Spacer(1, 8),
        kpi_table,
        Spacer(1, 10),
        ledger_table,
    ]

    doc.build(elements, canvasmaker=NumberedCanvas)
    return buffer.getvalue()

def export_book_pdf(db: Session, book_id: int, user_id: int) -> Optional[bytes]:
    book = get_book(db, book_id, user_id)
    if not book:
        return None
    entries = (
        db.query(StreamEntry)
        .filter(StreamEntry.book_id == book_id)
        .order_by(StreamEntry.entry_date.asc(), StreamEntry.id.asc())
        .all()
    )
    return generate_stream_pdf(book.title, book.description, entries)
