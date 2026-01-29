"""
Email service for sending verification emails.
Supports SMTP (Gmail, etc.) via environment variables.
"""

import os
import secrets
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aiosmtplib

# Email configuration from environment variables
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")  # Use App Password for Gmail
FROM_EMAIL = os.environ.get("FROM_EMAIL", SMTP_USER)
FROM_NAME = os.environ.get("FROM_NAME", "Spot the Artist")

# App URL for verification links
APP_URL = os.environ.get("APP_URL", "http://localhost:5173")

# Token expiration (24 hours)
VERIFICATION_TOKEN_EXPIRY_HOURS = 24


def generate_verification_token() -> tuple[str, datetime]:
    """Generate a secure verification token and expiration time."""
    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(hours=VERIFICATION_TOKEN_EXPIRY_HOURS)
    return token, expires


def create_verification_email(to_email: str, username: str, token: str) -> MIMEMultipart:
    """Create a verification email with HTML content."""
    verification_link = f"{APP_URL}/verify-email?token={token}"
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your Spot the Artist account"
    msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg["To"] = to_email
    
    # Plain text version
    text_content = f"""
Hi {username}!

Welcome to Spot the Artist! Please verify your email address by clicking the link below:

{verification_link}

This link will expire in {VERIFICATION_TOKEN_EXPIRY_HOURS} hours.

If you didn't create an account, you can safely ignore this email.

Happy art hunting!
The Spot the Artist Team
"""
    
    # HTML version
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <tr>
            <td style="background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="text-align: center; padding-bottom: 30px;">
                            <h1 style="margin: 0; font-size: 28px; color: #1a1a1a;">✨ Welcome to Spot the Artist!</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 20px;">
                            <p style="margin: 0; font-size: 16px; color: #333; line-height: 1.6;">
                                Hi <strong>{username}</strong>!
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 30px;">
                            <p style="margin: 0; font-size: 16px; color: #333; line-height: 1.6;">
                                Thanks for signing up! Please verify your email address to start discovering Anna Laurini's amazing street art.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="text-align: center; padding-bottom: 30px;">
                            <a href="{verification_link}" 
                               style="display: inline-block; background-color: #e53935; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                Verify My Email
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 20px;">
                            <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.6;">
                                Or copy and paste this link into your browser:
                            </p>
                            <p style="margin: 10px 0 0; font-size: 14px; color: #e53935; word-break: break-all;">
                                {verification_link}
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="border-top: 1px solid #eee; padding-top: 20px;">
                            <p style="margin: 0; font-size: 13px; color: #999; line-height: 1.6;">
                                This link will expire in {VERIFICATION_TOKEN_EXPIRY_HOURS} hours. If you didn't create an account, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td style="text-align: center; padding-top: 20px;">
                <p style="margin: 0; font-size: 13px; color: #999;">
                    Made with ❤️ for street art lovers
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
"""
    
    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))
    
    return msg


async def send_verification_email(to_email: str, username: str, token: str) -> bool:
    """
    Send a verification email to the user.
    Returns True if sent successfully, False otherwise.
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        print("⚠️  Email not configured - SMTP_USER and SMTP_PASSWORD required")
        print(f"   Would have sent verification email to: {to_email}")
        print(f"   Token: {token}")
        return False
    
    try:
        msg = create_verification_email(to_email, username, token)
        
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            start_tls=True,
        )
        
        print(f"✅ Verification email sent to: {to_email}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False


def is_email_configured() -> bool:
    """Check if email sending is properly configured."""
    return bool(SMTP_USER and SMTP_PASSWORD)
