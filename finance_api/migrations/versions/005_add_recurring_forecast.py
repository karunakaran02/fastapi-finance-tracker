from alembic import op
import sqlalchemy as sa

revision = '005_add_recurring_forecast'
down_revision = '004_link_tx_to_stream_books'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'recurring_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('book_id', sa.Integer(), sa.ForeignKey('stream_books.id', ondelete='SET NULL'), nullable=True),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.String(length=20), server_default='EXPENSE', nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('frequency', sa.String(length=20), server_default='MONTHLY', nullable=False),
        sa.Column('next_due_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='ACTIVE', nullable=False),
        sa.Column('auto_log', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_recurring_items_id'), 'recurring_items', ['id'], unique=False)
    op.create_index(op.f('ix_recurring_items_user_id'), 'recurring_items', ['user_id'], unique=False)
    op.create_index(op.f('ix_recurring_items_book_id'), 'recurring_items', ['book_id'], unique=False)
    op.create_index(op.f('ix_recurring_items_category_id'), 'recurring_items', ['category_id'], unique=False)
    op.create_index(op.f('ix_recurring_items_next_due_date'), 'recurring_items', ['next_due_date'], unique=False)
    op.create_index(op.f('ix_recurring_items_status'), 'recurring_items', ['status'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_recurring_items_status'), table_name='recurring_items')
    op.drop_index(op.f('ix_recurring_items_next_due_date'), table_name='recurring_items')
    op.drop_index(op.f('ix_recurring_items_category_id'), table_name='recurring_items')
    op.drop_index(op.f('ix_recurring_items_book_id'), table_name='recurring_items')
    op.drop_index(op.f('ix_recurring_items_user_id'), table_name='recurring_items')
    op.drop_index(op.f('ix_recurring_items_id'), table_name='recurring_items')
    op.drop_table('recurring_items')
