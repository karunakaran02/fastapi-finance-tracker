from alembic import op
import sqlalchemy as sa

revision = '003_add_streams_module'
down_revision = '002_add_budgets_and_alerts'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'stream_books',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=120), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('color', sa.String(length=20), server_default='#3b82f6', nullable=True),
        sa.Column('icon', sa.String(length=50), server_default='book', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stream_books_id'), 'stream_books', ['id'], unique=False)
    op.create_index(op.f('ix_stream_books_user_id'), 'stream_books', ['user_id'], unique=False)

    op.create_table(
        'stream_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('book_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=10), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('remarks', sa.String(length=500), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('entry_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['book_id'], ['stream_books.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stream_entries_id'), 'stream_entries', ['id'], unique=False)
    op.create_index(op.f('ix_stream_entries_book_id'), 'stream_entries', ['book_id'], unique=False)
    op.create_index(op.f('ix_stream_entries_user_id'), 'stream_entries', ['user_id'], unique=False)
    op.create_index(op.f('ix_stream_entries_type'), 'stream_entries', ['type'], unique=False)
    op.create_index(op.f('ix_stream_entries_category'), 'stream_entries', ['category'], unique=False)
    op.create_index(op.f('ix_stream_entries_entry_date'), 'stream_entries', ['entry_date'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_stream_entries_entry_date'), table_name='stream_entries')
    op.drop_index(op.f('ix_stream_entries_category'), table_name='stream_entries')
    op.drop_index(op.f('ix_stream_entries_type'), table_name='stream_entries')
    op.drop_index(op.f('ix_stream_entries_user_id'), table_name='stream_entries')
    op.drop_index(op.f('ix_stream_entries_book_id'), table_name='stream_entries')
    op.drop_index(op.f('ix_stream_entries_id'), table_name='stream_entries')
    op.drop_table('stream_entries')

    op.drop_index(op.f('ix_stream_books_user_id'), table_name='stream_books')
    op.drop_index(op.f('ix_stream_books_id'), table_name='stream_books')
    op.drop_table('stream_books')
