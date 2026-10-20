import csv
import io
import json
import re
import zlib
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import desc, asc, or_, cast, String
from sqlalchemy.orm import Session, joinedload

from app.models.category import Category
from app.models.stream import StreamBook, StreamEntry
from app.models.transaction import Transaction
from app.schemas.transaction import (
    FileImportSummary,
    TransactionCreate,
    TransactionImportResponse,
    TransactionUpdate,
)

def get_transaction(
    db: Session,
    transaction_id: int,
    user_id: int,
) -> Optional[Transaction]:
    return (
        db.query(Transaction)
        .options(joinedload(Transaction.category), joinedload(Transaction.book))
        .filter(
            Transaction.id == transaction_id,
            Transaction.user_id == user_id,
        )
        .first()
    )

def get_transactions(
    db: Session,
    user_id: int,
    transaction_type: Optional[str] = None,
    category_id: Optional[int] = None,
    book_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    search: Optional[str] = None,
    sort: str = "date_desc",
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[Transaction], int]:
    query = (
        db.query(Transaction)
        .options(joinedload(Transaction.category), joinedload(Transaction.book))
        .filter(Transaction.user_id == user_id)
    )

    if transaction_type:
        query = query.filter(Transaction.type == transaction_type)

    if category_id:
        query = query.filter(Transaction.category_id == category_id)

    if book_id:
        query = query.filter(Transaction.book_id == book_id)

    if start_date and end_date and start_date > end_date:
        start_date, end_date = end_date, start_date

    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)

    if end_date:
        if end_date.hour == 0 and end_date.minute == 0 and end_date.second == 0 and end_date.microsecond == 0:
            end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        query = query.filter(Transaction.transaction_date <= end_date)

    if search and search.strip():
        term = f"%{search.strip()}%"
        search_filters = [
            Transaction.description.ilike(term),
            Category.name.ilike(term),
            cast(Transaction.amount, String).ilike(term),
        ]
        stripped = search.strip()
        if "." in stripped:
            rstrip_zero = stripped.rstrip("0").rstrip(".")
            if rstrip_zero:
                search_filters.append(cast(Transaction.amount, String).ilike(f"%{rstrip_zero}%"))
        query = query.outerjoin(Transaction.category).filter(or_(*search_filters))

    total = query.count()

    if sort == "date_asc":
        query = query.order_by(asc(Transaction.transaction_date), asc(Transaction.id))
    elif sort == "amount_desc":
        query = query.order_by(desc(Transaction.amount), desc(Transaction.id))
    elif sort == "amount_asc":
        query = query.order_by(asc(Transaction.amount), asc(Transaction.id))
    else:
        query = query.order_by(desc(Transaction.transaction_date), desc(Transaction.id))

    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    return items, total

def get_or_create_default_user_book(db: Session, user_id: int) -> StreamBook:
    book = (
        db.query(StreamBook)
        .filter(StreamBook.user_id == user_id)
        .order_by(StreamBook.id.asc())
        .first()
    )
    if not book:
        book = StreamBook(
            user_id=user_id,
            title="Main Ledger",
            description="Primary financial stream ledger",
            color="#3b82f6",
            icon="book",
        )
        db.add(book)
        db.flush()
    return book

def create_transaction(
    db: Session,
    user_id: int,
    transaction_in: TransactionCreate,
) -> Transaction:
    target_book_id = transaction_in.book_id
    if target_book_id:
        book = (
            db.query(StreamBook)
            .filter(StreamBook.id == target_book_id, StreamBook.user_id == user_id)
            .first()
        )
        if not book:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified stream book does not exist or is not accessible.",
            )
    else:
        book = get_or_create_default_user_book(db, user_id)
        target_book_id = book.id

    db_transaction = Transaction(
        user_id=user_id,
        book_id=target_book_id,
        category_id=transaction_in.category_id,
        type=transaction_in.type,
        amount=transaction_in.amount,
        description=transaction_in.description,
        transaction_date=transaction_in.transaction_date,
    )
    db.add(db_transaction)
    db.flush()

    category = (
        db.query(Category)
        .filter(Category.id == db_transaction.category_id)
        .first()
    )
    category_name = category.name if category else "General"

    stream_entry = StreamEntry(
        book_id=target_book_id,
        user_id=user_id,
        transaction_id=db_transaction.id,
        type="IN" if db_transaction.type == "income" else "OUT",
        amount=db_transaction.amount,
        remarks=db_transaction.description or category_name,
        category=category_name,
        entry_date=db_transaction.transaction_date,
    )
    db.add(stream_entry)
    db.commit()
    db.refresh(db_transaction)

    return (
        db.query(Transaction)
        .options(joinedload(Transaction.category), joinedload(Transaction.book))
        .filter(Transaction.id == db_transaction.id)
        .first()
    )

def update_transaction(
    db: Session,
    transaction: Transaction,
    transaction_in: TransactionUpdate,
) -> Transaction:
    update_data = transaction_in.model_dump(exclude_unset=True)
    if "book_id" in update_data and update_data["book_id"] is not None:
        target_book_id = update_data["book_id"]
        book = (
            db.query(StreamBook)
            .filter(StreamBook.id == target_book_id, StreamBook.user_id == transaction.user_id)
            .first()
        )
        if not book:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified stream book does not exist or is not accessible.",
            )

    for key, value in update_data.items():
        setattr(transaction, key, value)
    db.flush()

    category = (
        db.query(Category)
        .filter(Category.id == transaction.category_id)
        .first()
    )
    category_name = category.name if category else "General"

    linked_entry = (
        db.query(StreamEntry)
        .filter(StreamEntry.transaction_id == transaction.id)
        .first()
    )
    if linked_entry:
        linked_entry.book_id = transaction.book_id
        linked_entry.type = "IN" if transaction.type == "income" else "OUT"
        linked_entry.amount = transaction.amount
        linked_entry.remarks = transaction.description or category_name
        linked_entry.category = category_name
        linked_entry.entry_date = transaction.transaction_date
    else:
        stream_entry = StreamEntry(
            book_id=transaction.book_id,
            user_id=transaction.user_id,
            transaction_id=transaction.id,
            type="IN" if transaction.type == "income" else "OUT",
            amount=transaction.amount,
            remarks=transaction.description or category_name,
            category=category_name,
            entry_date=transaction.transaction_date,
        )
        db.add(stream_entry)

    db.commit()
    db.refresh(transaction)
    return (
        db.query(Transaction)
        .options(joinedload(Transaction.category), joinedload(Transaction.book))
        .filter(Transaction.id == transaction.id)
        .first()
    )

def delete_transaction(db: Session, transaction: Transaction) -> None:
    db.query(StreamEntry).filter(StreamEntry.transaction_id == transaction.id).delete(synchronize_session=False)
    db.delete(transaction)
    db.commit()

def delete_all_user_transactions(db: Session, user_id: int) -> int:
    user_tx_ids = [tx_id for (tx_id,) in db.query(Transaction.id).filter(Transaction.user_id == user_id).all()]
    if user_tx_ids:
        db.query(StreamEntry).filter(StreamEntry.transaction_id.in_(user_tx_ids)).delete(synchronize_session=False)
    deleted_count = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted_count

DATE_TOKEN_REGEX = re.compile(
    r"\b("
    r"\d{4}[-/.]\d{1,2}[-/.]\d{1,2}"
    r"|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}"
    r"|\d{1,2}[\s\-/.]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[\s,\-/.]*\d{2,4}"
    r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[\s\-/.]+\d{1,2},?[\s\-/.]+\d{2,4}"
    r")\b",
    re.IGNORECASE,
)

INCOME_DIRECTION_REGEX = re.compile(
    r"\b("
    r"payment\s*received|amount\s*received|funds\s*received|money\s*received"
    r"|received\s*from|payment\s*from|amount\s*from|funds\s*from"
    r"|credited|direct\s*credit|neft\s*cr|rtgs\s*cr|imps\s*cr|upi\s*/?\s*cr"
    r"|deposit|deposited|cash\s*deposit|cheque\s*deposit|direct\s*deposit"
    r"|salary|payroll|stipend|bonus|freelance|dividend|interest|yield"
    r"|refund|refunded|reversal|reversed|cashback|subsidy|rebate|settlement"
    r"|inward\s*remittance|inward\s*transfer|inward\s*payment|inward"
    r"|money\s*in|paid\s*in|receipt|receipts|income|inflow|received"
    r"|(?<![a-z])cr(?![a-z])"
    r")\b",
    re.IGNORECASE,
)

EXPENSE_DIRECTION_REGEX = re.compile(
    r"\b("
    r"payment\s*to|paid\s*to|transfer\s*to|sent\s*to|money\s*sent"
    r"|payment\s*for|paid\s*for|fee\s*for|charge\s*for"
    r"|debited|direct\s*debit|neft\s*dr|rtgs\s*dr|imps\s*dr|upi\s*/?\s*dr"
    r"|withdrawal|withdraw|withdrawn|cash\s*withdrawal|atm\s*withdrawal|atm\s*wdl"
    r"|bill\s*payment|utility\s*payment|pos\s*payment|merchant\s*payment"
    r"|outward\s*remittance|outward\s*transfer|outward"
    r"|money\s*out|paid\s*out|spent|spending|expense|expenses|debit|outflow"
    r"|(?<![a-z])dr(?![a-z])"
    r")\b",
    re.IGNORECASE,
)

KNOWN_CATEGORIES = {
    "salary": ("Salary", "income"),
    "freelance": ("Freelance", "income"),
    "investment": ("Investment", "income"),
    "business": ("Business", "income"),
    "food": ("Food", "expense"),
    "transport": ("Transport", "expense"),
    "shopping": ("Shopping", "expense"),
    "bills": ("Bills", "expense"),
    "entertainment": ("Entertainment", "expense"),
    "healthcare": ("Healthcare", "expense"),
    "education": ("Education", "expense"),
    "travel": ("Travel", "expense"),
    "other": ("Other", None),
}

def _normalize_key(key: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(key or "").strip().lower())

def _classify_column_header(raw_header: Any) -> Optional[str]:
    text = str(raw_header or "").strip().lower()
    if not text:
        return None
    norm = _normalize_key(text)
    if not norm:
        return None

    if any(k in norm for k in ("balance", "closingbal", "openingbal", "runningbal", "availbal", "ledgerbal")) or norm == "bal":
        return "balance"

    if norm in {"drcr", "crdr", "debitcredit", "creditdebit", "type", "txntype", "transactiontype", "entrytype", "indicator", "direction", "flow"} or (
        norm in {"dr/cr", "cr/dr"} or bool(re.search(r"\b(dr\s*/\s*cr|cr\s*/\s*dr)\b", text))
    ):
        return "type"

    if any(
        k in norm
        for k in (
            "cramount",
            "cramt",
            "crinr",
            "crrs",
            "amountcredited",
            "creditedamount",
            "depositamount",
            "depositamt",
            "depositedamount",
            "credit",
            "deposit",
            "deposited",
            "inflow",
            "income",
            "received",
            "receipt",
            "moneyin",
            "paidin",
            "earning",
        )
    ) or norm in {"cr", "in", "creditcr", "depositcr"}:
        return "credit"

    if any(
        k in norm
        for k in (
            "dramount",
            "dramt",
            "drinr",
            "drrs",
            "amountdebited",
            "debitedamount",
            "withdrawalamount",
            "withdrawalamt",
            "withdrawnamount",
            "debit",
            "withdrawal",
            "withdraw",
            "withdrawn",
            "outflow",
            "expense",
            "moneyout",
            "paidout",
            "spend",
            "spent",
            "payment",
        )
    ) or norm in {"dr", "out", "paid", "debitdr", "withdrawaldr"}:
        return "debit"

    if any(k in norm for k in ("date", "txndt", "trandt", "valuedt", "postdt", "bookingdt", "timestamp", "datetime", "time")) or norm == "dt":
        return "date"

    if any(k in norm for k in ("cheque", "chq", "refno", "reference", "utr", "urn", "txnid", "instrument", "slip")) or norm in {"ref", "chqno", "refnum"}:
        return "reference"

    if any(k in norm for k in ("category", "tag", "group", "classification", "head")) or norm == "cat":
        return "category"

    if any(
        k in norm
        for k in (
            "particulars",
            "particular",
            "narration",
            "narrative",
            "description",
            "desc",
            "details",
            "detail",
            "remarks",
            "remark",
            "memo",
            "merchant",
            "payee",
            "beneficiary",
            "title",
            "note",
            "summary",
            "transaction",
        )
    ):
        return "description"

    if any(k in norm for k in ("amount", "amt", "value", "total", "sum", "net")) or norm in {"inr", "rs", "usd", "eur", "gbp"}:
        return "amount"

    return None

def _detect_direction_from_text(raw: Any) -> Optional[str]:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    low = text.lower()
    norm = _normalize_key(low)

    if norm in {
        "income",
        "credit",
        "credited",
        "cr",
        "c",
        "deposit",
        "deposited",
        "inflow",
        "in",
        "received",
        "receipt",
        "moneyin",
        "paidin",
        "earning",
        "salary",
        "creditcr",
        "crcredit",
        "depositcr",
    }:
        return "income"

    if norm in {
        "expense",
        "expenses",
        "debit",
        "debited",
        "dr",
        "d",
        "withdrawal",
        "withdraw",
        "withdrawn",
        "outflow",
        "out",
        "paid",
        "payment",
        "spend",
        "spent",
        "moneyout",
        "paidout",
        "debitdr",
        "drdebit",
        "withdrawaldr",
    }:
        return "expense"

    has_inc = bool(INCOME_DIRECTION_REGEX.search(text))
    has_exp = bool(EXPENSE_DIRECTION_REGEX.search(text))

    if has_inc and not has_exp:
        return "income"
    if has_exp and not has_inc:
        return "expense"
    if has_inc and has_exp:
        strong_inc = bool(
            re.search(
                r"\b(payment\s*received|amount\s*received|funds\s*received|received\s*from|payment\s*from"
                r"|credit|credited|deposit|deposited|salary|payroll|dividend|interest|refund|reversal|cashback|inward|receipt)\b",
                text,
                re.IGNORECASE,
            )
        )
        if strong_inc:
            return "income"
        return "expense"
    return None

def _parse_amount_and_direction(raw: Any) -> Tuple[Optional[Decimal], Optional[str]]:
    if raw is None:
        return None, None
    text = str(raw).strip()
    if not text or text in {"-", "--", "nil", "null", "none", "n/a", "na"}:
        return None, None

    if DATE_TOKEN_REGEX.fullmatch(text):
        return None, None

    direction = _detect_direction_from_text(text)

    text_no_dates = DATE_TOKEN_REGEX.sub(" ", text)

    is_paren_negative = "(" in text_no_dates and ")" in text_no_dates and bool(
        re.search(r"\(\s*[₹$€£]?\s*\d", text_no_dates)
    )

    num_match = re.search(
        r"([+\-])?\s*(?:₹|rs\.?|inr|\$|€|£)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)",
        text_no_dates,
        re.IGNORECASE,
    )
    if not num_match:
        return None, direction

    sign_char = num_match.group(1) or ""
    digits_part = num_match.group(2).replace(",", "")

    if "." not in digits_part and len(digits_part) >= 10:
        return None, direction

    try:
        val = Decimal(digits_part)
        if val == Decimal("0.00"):
            return Decimal("0.00"), direction
        if sign_char == "-" or is_paren_negative:
            val = -abs(val)
            if direction is None:
                direction = "expense"
        elif sign_char == "+" and direction is None:
            direction = "income"
        return val.quantize(Decimal("0.01")), direction
    except (InvalidOperation, ValueError):
        return None, direction

def _parse_decimal_amount(raw: Any) -> Optional[Decimal]:
    val, _ = _parse_amount_and_direction(raw)
    return val

def _parse_flexible_date(raw: Any) -> datetime:
    if raw is None or not str(raw).strip():
        return datetime.now(timezone.utc)
    text = str(raw).strip()

    date_match = DATE_TOKEN_REGEX.search(text)
    if date_match:
        text_candidate = date_match.group(1).strip()
    else:
        text_candidate = text

    for candidate in (text, text_candidate):
        try:
            iso_candidate = candidate.replace("Z", "+00:00")
            dt = datetime.fromisoformat(iso_candidate)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            pass

    norm_candidate = re.sub(r"\s+", " ", text_candidate)
    norm_candidate = re.sub(r"\bSept\b", Sep_str := "Sep", norm_candidate, flags=re.IGNORECASE)

    date_formats = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%m/%d/%Y",
        "%d.%m.%Y",
        "%Y.%m.%d",
        "%d %b %Y",
        "%d-%b-%Y",
        "%d/%b/%Y",
        "%d %B %Y",
        "%d-%B-%Y",
        "%d %b, %Y",
        "%b %d, %Y",
        "%B %d, %Y",
        "%b %d %Y",
        "%B %d %Y",
        "%d-%m-%y",
        "%d/%m/%y",
        "%m/%d/%y",
        "%d.%m.%y",
        "%d %b %y",
        "%d-%b-%y",
        "%d/%b/%y",
        "%Y-%m-%d %H:%M:%S",
        "%d-%m-%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
    ]
    for fmt in date_formats:
        for cand in (norm_candidate, text.strip()):
            try:
                dt = datetime.strptime(cand, fmt)
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                continue

    raise ValueError(f"Unrecognized date format '{text}'")

def _infer_category_from_description(description: str, tx_type: str) -> str:
    desc_lower = (description or "").lower()
    if tx_type == "income":
        if any(k in desc_lower for k in ("salary", "payroll", "stipend", "wage", "bonus")):
            return "Salary"
        if any(k in desc_lower for k in ("freelance", "consulting", "client", "contract", "upwork", "fiverr")):
            return "Freelance"
        if any(k in desc_lower for k in ("dividend", "interest", "mutual fund", "stock", "yield", "zerodha", "groww")):
            return "Investment"
        if any(k in desc_lower for k in ("business", "invoice", "revenue", "sales", "settlement", "merchant")):
            return "Business"
        return "Other"

    if any(k in desc_lower for k in ("swiggy", "zomato", "food", "dining", "restaurant", "cafe", "coffee", "bakery", "grocery", "supermarket", "blinkit", "zepto", "bigbasket", "instamart")):
        return "Food"
    if any(k in desc_lower for k in ("uber", "ola", "rapido", "metro", "transit", "cab", "fuel", "petrol", "diesel", "transport", "train", "irctc", "bus", "parking", "fastag", "toll")):
        return "Transport"
    if any(k in desc_lower for k in ("amazon", "flipkart", "myntra", "ajio", "nykaa", "shopping", "retail", "mall", "store", "mart", "apparel", "electronics")):
        return "Shopping"
    if any(k in desc_lower for k in ("electricity", "water", "gas", "wifi", "broadband", "internet", "airtel", "jio", "vi", "bsnl", "rent", "maintenance", "recharge", "bill", "utility", "insurance", "emi", "loan")):
        return "Bills"
    if any(k in desc_lower for k in ("movie", "netflix", "spotify", "prime", "hotstar", "bookmyshow", "gaming", "entertainment", "subscription")):
        return "Entertainment"
    if any(k in desc_lower for k in ("hospital", "pharmacy", "apollo", "medplus", "pharmeasy", "1mg", "medical", "doctor", "clinic", "health", "gym", "fitness")):
        return "Healthcare"
    if any(k in desc_lower for k in ("course", "udemy", "coursera", "tuition", "book", "school", "college", "university", "education", "exam")):
        return "Education"
    if any(k in desc_lower for k in ("flight", "indigo", "air india", "makemytrip", "goibibo", "yatra", "hotel", "airbnb", "oyo", "vacation", "travel", "trip")):
        return "Travel"
    return "Other"

def _detect_header_mapping(row_cells: List[Any]) -> Optional[Dict[int, str]]:
    mapping: Dict[int, str] = {}
    for idx, cell in enumerate(row_cells):
        cell_str = str(cell or "").strip()
        if not cell_str or len(cell_str) > 45:
            continue
        if DATE_TOKEN_REGEX.search(cell_str) or re.fullmatch(r"[+\-₹$€£\d,.\s]+", cell_str):
            continue
        role = _classify_column_header(cell_str)
        if role:
            mapping[idx] = role

    roles = set(mapping.values())
    has_financial_col = bool(roles.intersection({"amount", "debit", "credit", "type"}))
    if len(mapping) >= 2 and has_financial_col:
        return mapping
    return None

def _extract_dict_from_mapped_cells(
    cells: List[Any],
    header_map: Dict[int, str],
) -> Optional[Dict[str, Any]]:
    if _detect_header_mapping(cells) is not None:
        return None

    date_val = ""
    desc_parts: List[str] = []
    category_val = ""
    type_val = ""
    debit_val: Optional[Decimal] = None
    credit_val: Optional[Decimal] = None
    amount_val: Optional[Decimal] = None
    inline_dir: Optional[str] = None

    for idx, raw_cell in enumerate(cells):
        cell_text = re.sub(r"\s+", " ", str(raw_cell or "")).strip()
        if not cell_text or cell_text in {"-", "--"}:
            continue
        role = header_map.get(idx)

        if role in {"balance", "reference"}:
            continue
        elif role == "date":
            if not date_val and DATE_TOKEN_REGEX.search(cell_text):
                date_val = DATE_TOKEN_REGEX.search(cell_text).group(1)
            elif not date_val:
                date_val = cell_text
        elif role == "category":
            if not category_val:
                category_val = cell_text
        elif role == "type":
            detected = _detect_direction_from_text(cell_text)
            if detected:
                type_val = detected
        elif role == "debit":
            amt, _ = _parse_amount_and_direction(cell_text)
            if amt is not None and abs(amt) > Decimal("0.00"):
                debit_val = abs(amt)
        elif role == "credit":
            amt, _ = _parse_amount_and_direction(cell_text)
            if amt is not None and abs(amt) > Decimal("0.00"):
                credit_val = abs(amt)
        elif role == "amount":
            amt, dir_hint = _parse_amount_and_direction(cell_text)
            if amt is not None and abs(amt) > Decimal("0.00"):
                amount_val = amt
                if dir_hint:
                    inline_dir = dir_hint
        elif role == "description":
            desc_parts.append(cell_text)
        else:
            if not date_val and DATE_TOKEN_REGEX.search(cell_text):
                date_val = DATE_TOKEN_REGEX.search(cell_text).group(1)
            else:
                dir_check = _detect_direction_from_text(cell_text)
                if dir_check and len(cell_text) <= 12 and not type_val:
                    type_val = dir_check
                elif not re.fullmatch(r"[\d,.\-+₹$€£\s]+", cell_text):
                    desc_parts.append(cell_text)

    final_type: Optional[str] = type_val or inline_dir
    final_amount: Optional[Decimal] = None

    if credit_val is not None and credit_val > Decimal("0.00") and (debit_val is None or debit_val == Decimal("0.00")):
        final_type = "income"
        final_amount = credit_val
    elif debit_val is not None and debit_val > Decimal("0.00") and (credit_val is None or credit_val == Decimal("0.00")):
        final_type = "expense"
        final_amount = debit_val
    elif amount_val is not None and abs(amount_val) > Decimal("0.00"):
        if final_type is None:
            final_type = "expense" if amount_val < Decimal("0.00") else None
        final_amount = abs(amount_val)

    if final_amount is None or final_amount <= Decimal("0.00"):
        joined_line = " | ".join(str(c or "").strip() for c in cells if str(c or "").strip())
        fallback_rows = _parse_pdf_transaction_lines([joined_line])
        if fallback_rows:
            return fallback_rows[0]
        return None

    description_clean = " - ".join(p for p in desc_parts if p).strip()
    if not final_type:
        dir_from_desc = _detect_direction_from_text(description_clean)
        if dir_from_desc:
            final_type = dir_from_desc
        else:
            inferred_inc = any(
                k in description_clean.lower()
                for k in (
                    "salary",
                    "payroll",
                    "freelance",
                    "consulting",
                    "dividend",
                    "interest",
                    "yield",
                    "refund",
                    "deposit",
                    "credit",
                    "received",
                    "receipt",
                    "inflow",
                    "inward",
                    "bonus",
                    "stipend",
                    "payment from",
                    "reversal",
                    "cashback",
                )
            )
            final_type = "income" if inferred_inc else "expense"

    return {
        "transaction_date": date_val,
        "type": final_type,
        "category": category_val,
        "description": description_clean or category_val or "Imported Transaction",
        "amount": str(final_amount),
    }

def _extract_rows_via_pdfplumber_tables(pdf) -> List[Dict[str, Any]]:
    extracted: List[Dict[str, Any]] = []
    active_header_map: Optional[Dict[int, str]] = None

    table_settings_list = [
        {},
        {"vertical_strategy": "lines", "horizontal_strategy": "text"},
    ]

    for page in pdf.pages:
        page_tables = []
        for settings in table_settings_list:
            try:
                tbs = page.extract_tables(settings) if settings else page.extract_tables()
                if tbs and any(len(t) >= 2 and max(len(r) for r in t if r) >= 3 for t in tbs):
                    page_tables = tbs
                    break
            except Exception:
                continue

        for table in page_tables:
            for raw_row in table:
                if not raw_row:
                    continue
                cells = [re.sub(r"\s+", " ", str(c or "")).strip() for c in raw_row]
                if not any(cells):
                    continue

                detected_map = _detect_header_mapping(cells)
                if detected_map is not None:
                    active_header_map = detected_map
                    continue

                if active_header_map:
                    item = _extract_dict_from_mapped_cells(cells, active_header_map)
                    if item:
                        extracted.append(item)
                else:
                    joined = " | ".join(c for c in cells if c)
                    parsed = _parse_pdf_transaction_lines([joined])
                    extracted.extend(parsed)

    return extracted

def _extract_rows_via_pdfplumber_words(pdf) -> List[Dict[str, Any]]:
    extracted: List[Dict[str, Any]] = []
    col_x_centers: Dict[str, float] = {}
    pipe_header_map: Optional[Dict[int, str]] = None

    for page in pdf.pages:
        try:
            words = page.extract_words(keep_blank_chars=False, use_text_flow=False)
        except Exception:
            continue
        if not words:
            continue

        words_sorted = sorted(words, key=lambda w: (round(float(w.get("top", 0)) / 4.0), float(w.get("x0", 0))))
        lines_of_words: List[List[Dict[str, Any]]] = []
        for w in words_sorted:
            w_top = float(w.get("top", 0))
            if not lines_of_words:
                lines_of_words.append([w])
            else:
                prev_top = float(lines_of_words[-1][0].get("top", 0))
                if abs(w_top - prev_top) <= 4.5:
                    lines_of_words[-1].append(w)
                else:
                    lines_of_words[-1].sort(key=lambda item: float(item.get("x0", 0)))
                    lines_of_words.append([w])
        if lines_of_words:
            lines_of_words[-1].sort(key=lambda item: float(item.get("x0", 0)))

        for word_line in lines_of_words:
            texts = [str(w.get("text", "")).strip() for w in word_line if str(w.get("text", "")).strip()]
            if not texts:
                continue
            line_str = " ".join(texts)

            if "|" in line_str:
                pipe_cells = [c.strip() for c in line_str.split("|")]
                detected_pipe_map = _detect_header_mapping(pipe_cells)
                if detected_pipe_map is not None:
                    pipe_header_map = detected_pipe_map
                    continue
                if pipe_header_map is not None:
                    mapped_item = _extract_dict_from_mapped_cells(pipe_cells, pipe_header_map)
                    if mapped_item:
                        extracted.append(mapped_item)
                        continue
                parsed_pipe = _parse_pdf_transaction_lines([line_str])
                if parsed_pipe:
                    extracted.extend(parsed_pipe)
                continue

            header_role_positions: Dict[str, List[float]] = {}
            for w in word_line:
                role = _classify_column_header(w.get("text", ""))
                if role in {"debit", "credit", "balance", "amount", "type", "date", "category", "reference"}:
                    x_center = (float(w.get("x0", 0)) + float(w.get("x1", 0))) / 2.0
                    header_role_positions.setdefault(role, []).append(x_center)

            if (
                len(header_role_positions) >= 2
                and any(r in header_role_positions for r in ("debit", "credit", "amount"))
                and not DATE_TOKEN_REGEX.search(line_str)
            ):
                for r_key, pos_list in header_role_positions.items():
                    col_x_centers[r_key] = sum(pos_list) / len(pos_list)
                if ("debit" in col_x_centers or "credit" in col_x_centers) and "amount" in col_x_centers:
                    del col_x_centers["amount"]
                continue

            date_match = DATE_TOKEN_REGEX.search(line_str)
            if date_match and ("debit" in col_x_centers or "credit" in col_x_centers):
                date_str = date_match.group(1)
                debit_amt: Optional[Decimal] = None
                credit_amt: Optional[Decimal] = None
                generic_amt: Optional[Decimal] = None
                explicit_dir: Optional[str] = None
                desc_tokens: List[str] = []

                deb_x = col_x_centers.get("debit")
                cred_x = col_x_centers.get("credit")
                bal_x = col_x_centers.get("balance")
                ref_x = col_x_centers.get("reference")

                for w in word_line:
                    w_text = str(w.get("text", "")).strip()
                    if not w_text or w_text == "|":
                        continue
                    if w_text in date_str or DATE_TOKEN_REGEX.search(w_text):
                        continue

                    if re.fullmatch(
                        r"(?:cr\.?|dr\.?|credit|debit|deposit|withdrawal|withdraw|income|expense)",
                        w_text,
                        re.IGNORECASE,
                    ):
                        explicit_dir = _detect_direction_from_text(w_text)
                        continue

                    x_c = (float(w.get("x0", 0)) + float(w.get("x1", 0))) / 2.0

                    if ref_x is not None and abs(x_c - ref_x) <= 35:
                        continue

                    amt, amt_dir = _parse_amount_and_direction(w_text)
                    if amt is not None and abs(amt) > Decimal("0.00") and re.search(r"\d", w_text):
                        if "." not in w_text and not any(c in w_text for c in "₹$€£,") and len(re.sub(r"\D", "", w_text)) >= 5:
                            desc_tokens.append(w_text)
                            continue

                        if amt_dir:
                            explicit_dir = amt_dir

                        if bal_x is not None and abs(x_c - bal_x) <= 45:
                            continue

                        if deb_x is not None and cred_x is not None:
                            mid_x = (deb_x + cred_x) / 2.0
                            if deb_x < cred_x:
                                if x_c <= mid_x:
                                    debit_amt = abs(amt)
                                else:
                                    credit_amt = abs(amt)
                            else:
                                if x_c <= mid_x:
                                    credit_amt = abs(amt)
                                else:
                                    debit_amt = abs(amt)
                            continue
                        elif deb_x is not None and abs(x_c - deb_x) <= 50:
                            debit_amt = abs(amt)
                            continue
                        elif cred_x is not None and abs(x_c - cred_x) <= 50:
                            credit_amt = abs(amt)
                            continue

                        generic_amt = amt
                    else:
                        desc_tokens.append(w_text)

                final_amt: Optional[Decimal] = None
                final_type: Optional[str] = explicit_dir

                if explicit_dir is not None:
                    final_amt = credit_amt or debit_amt or (abs(generic_amt) if generic_amt is not None else None)
                elif credit_amt is not None and credit_amt > Decimal("0.00") and (debit_amt is None or debit_amt == Decimal("0.00")):
                    final_type = "income"
                    final_amt = credit_amt
                elif debit_amt is not None and debit_amt > Decimal("0.00") and (credit_amt is None or credit_amt == Decimal("0.00")):
                    final_type = "expense"
                    final_amt = debit_amt
                elif generic_amt is not None:
                    final_type = "expense" if generic_amt < Decimal("0.00") else None
                    final_amt = abs(generic_amt)

                if final_amt is not None and final_amt > Decimal("0.00"):
                    desc_clean = " ".join(desc_tokens).strip(" -|:,")
                    if not final_type:
                        dir_from_desc = _detect_direction_from_text(desc_clean)
                        if dir_from_desc:
                            final_type = dir_from_desc
                        else:
                            inferred_inc = any(
                                k in (desc_clean or line_str).lower()
                                for k in (
                                    "salary",
                                    "payroll",
                                    "freelance",
                                    "consulting",
                                    "dividend",
                                    "interest",
                                    "yield",
                                    "refund",
                                    "deposit",
                                    "credit",
                                    "received",
                                    "receipt",
                                    "inflow",
                                    "inward",
                                    "bonus",
                                    "stipend",
                                    "payment from",
                                    "reversal",
                                    "cashback",
                                )
                            )
                            final_type = "income" if inferred_inc else "expense"
                    extracted.append(
                        {
                            "transaction_date": date_str,
                            "type": final_type,
                            "category": "",
                            "description": desc_clean or "PDF Statement Entry",
                            "amount": str(final_amt),
                        }
                    )
                    continue

            parsed_line = _parse_pdf_transaction_lines([line_str])
            if parsed_line:
                extracted.extend(parsed_line)

    return extracted

def _decode_pdf_literal_string(raw: str) -> str:
    out = []
    i = 0
    n = len(raw)
    while i < n:
        ch = raw[i]
        if ch == "\\" and i + 1 < n:
            nxt = raw[i + 1]
            if nxt in "01234567":
                oct_digits = nxt
                j = i + 2
                while j < n and len(oct_digits) < 3 and raw[j] in "01234567":
                    oct_digits += raw[j]
                    j += 1
                out.append(chr(int(oct_digits, 8)))
                i = j
                continue
            escape_map = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f", "(": "(", ")": ")", "\\": "\\"}
            out.append(escape_map.get(nxt, nxt))
            i += 2
        else:
            out.append(ch)
            i += 1
    return "".join(out)

def _decode_pdf_hex_string(hex_str: str, cmap: Dict[int, str]) -> str:
    cleaned = re.sub(r"\s+", "", hex_str)
    if not cleaned:
        return ""
    if len(cleaned) % 2 == 1:
        cleaned += "0"
    try:
        raw_bytes = bytes.fromhex(cleaned)
    except ValueError:
        return ""

    if raw_bytes.startswith(b"\xfe\xff"):
        return raw_bytes[2:].decode("utf-16-be", errors="ignore")

    if cmap:
        has_two_byte = any(k > 255 for k in cmap)
        if has_two_byte and len(raw_bytes) % 2 == 0:
            chars = []
            for idx in range(0, len(raw_bytes), 2):
                code = (raw_bytes[idx] << 8) | raw_bytes[idx + 1]
                chars.append(cmap.get(code, chr(code) if 32 <= code <= 126 else ""))
            if any(chars):
                return "".join(chars)
        chars = [cmap.get(b, chr(b) if 32 <= b <= 126 else "") for b in raw_bytes]
        if any(chars):
            return "".join(chars)

    return raw_bytes.decode("latin-1", errors="ignore")

def _extract_pdf_cmap(stream_text: str, cmap: Dict[int, str]) -> None:
    for match in re.finditer(r"beginbfchar(.*?)endbfchar", stream_text, re.DOTALL):
        block = match.group(1)
        for pair in re.finditer(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            src_code = int(pair.group(1), 16)
            dst_bytes = bytes.fromhex(pair.group(2))
            dst_str = (
                dst_bytes.decode("utf-16-be", errors="ignore")
                if len(dst_bytes) >= 2
                else dst_bytes.decode("latin-1", errors="ignore")
            )
            cmap[src_code] = dst_str

    for match in re.finditer(r"beginbfrange(.*?)endbfrange", stream_text, re.DOTALL):
        block = match.group(1)
        for rng in re.finditer(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            start_code = int(rng.group(1), 16)
            end_code = int(rng.group(2), 16)
            base_val = int(rng.group(3), 16)
            for offset in range(max(0, min(end_code - start_code + 1, 512))):
                cmap[start_code + offset] = chr(base_val + offset)

def _extract_text_lines_from_pdf(content_bytes: bytes) -> List[str]:
    extracted_lines: List[str] = []

    try:
        import pdfplumber

        with pdfplumber.open(io.BytesIO(content_bytes)) as pdf:
            for page in pdf.pages:
                txt = page.extract_text(layout=True) or page.extract_text() or ""
                for ln in txt.splitlines():
                    if ln.strip():
                        extracted_lines.append(ln.strip())
        if extracted_lines:
            return extracted_lines
    except Exception:
        pass

    try:
        import pypdf

        reader = pypdf.PdfReader(io.BytesIO(content_bytes))
        for page in reader.pages:
            page_text = page.extract_text() or ""
            for ln in page_text.splitlines():
                if ln.strip():
                    extracted_lines.append(ln.strip())
        if extracted_lines:
            return extracted_lines
    except Exception:
        pass

    decompressed_streams: List[str] = []
    cmap: Dict[int, str] = {}

    for match in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", content_bytes, re.DOTALL):
        raw_stream = match.group(1)
        decoded_bytes = None
        for wbits in (zlib.MAX_WBITS, -zlib.MAX_WBITS):
            try:
                decoded_bytes = zlib.decompress(raw_stream, wbits)
                break
            except Exception:
                continue
        if decoded_bytes is None:
            decoded_bytes = raw_stream

        text_stream = decoded_bytes.decode("latin-1", errors="ignore")
        if "beginbfchar" in text_stream or "beginbfrange" in text_stream:
            _extract_pdf_cmap(text_stream, cmap)
        else:
            decompressed_streams.append(text_stream)

    lines: List[str] = []
    token_pattern = re.compile(
        r"(\[(?:[^\[\]]|\((?:\\.|[^\\()])*\))*\]\s*TJ"
        r"|\((?:\\.|[^\\()])*\)\s*(?:Tj|'|\"\s*)"
        r"|<[0-9A-Fa-f\s]+>\s*Tj"
        r"|-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+Td"
        r"|-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+TD"
        r"|(?:[0-9.\-]+\s+){5}([0-9.\-]+)\s+Tm"
        r"|T\*"
        r"|ET)"
    )

    for stream in decompressed_streams:
        current_line: List[str] = []
        last_tm_y: Optional[float] = None

        for tok_match in token_pattern.finditer(stream):
            tok = tok_match.group(0).strip()

            if tok == "T*" or tok == "ET":
                if current_line:
                    joined = " ".join(part for part in current_line if part).strip()
                    if joined:
                        lines.append(joined)
                    current_line = []
                continue

            if tok.endswith("Td") or tok.endswith("TD"):
                parts = tok.split()
                if len(parts) >= 3:
                    try:
                        ty = float(parts[1])
                        if abs(ty) > 1.5 and current_line:
                            joined = " ".join(part for part in current_line if part).strip()
                            if joined:
                                lines.append(joined)
                            current_line = []
                    except ValueError:
                        pass
                continue

            if tok.endswith("Tm"):
                parts = tok.split()
                if len(parts) >= 7:
                    try:
                        tm_y = float(parts[5])
                        if last_tm_y is not None and abs(tm_y - last_tm_y) > 2.5 and current_line:
                            joined = " ".join(part for part in current_line if part).strip()
                            if joined:
                                lines.append(joined)
                            current_line = []
                        last_tm_y = tm_y
                    except ValueError:
                        pass
                continue

            if tok.endswith("TJ"):
                arr_body = tok[:-2].strip()[1:-1]
                pieces: List[str] = []
                for sub in re.finditer(r"\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>|-?\d+(?:\.\d+)?", arr_body):
                    item = sub.group(0)
                    if item.startswith("(") and item.endswith(")"):
                        pieces.append(_decode_pdf_literal_string(item[1:-1]))
                    elif item.startswith("<") and item.endswith(">"):
                        pieces.append(_decode_pdf_hex_string(item[1:-1], cmap))
                    else:
                        try:
                            kern = float(item)
                            if kern < -120:
                                pieces.append(" ")
                        except ValueError:
                            pass
                segment = "".join(pieces).strip()
                if segment:
                    current_line.append(segment)
                continue

            if tok.startswith("("):
                end_paren = tok.rfind(")")
                if end_paren > 0:
                    segment = _decode_pdf_literal_string(tok[1:end_paren]).strip()
                    if segment:
                        current_line.append(segment)
                continue

            if tok.startswith("<"):
                end_angle = tok.rfind(">")
                if end_angle > 0:
                    segment = _decode_pdf_hex_string(tok[1:end_angle], cmap).strip()
                    if segment:
                        current_line.append(segment)
                continue

        if current_line:
            joined = " ".join(part for part in current_line if part).strip()
            if joined:
                lines.append(joined)

    if not lines:
        try:
            raw_text = content_bytes.decode("utf-8", errors="ignore")
        except Exception:
            raw_text = content_bytes.decode("latin-1", errors="ignore")
        for ln in raw_text.splitlines():
            clean_ln = ln.strip()
            if (
                clean_ln
                and not clean_ln.startswith(("%PDF", "obj", "endobj", "xref", "trailer"))
                and not clean_ln.startswith(("<x:xmpmeta", "<rdf:", "<?xpacket", "<</"))
                and sum(1 for c in clean_ln if ord(c) < 32 and c not in "\t\n\r") == 0
                and sum(1 for c in clean_ln if ord(c) >= 127) / max(len(clean_ln), 1) < 0.15
            ):
                lines.append(clean_ln)

    return lines

def _parse_pdf_transaction_lines(lines: List[str]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if not lines:
        return rows

    has_balance_column = any("balance" in ln.lower() for ln in lines[:15])

    merged_lines: List[str] = []
    idx = 0
    while idx < len(lines):
        curr = re.sub(r"\s+", " ", lines[idx]).strip()
        if not curr:
            idx += 1
            continue
        has_date = bool(DATE_TOKEN_REGEX.search(curr))
        amt_check, _ = _parse_amount_and_direction(curr)
        if has_date and amt_check is None and idx + 1 < len(lines):
            nxt = re.sub(r"\s+", " ", lines[idx + 1]).strip()
            if nxt and not DATE_TOKEN_REGEX.search(nxt):
                curr = f"{curr} {nxt}"
                idx += 2
                merged_lines.append(curr)
                continue
        merged_lines.append(curr)
        idx += 1

    last_seen_date: Optional[str] = None
    last_seen_balance: Optional[Decimal] = None

    for raw_line in merged_lines:
        line = re.sub(r"\s+", " ", raw_line).strip()
        if (
            not line
            or line.startswith(("<x:xmpmeta", "<rdf:", "<?xpacket", "<</", "/CreationDate", "/Producer", "/Author"))
            or sum(1 for c in line if ord(c) < 32 and c not in "\t\n\r") > 0
            or sum(1 for c in line if ord(c) >= 127) / max(len(line), 1) > 0.2
        ):
            continue

        lower_line = line.lower()
        if any(h in lower_line for h in ("opening balance", "brought forward", "b/f", "bfwd", "opening bal")):
            num_match = list(re.finditer(r"\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?", line))
            if num_match:
                init_bal, _ = _parse_amount_and_direction(num_match[-1].group(0))
                if init_bal is not None:
                    last_seen_balance = init_bal
            continue

        if any(
            h in lower_line
            for h in (
                "transaction_date",
                "statement of account",
                "account statement",
                "page 1 of",
                "total income",
                "total expense",
                "carried forward",
                "closing balance",
            )
        ) and not (DATE_TOKEN_REGEX.search(line) and any(c.isdigit() for c in line.split()[-1])):
            continue

        if "|" in line or (line.count(",") >= 3 and DATE_TOKEN_REGEX.search(line)):
            delim = "|" if "|" in line else ","
            parts = [p.strip() for p in line.split(delim) if p.strip()]
            if _detect_header_mapping(parts) is not None:
                continue
            if len(parts) >= 3:
                date_match = DATE_TOKEN_REGEX.search(line)
                date_str = date_match.group(1) if date_match else (last_seen_date or "")
                if date_match:
                    last_seen_date = date_str
                remaining = [p for p in parts if p != date_str]
                tx_type = None
                category = ""
                amount_str = ""
                desc_parts = []
                for p in remaining:
                    p_low = p.lower()
                    dir_hint = _detect_direction_from_text(p)
                    if dir_hint and len(p) <= 15:
                        tx_type = dir_hint
                    elif p_low in KNOWN_CATEGORIES and not category:
                        category = KNOWN_CATEGORIES[p_low][0]
                        if tx_type is None and KNOWN_CATEGORIES[p_low][1]:
                            tx_type = KNOWN_CATEGORIES[p_low][1]
                    else:
                        amt_val, amt_dir = _parse_amount_and_direction(p)
                        if amt_val is not None and abs(amt_val) > Decimal("0.00") and re.search(r"\d", p):
                            if not amount_str:
                                amount_str = str(abs(amt_val))
                                if amt_dir and not tx_type:
                                    tx_type = amt_dir
                        else:
                            desc_parts.append(p)
                if amount_str:
                    rows.append(
                        {
                            "transaction_date": date_str,
                            "type": tx_type or "",
                            "category": category,
                            "description": " - ".join(desc_parts) or category or "PDF Imported Entry",
                            "amount": amount_str,
                        }
                    )
                    continue

        date_match = DATE_TOKEN_REGEX.search(line)
        has_explicit_direction = _detect_direction_from_text(line) is not None

        if not date_match and not has_explicit_direction:
            continue

        if date_match:
            date_str = date_match.group(1)
            last_seen_date = date_str
            rest = DATE_TOKEN_REGEX.sub(" ", line).strip()
        else:
            date_str = last_seen_date or ""
            rest = line

        amount_matches = list(
            re.finditer(
                r"(?:[+\-]\s*)?(?:₹|rs\.?|inr|\$|€|£)?\s*\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?"
                r"|(?:[+\-]\s*)?(?:₹|rs\.?|inr|\$|€|£)?\s*\d+\.\d{1,2}"
                r"|(?:[+\-]\s*)(?:₹|rs\.?|inr|\$|€|£)?\s*\d{2,8}\b"
                r"|(?:₹|rs\.?|inr|\$|€|£)\s*\d+(?:,\d{2,3})*(?:\.\d{1,2})?",
                rest,
                re.IGNORECASE,
            )
        )
        if not amount_matches:
            amount_matches = list(
                re.finditer(
                    r"\b\d{2,8}\b(?=\s*(?:cr\.?|dr\.?|credit|debit|deposit|withdrawal|withdraw|income|expense)?\s*$)",
                    rest,
                    re.IGNORECASE,
                )
            )

        if not amount_matches:
            continue

        parsed_bal: Optional[Decimal] = None
        if len(amount_matches) >= 2:
            chosen_amt_match = amount_matches[-2]
            bal_match = amount_matches[-1]
            text_without_amounts = rest[: chosen_amt_match.start()].strip()
            parsed_bal, _ = _parse_amount_and_direction(bal_match.group(0).strip())
        else:
            chosen_amt_match = amount_matches[-1]
            text_without_amounts = (
                rest[: chosen_amt_match.start()] + " " + rest[chosen_amt_match.end() :]
            ).strip()

        raw_amt_str = chosen_amt_match.group(0).strip()
        parsed_amt, amt_dir = _parse_amount_and_direction(raw_amt_str)
        if parsed_amt is None or abs(parsed_amt) <= Decimal("0.00"):
            continue

        tx_type: Optional[str] = amt_dir or _detect_direction_from_text(rest)

        if tx_type is None and last_seen_balance is not None and parsed_bal is not None:
            delta = parsed_bal - last_seen_balance
            if delta > Decimal("0.00") and abs(delta - abs(parsed_amt)) <= Decimal("0.05"):
                tx_type = "income"
            elif delta < Decimal("0.00") and abs(abs(delta) - abs(parsed_amt)) <= Decimal("0.05"):
                tx_type = "expense"

        if parsed_bal is not None:
            last_seen_balance = parsed_bal

        cleaned_desc = re.sub(
            r"\b(income|expense|expenses|credit|credited|debit|debited|withdrawal|withdraw|withdrawn|deposit|deposited|inflow|outflow|cr\.?|dr\.?|inr|rs\.?)\b",
            " ",
            text_without_amounts,
            flags=re.IGNORECASE,
        )
        cleaned_desc = re.sub(r"\s+", " ", cleaned_desc).strip(" -|:,")

        detected_cat = ""
        for word in cleaned_desc.split():
            w_low = word.lower().strip(",.:;-")
            if w_low in KNOWN_CATEGORIES:
                detected_cat = KNOWN_CATEGORIES[w_low][0]
                if tx_type is None and KNOWN_CATEGORIES[w_low][1]:
                    tx_type = KNOWN_CATEGORIES[w_low][1]
                break

        if tx_type is None:
            inferred_income = any(
                k in (text_without_amounts or rest).lower()
                for k in (
                    "salary",
                    "payroll",
                    "freelance",
                    "consulting",
                    "dividend",
                    "interest",
                    "yield",
                    "refund",
                    "deposit",
                    "credit",
                    "received",
                    "receipt",
                    "inflow",
                    "inward",
                    "bonus",
                    "stipend",
                    "payment from",
                    "reversal",
                    "cashback",
                )
            )
            tx_type = "income" if inferred_income else "expense"

        rows.append(
            {
                "transaction_date": date_str,
                "type": tx_type,
                "category": detected_cat,
                "description": cleaned_desc or detected_cat or "PDF Statement Entry",
                "amount": str(abs(parsed_amt)),
            }
        )

    return rows

def _extract_rows_from_pdf(content_bytes: bytes) -> List[Dict[str, Any]]:
    try:
        import pdfplumber

        with pdfplumber.open(io.BytesIO(content_bytes)) as pdf:
            table_rows = _extract_rows_via_pdfplumber_tables(pdf)
            if table_rows:
                return table_rows
            word_rows = _extract_rows_via_pdfplumber_words(pdf)
            if word_rows:
                return word_rows
    except Exception:
        pass

    pdf_lines = _extract_text_lines_from_pdf(content_bytes)
    return _parse_pdf_transaction_lines(pdf_lines)

def _extract_rows_from_csv(text: str) -> List[Dict[str, Any]]:
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return []

    sample = "\n".join(lines[:20])
    delimiter = ","
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        delimiter = dialect.delimiter
    except Exception:
        for cand in (",", ";", "\t", "|"):
            if sample.count(cand) > sample.count(delimiter):
                delimiter = cand

    all_rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    if not all_rows:
        return []

    header_idx: Optional[int] = None
    header_map: Optional[Dict[int, str]] = None
    for idx, row in enumerate(all_rows[:30]):
        detected = _detect_header_mapping(row)
        if detected is not None:
            header_idx = idx
            header_map = detected
            break

    if header_idx is not None and header_map is not None:
        extracted: List[Dict[str, Any]] = []
        raw_headers = all_rows[header_idx]
        for data_row in all_rows[header_idx + 1 :]:
            if not any(str(c or "").strip() for c in data_row):
                continue
            mapped_item = _extract_dict_from_mapped_cells(data_row, header_map)
            if mapped_item:
                extracted.append(mapped_item)
            else:
                row_dict = {
                    str(raw_headers[i]).strip(): data_row[i]
                    for i in range(min(len(raw_headers), len(data_row)))
                    if str(raw_headers[i] or "").strip()
                }
                if row_dict:
                    extracted.append(row_dict)
        return extracted

    dict_rows = [dict(r) for r in csv.DictReader(io.StringIO(text), delimiter=delimiter) if r]
    if dict_rows:
        return dict_rows
    return _parse_pdf_transaction_lines(lines)

def _extract_rows_from_file(filename: str, content_bytes: bytes) -> List[Dict[str, Any]]:
    lower_name = (filename or "").lower()

    if lower_name.endswith(".pdf") or content_bytes.startswith(b"%PDF"):
        return _extract_rows_from_pdf(content_bytes)

    text = content_bytes.decode("utf-8-sig", errors="replace").strip()
    if not text:
        return []

    if lower_name.endswith(".json") or text.startswith("[") or text.startswith("{"):
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [r for r in parsed if isinstance(r, dict)]
        if isinstance(parsed, dict):
            for key in ("transactions", "items", "data", "records"):
                if isinstance(parsed.get(key), list):
                    return [r for r in parsed[key] if isinstance(r, dict)]
            return [parsed]
        return []

    return _extract_rows_from_csv(text)

def import_transactions_from_files(
    db: Session,
    user_id: int,
    file_payloads: List[Tuple[str, bytes]],
) -> TransactionImportResponse:
    existing_categories = (
        db.query(Category)
        .filter(or_(Category.is_system == True, Category.user_id == user_id))
        .all()
    )
    cat_lookup: Dict[Tuple[str, str], Category] = {}
    for cat in existing_categories:
        cat_lookup[(cat.type.lower(), cat.name.strip().lower())] = cat

    default_book = get_or_create_default_user_book(db, user_id)

    total_imported = 0
    total_skipped = 0
    total_income = Decimal("0.00")
    total_expense = Decimal("0.00")
    categories_created: List[str] = []
    file_summaries: List[FileImportSummary] = []
    all_errors: List[str] = []

    for filename, content_bytes in file_payloads:
        file_imported = 0
        file_skipped = 0
        file_income = Decimal("0.00")
        file_expense = Decimal("0.00")
        file_errors: List[str] = []
        lower_name = (filename or "").lower()
        file_type = (
            "pdf"
            if (lower_name.endswith(".pdf") or content_bytes.startswith(b"%PDF"))
            else ("json" if lower_name.endswith(".json") else "csv")
        )

        try:
            rows = _extract_rows_from_file(filename, content_bytes)
        except Exception as exc:
            err_msg = f"{filename}: Failed to parse {file_type.upper()} file ({str(exc)})"
            file_errors.append(err_msg)
            all_errors.append(err_msg)
            file_summaries.append(
                FileImportSummary(
                    filename=filename,
                    file_type=file_type,
                    imported_count=0,
                    skipped_count=1,
                    errors=file_errors,
                )
            )
            total_skipped += 1
            continue

        if not rows:
            err_msg = f"{filename}: No valid transaction records detected in {file_type.upper()} file."
            file_errors.append(err_msg)
            all_errors.append(err_msg)
            file_summaries.append(
                FileImportSummary(
                    filename=filename,
                    file_type=file_type,
                    imported_count=0,
                    skipped_count=0,
                    errors=file_errors,
                )
            )
            continue

        for row_idx, raw_row in enumerate(rows, start=1):
            if not isinstance(raw_row, dict):
                continue
            if not any(str(v or "").strip() for v in raw_row.values()):
                continue

            try:
                date_raw = None
                desc_candidates: List[str] = []
                cat_raw = None
                type_hint: Optional[str] = None
                credit_amt: Optional[Decimal] = None
                debit_amt: Optional[Decimal] = None
                main_amt: Optional[Decimal] = None
                inline_dir: Optional[str] = None

                for k, v in raw_row.items():
                    if k is None or v is None or not str(v).strip():
                        continue
                    v_str = str(v).strip()
                    role = _classify_column_header(k)

                    if role in {"balance", "reference"}:
                        continue
                    elif role == "date" and date_raw is None:
                        date_raw = v_str
                    elif role == "category" and cat_raw is None:
                        cat_raw = v_str
                    elif role == "type":
                        detected = _detect_direction_from_text(v_str)
                        if detected:
                            type_hint = detected
                    elif role == "credit":
                        amt, _ = _parse_amount_and_direction(v_str)
                        if amt is not None and abs(amt) > Decimal("0.00"):
                            credit_amt = abs(amt)
                    elif role == "debit":
                        amt, _ = _parse_amount_and_direction(v_str)
                        if amt is not None and abs(amt) > Decimal("0.00"):
                            debit_amt = abs(amt)
                    elif role == "amount":
                        amt, d_hint = _parse_amount_and_direction(v_str)
                        if amt is not None and abs(amt) > Decimal("0.00"):
                            main_amt = amt
                            if d_hint:
                                inline_dir = d_hint
                    elif role == "description":
                        desc_candidates.append(v_str)
                    else:
                        d_check = _detect_direction_from_text(v_str)
                        if d_check and len(v_str) <= 15 and type_hint is None:
                            type_hint = d_check

                tx_type: Optional[str] = type_hint or inline_dir
                amount_val: Optional[Decimal] = None

                if credit_amt is not None and credit_amt > Decimal("0.00") and (debit_amt is None or debit_amt == Decimal("0.00")):
                    tx_type = "income"
                    amount_val = credit_amt
                elif debit_amt is not None and debit_amt > Decimal("0.00") and (credit_amt is None or credit_amt == Decimal("0.00")):
                    tx_type = "expense"
                    amount_val = debit_amt
                elif main_amt is not None and abs(main_amt) > Decimal("0.00"):
                    if tx_type is None:
                        tx_type = "expense" if main_amt < Decimal("0.00") else None
                    amount_val = abs(main_amt)

                description = " - ".join(desc_candidates).strip()[:500] or None

                if tx_type is None and description:
                    tx_type = _detect_direction_from_text(description)
                if tx_type is None:
                    inferred_inc = any(
                        k in (description or "").lower()
                        for k in (
                            "salary",
                            "payroll",
                            "freelance",
                            "consulting",
                            "dividend",
                            "interest",
                            "yield",
                            "refund",
                            "deposit",
                            "credit",
                            "received",
                            "receipt",
                            "inflow",
                            "inward",
                            "bonus",
                            "stipend",
                            "payment from",
                            "reversal",
                            "cashback",
                        )
                    )
                    tx_type = "income" if inferred_inc else "expense"

                if not tx_type or amount_val is None or amount_val <= Decimal("0.00"):
                    raise ValueError("Missing or invalid positive transaction amount/type")

                cat_name = str(cat_raw or "").strip()
                if not cat_name:
                    cat_name = _infer_category_from_description(description or "", tx_type)

                cat_key = (tx_type, cat_name.lower())
                category_obj = cat_lookup.get(cat_key)
                if not category_obj:
                    category_obj = Category(
                        name=cat_name[:100],
                        type=tx_type,
                        user_id=user_id,
                        is_system=False,
                    )
                    db.add(category_obj)
                    db.flush()
                    cat_lookup[cat_key] = category_obj
                    categories_created.append(f"{category_obj.name} ({tx_type})")

                tx_date = _parse_flexible_date(date_raw)

                db_tx = Transaction(
                    user_id=user_id,
                    book_id=default_book.id,
                    category_id=category_obj.id,
                    type=tx_type,
                    amount=amount_val,
                    description=description,
                    transaction_date=tx_date,
                )
                db.add(db_tx)
                db.flush()

                db.add(
                    StreamEntry(
                        book_id=default_book.id,
                        user_id=user_id,
                        transaction_id=db_tx.id,
                        type="IN" if tx_type == "income" else "OUT",
                        amount=amount_val,
                        remarks=description or category_obj.name,
                        category=category_obj.name,
                        entry_date=tx_date,
                    )
                )

                file_imported += 1
                total_imported += 1
                if tx_type == "income":
                    file_income += amount_val
                    total_income += amount_val
                else:
                    file_expense += amount_val
                    total_expense += amount_val

            except Exception as row_exc:
                file_skipped += 1
                total_skipped += 1
                err_msg = f"{filename} (Row {row_idx}): {str(row_exc)}"
                file_errors.append(err_msg)
                all_errors.append(err_msg)

        file_summaries.append(
            FileImportSummary(
                filename=filename,
                file_type=file_type,
                imported_count=file_imported,
                skipped_count=file_skipped,
                imported_income=file_income,
                imported_expense=file_expense,
                errors=file_errors[:10],
            )
        )

    db.commit()

    num_files = len(file_payloads)
    msg = (
        f"Successfully imported {total_imported} transaction(s) from {num_files} file(s)."
        if total_imported > 0
        else f"Processed {num_files} file(s) with 0 imported transactions."
    )

    return TransactionImportResponse(
        message=msg,
        files_processed=num_files,
        total_files=num_files,
        imported_count=total_imported,
        total_imported=total_imported,
        skipped_count=total_skipped,
        total_skipped=total_skipped,
        imported_income_total=total_income,
        imported_income=total_income,
        imported_expense_total=total_expense,
        imported_expenses=total_expense,
        categories_created=categories_created,
        file_summaries=file_summaries,
        files=file_summaries,
        errors=all_errors[:25],
    )

def export_transactions_csv(
    db: Session,
    user_id: int,
    transaction_type: Optional[str] = None,
    category_id: Optional[int] = None,
    book_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    search: Optional[str] = None,
    sort: str = "date_desc",
) -> str:
    query = (
        db.query(Transaction)
        .options(joinedload(Transaction.category), joinedload(Transaction.book))
        .filter(Transaction.user_id == user_id)
    )
    if transaction_type:
        query = query.filter(Transaction.type == transaction_type)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if book_id:
        query = query.filter(Transaction.book_id == book_id)
    if start_date and end_date and start_date > end_date:
        start_date, end_date = end_date, start_date

    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)
    if end_date:
        if end_date.hour == 0 and end_date.minute == 0 and end_date.second == 0 and end_date.microsecond == 0:
            end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        query = query.filter(Transaction.transaction_date <= end_date)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.outerjoin(Transaction.category).filter(
            or_(
                Transaction.description.ilike(term),
                Category.name.ilike(term),
                cast(Transaction.amount, String).ilike(term),
            )
        )

    if sort == "date_asc":
        query = query.order_by(asc(Transaction.transaction_date), asc(Transaction.id))
    elif sort == "amount_desc":
        query = query.order_by(desc(Transaction.amount), desc(Transaction.id))
    elif sort == "amount_asc":
        query = query.order_by(asc(Transaction.amount), asc(Transaction.id))
    else:
        query = query.order_by(desc(Transaction.transaction_date), desc(Transaction.id))

    txs = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "type", "book", "category", "description", "amount", "transaction_date"])
    for tx in txs:
        writer.writerow(
            [
                tx.id,
                tx.type,
                tx.book.title if tx.book else "Main Ledger",
                tx.category.name if tx.category else "Other",
                tx.description or "",
                f"{Decimal(str(tx.amount)):.2f}",
                tx.transaction_date.isoformat() if tx.transaction_date else "",
            ]
        )
    return output.getvalue()

def get_import_template_csv() -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Description", "Category", "Withdrawal (Debit)", "Deposit (Credit)"])
    writer.writerow(["2026-10-01", "Monthly Salary Credit", "Salary", "", "85000.00"])
    writer.writerow(["2026-10-05", "Grocery & Dining", "Food", "2450.00", ""])
    writer.writerow(["2026-10-08", "Broadband & Electricity Bill", "Bills", "3200.00", ""])
    writer.writerow(["2026-10-10", "Consulting Project Milestone", "Freelance", "", "15000.00"])
    return output.getvalue()

def get_import_template_pdf() -> bytes:
    statement_lines = [
        "FINANCE INTEL - SAMPLE BANK & TRANSACTION STATEMENT (PDF)",
        "Date | Description | Category | Withdrawal (Debit) | Deposit (Credit)",
        "2026-10-01 | Monthly Salary Credit | Salary | - | 85000.00 Cr",
        "2026-10-05 | Swiggy & Grocery Dining | Food | 2450.00 Dr | -",
        "2026-10-08 | Broadband & Electricity Bill | Bills | 3200.00 Dr | -",
        "2026-10-10 | Consulting Project Milestone | Freelance | - | 15000.00 Cr",
    ]

    content_ops = ["BT", "/F1 11 Tf", "50 760 Td", "18 TL"]
    for idx, line in enumerate(statement_lines):
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        if idx == 0:
            content_ops.append(f"({escaped}) Tj")
        else:
            content_ops.append(f"T* ({escaped}) Tj")
    content_ops.append("ET")
    stream_bytes = "\n".join(content_ops).encode("latin-1")

    objects = [
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        f"5 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode("latin-1")
        + stream_bytes
        + b"\nendstream\nendobj\n",
    ]

    pdf_out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf_out))
        pdf_out.extend(obj)

    xref_pos = len(pdf_out)
    pdf_out.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    pdf_out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        pdf_out.extend(f"{off:010d} 00000 n \n".encode("latin-1"))

    pdf_out.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode(
            "latin-1"
        )
    )
    return bytes(pdf_out)
