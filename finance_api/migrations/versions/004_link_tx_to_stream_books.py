from alembic import op
import sqlalchemy as sa

revision = '004_link_tx_to_stream_books'
down_revision = '003_add_streams_module'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('transactions', sa.Column('book_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_transactions_book_id',
        'transactions',
        'stream_books',
        ['book_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_index(op.f('ix_transactions_book_id'), 'transactions', ['book_id'], unique=False)

    op.add_column('stream_entries', sa.Column('transaction_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_stream_entries_transaction_id',
        'stream_entries',
        'transactions',
        ['transaction_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_index(
        op.f('ix_stream_entries_transaction_id'),
        'stream_entries',
        ['transaction_id'],
        unique=False,
    )

    conn = op.get_bind()
    conn.execute(sa.text("""
        INSERT INTO stream_books (user_id, title, description, color, icon, created_at, updated_at)
        SELECT DISTINCT u.id, 'Main Ledger', 'Primary financial stream ledger', '#3b82f6', 'menu_book', now(), now()
        FROM users u
        WHERE NOT EXISTS (SELECT 1 FROM stream_books b WHERE b.user_id = u.id);
    """))

    conn.execute(sa.text("""
        UPDATE transactions t
        SET book_id = (
            SELECT b.id FROM stream_books b
            WHERE b.user_id = t.user_id
            ORDER BY b.id ASC
            LIMIT 1
        )
        WHERE t.book_id IS NULL;
    """))

    conn.execute(sa.text("""
        INSERT INTO stream_entries (book_id, user_id, transaction_id, type, amount, remarks, category, entry_date, created_at, updated_at)
        SELECT
            t.book_id,
            t.user_id,
            t.id,
            CASE WHEN t.type = 'income' THEN 'IN' ELSE 'OUT' END,
            t.amount,
            COALESCE(t.description, c.name, 'Transaction'),
            COALESCE(c.name, 'General'),
            t.transaction_date,
            t.created_at,
            t.updated_at
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE NOT EXISTS (
            SELECT 1 FROM stream_entries se WHERE se.transaction_id = t.id
        );
    """))

    op.alter_column('transactions', 'book_id', nullable=False)

def downgrade() -> None:
    op.drop_constraint('fk_stream_entries_transaction_id', 'stream_entries', type_='foreignkey')
    op.drop_index(op.f('ix_stream_entries_transaction_id'), table_name='stream_entries')
    op.drop_column('stream_entries', 'transaction_id')

    op.drop_constraint('fk_transactions_book_id', 'transactions', type_='foreignkey')
    op.drop_index(op.f('ix_transactions_book_id'), table_name='transactions')
    op.drop_column('transactions', 'book_id')
