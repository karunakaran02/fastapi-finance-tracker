import logging
import smtplib
from decimal import Decimal
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings

logger = logging.getLogger("finance_api.email")

def generate_alert_html(
    budget_name: str,
    budget_type: str,
    category_name: Optional[str],
    threshold_amount: Decimal,
    current_amount: Decimal,
    exceeded_by: Decimal,
    recipient_email: str,
    transaction_desc: Optional[str] = None,
    transaction_amount: Optional[Decimal] = None,
    period: str = "monthly",
) -> str:
    is_expense = budget_type == "expense"
    badge_color = "#ef4444" if is_expense else "#10b981"
    badge_bg = "rgba(239, 68, 68, 0.15)" if is_expense else "rgba(16, 185, 129, 0.15)"
    badge_title = "EXPENDITURE LIMIT EXCEEDED" if is_expense else "INCOME THRESHOLD SURPASSED"
    headline = (
        f"Your {period} expense limit has been breached."
        if is_expense
        else f"Congratulations! Your {period} income target has been achieved."
    )
    scope_label = f"Category: {category_name}" if category_name else "Scope: Global Cashflow (All Categories)"

    pct = round((current_amount / threshold_amount) * Decimal("100.0"), 1) if threshold_amount > 0 else Decimal("0.0")

    tx_block = ""
    if transaction_desc or transaction_amount is not None:
        tx_block = f"""
        <div style="margin-top: 24px; padding: 16px; background: #181b22; border: 1px solid #2a2f3d; border-radius: 12px;">
            <p style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; font-weight: 700;">Triggering Transaction</p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; color: #f1f5f9; font-weight: 500;">{transaction_desc or 'Ledger Entry'}</span>
                <span style="font-size: 14px; font-weight: 700; color: {badge_color}; font-family: monospace;">₹{Decimal(str(transaction_amount or 0)):,.2f}</span>
            </div>
        </div>
        """

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{badge_title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0e14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0e14; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 580px; background-color: #11141c; border: 1px solid #1e2433; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="padding: 28px 32px; border-bottom: 1px solid #1e2433; background: linear-gradient(180deg, #161b26 0%, #11141c 100%);">
                            <table width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td>
                                        <div style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">Finance Intel</div>
                                        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Portfolio Intelligence &amp; Threshold Monitoring</div>
                                    </td>
                                    <td align="right">
                                        <span style="display: inline-block; padding: 4px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 9999px; background: {badge_bg}; color: {badge_color}; border: 1px solid {badge_color}33;">
                                            {badge_title}
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 32px;">
                            <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #ffffff;">{budget_name}</h2>
                            <p style="margin: 0 0 24px 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">{headline}</p>

                            <div style="background: #151923; border: 1px solid #22293b; border-radius: 14px; padding: 20px;">
                                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; margin-bottom: 12px;">{scope_label}</div>

                                <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
                                    <tr>
                                        <td style="padding-bottom: 8px;">
                                             <span style="font-size: 12px; color: #94a3b8;">Configured Threshold:</span>
                                        </td>
                                        <td align="right" style="padding-bottom: 8px;">
                                            <span style="font-size: 14px; font-weight: 600; color: #cbd5e1; font-family: monospace;">₹{threshold_amount:,.2f}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding-bottom: 8px;">
                                            <span style="font-size: 12px; color: #94a3b8;">Recorded Volume:</span>
                                        </td>
                                        <td align="right" style="padding-bottom: 8px;">
                                            <span style="font-size: 15px; font-weight: 700; color: {badge_color}; font-family: monospace;">₹{current_amount:,.2f}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="border-top: 1px solid #242c3f; padding-top: 10px;">
                                            <span style="font-size: 12px; font-weight: 700; color: #ffffff;">Over Budget By:</span>
                                        </td>
                                        <td align="right" style="border-top: 1px solid #242c3f; padding-top: 10px;">
                                            <span style="font-size: 16px; font-weight: 800; color: {badge_color}; font-family: monospace;">+₹{exceeded_by:,.2f} ({pct}%)</span>
                                        </td>
                                    </tr>
                                </table>

                                <div style="background: #202637; border-radius: 6px; height: 8px; width: 100%; overflow: hidden;">
                                    <div style="background: {badge_color}; height: 8px; width: 100%; border-radius: 6px;"></div>
                                </div>
                            </div>

                            {tx_block}

                            <div style="margin-top: 32px; text-align: center;">
                                <a href="http://localhost:3000/transactions" style="display: inline-block; padding: 12px 28px; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);">
                                    Inspect Transaction Ledger &rarr;
                                </a>
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 24px 32px; border-top: 1px solid #1e2433; background: #0d1017; font-size: 11px; color: #475569; text-align: center; line-height: 1.5;">
                            This automated financial intelligence notification was dispatched to <strong>{recipient_email}</strong> based on your configured budget parameters.<br>
                            To adjust limits or deactivate alerts, visit your Finance Intel settings.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""

def send_threshold_alert_email(
    recipient_email: str,
    budget_name: str,
    budget_type: str,
    category_name: Optional[str],
    threshold_amount: Decimal,
    current_amount: Decimal,
    exceeded_by: Decimal,
    transaction_desc: Optional[str] = None,
    transaction_amount: Optional[Decimal] = None,
    period: str = "monthly",
) -> tuple[bool, str]:
    is_expense = budget_type == "expense"
    subject = (
        f"⚠️ Alert: {budget_name} limit exceeded (₹{current_amount:,.2f} / ₹{threshold_amount:,.2f})"
        if is_expense
        else f"🎯 Goal: {budget_name} target achieved (₹{current_amount:,.2f} / ₹{threshold_amount:,.2f})"
    )

    html_content = generate_alert_html(
        budget_name=budget_name,
        budget_type=budget_type,
        category_name=category_name,
        threshold_amount=threshold_amount,
        current_amount=current_amount,
        exceeded_by=exceeded_by,
        recipient_email=recipient_email,
        transaction_desc=transaction_desc,
        transaction_amount=transaction_amount,
        period=period,
    )

    plain_text = (
        f"Finance Intel Alert\n\n"
        f"Budget: {budget_name}\n"
        f"Type: {budget_type.upper()}\n"
        f"Category: {category_name or 'Global'}\n"
        f"Configured Threshold: ₹{threshold_amount:,.2f}\n"
        f"Current Volume: ₹{current_amount:,.2f}\n"
        f"Exceeded By: ₹{exceeded_by:,.2f}\n\n"
        f"View your ledger: http://localhost:3000/transactions\n"
    )

    smtp_host = settings.clean_smtp_host
    smtp_user = settings.clean_smtp_user
    smtp_pass = settings.clean_smtp_password
    from_email = settings.clean_emails_from_email

    if smtp_host:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{settings.EMAILS_FROM_NAME} <{from_email}>"
            msg["To"] = recipient_email

            msg.attach(MIMEText(plain_text, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            if settings.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(smtp_host, settings.SMTP_PORT, timeout=12)
            else:
                server = smtplib.SMTP(smtp_host, settings.SMTP_PORT, timeout=12)
                if settings.SMTP_TLS:
                    server.starttls()

            with server:
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.send_message(msg)

            logger.info("Successfully sent threshold alert email via SMTP to %s (Relay: %s:%s)", recipient_email, smtp_host, settings.SMTP_PORT)
            return True, f"Sent via SMTP ({smtp_host})"
        except Exception as exc:
            err_msg = str(exc)
            logger.error("Failed to send alert email via SMTP to %s via %s: %s", recipient_email, smtp_host, exc)
            return False, f"SMTP Delivery Failed: {err_msg[:120]}"

    logger.info("Mock SMTP mode: alert email recorded in audit log for %s (Budget: %s)", recipient_email, budget_name)
    return True, "Mock Mode (SMTP_HOST not set)"

def generate_verification_code_html(code: str, recipient_email: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0e14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0e14; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 520px; background-color: #11141c; border: 1px solid #1e2433; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="padding: 28px 32px; border-bottom: 1px solid #1e2433; background: linear-gradient(180deg, #161b26 0%, #11141c 100%);">
                            <div style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">Finance Intel</div>
                            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Identity Verification &amp; Account Security</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px;">
                            <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Confirm Your Email Address</h2>
                            <p style="margin: 0 0 24px 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                                Thank you for creating an account. Enter the single-use 6-digit security code below in your registration screen to activate your account:
                            </p>
                            <div style="text-align: center; margin: 28px 0; padding: 20px; background: #0c0f17; border: 1px solid #1e2538; border-radius: 12px;">
                                <div style="font-family: 'JetBrains Mono', 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 0.35em; color: #00f5d4; text-shadow: 0 0 16px rgba(0, 245, 212, 0.4);">
                                    {code}
                                </div>
                            </div>
                            <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                                This verification code will expire in <strong>10 minutes</strong>. If you did not attempt to register on Finance Intel, you can safely disregard this message.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 32px; background-color: #0c0f17; border-top: 1px solid #1a202c; text-align: center; font-size: 11px; color: #475569;">
                            Finance Intel Automated Identity System &bull; Dispatched to {recipient_email}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""

def send_verification_email(recipient_email: str, code: str) -> tuple[bool, str]:
    subject = f"Your Finance Intel Verification Code: {code}"
    html_content = generate_verification_code_html(code=code, recipient_email=recipient_email)
    plain_text = (
        f"Finance Intel Verification Code\n\n"
        f"Your verification code is: {code}\n\n"
        f"Enter this 6-digit code in the registration screen to confirm your email and activate your account.\n"
        f"This code will expire in 10 minutes.\n\n"
        f"If you did not request this, please disregard this email."
    )

    smtp_host = settings.clean_smtp_host
    smtp_user = settings.clean_smtp_user
    smtp_pass = settings.clean_smtp_password
    from_email = settings.clean_emails_from_email

    if smtp_host:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{settings.EMAILS_FROM_NAME} <{from_email}>"
            msg["To"] = recipient_email

            msg.attach(MIMEText(plain_text, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            if settings.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(smtp_host, settings.SMTP_PORT, timeout=12)
            else:
                server = smtplib.SMTP(smtp_host, settings.SMTP_PORT, timeout=12)
                if settings.SMTP_TLS:
                    server.starttls()

            with server:
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.send_message(msg)

            logger.info("Successfully sent verification email to %s via SMTP (%s)", recipient_email, smtp_host)
            return True, f"Sent via SMTP ({smtp_host})"
        except Exception as exc:
            err_msg = str(exc)
            logger.error("Failed to send verification email via SMTP to %s: %s", recipient_email, exc)
            return False, f"SMTP Delivery Failed: {err_msg[:120]}"

    logger.info("Mock SMTP mode: verification code %s generated for %s", code, recipient_email)
    return True, "Mock Mode (SMTP_HOST not set)"
