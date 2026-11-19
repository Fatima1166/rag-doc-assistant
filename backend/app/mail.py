"""Password-reset email delivery, stdlib only (smtplib).

Configured through env: SMTP_HOST, SMTP_PORT (587=STARTTLS, 465=SSL),
SMTP_USER, SMTP_PASS, SMTP_FROM. When SMTP_HOST is empty nothing is sent —
the reset link is logged to the console instead, so local development works
with zero mail accounts (copy the link from the uvicorn log and open it).
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage

log = logging.getLogger("ragdocs.mail")


def _link_body(link: str) -> str:
    return (
        "You asked to reset your RAGDocs password.\n\n"
        "Open this link to choose a new password. It expires in 1 hour\n"
        "and can only be used once:\n\n"
        f"{link}\n\n"
        "If you didn't request this, you can safely ignore this email.\n"
    )


def _verify_body(link: str) -> str:
    return (
        "Welcome to RAGDocs!\n\n"
        "Confirm this is really your email address. The link expires in\n"
        "24 hours:\n\n"
        f"{link}\n\n"
        "If you didn't create this account, you can safely ignore this email.\n"
    )


def _send(to: str, subject: str, body: str) -> bool:
    host = (os.getenv("SMTP_HOST") or "").strip()
    if not host:
        # Dev fallback: no mail account configured — print the body instead.
        log.info("SMTP not configured — email for %s (%s):\n%s", to, subject, body)
        return False
    msg = EmailMessage()
    msg["From"] = os.getenv("SMTP_FROM", "RAGDocs <no-reply@localhost>")
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    port = int(os.getenv("SMTP_PORT", "587"))
    user, pw = os.getenv("SMTP_USER", ""), os.getenv("SMTP_PASS", "")
    try:
        cls = smtplib.SMTP_SSL if port == 465 else smtplib.SMTP
        with cls(host, port, timeout=15) as smtp:
            if port != 465:
                try:
                    smtp.starttls()
                except smtplib.SMTPNotSupportedError:
                    pass  # plain local SMTP (e.g. Mailpit) — no TLS available
            if user:
                smtp.login(user, pw)
            smtp.send_message(msg)
        log.info("Email sent to %s (%s)", to, subject)
        return True
    except Exception as e:
        # Never fail the request over mail — the endpoint already told the
        # user "check your inbox"; a warning here is enough to debug setup.
        log.warning("Failed to send email to %s (%s): %s", to, subject, e)
        return False


def send_reset_email(to: str, link: str) -> bool:
    """Send the reset email. Returns True when it actually went out."""
    return _send(to, "Reset your RAGDocs password", _link_body(link))


def send_verify_email(to: str, link: str) -> bool:
    """Send the address-verification email. True when it actually went out."""
    return _send(to, "Confirm your RAGDocs email", _verify_body(link))
