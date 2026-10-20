from alembic import op
import sqlalchemy as sa

revision = '006_add_email_verifications'
down_revision = '005_add_recurring_forecast'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'email_verifications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=10), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('attempts', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_email_verifications_id'), 'email_verifications', ['id'], unique=False)
    op.create_index(op.f('ix_email_verifications_email'), 'email_verifications', ['email'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_email_verifications_email'), table_name='email_verifications')
    op.drop_index(op.f('ix_email_verifications_id'), table_name='email_verifications')
    op.drop_table('email_verifications')

