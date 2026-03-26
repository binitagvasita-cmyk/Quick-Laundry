"""
============================================
EMAIL SENDER - BREVO HTTP API
Uses Brevo (Sendinblue) HTTP API via requests
Works on Railway (no SMTP port blocking)
============================================
"""

import requests
import os


# ─── Config ───────────────────────────────────────────────────────────────────
BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"

def _get_cfg():
    """Lazy-import config so this module loads even before Flask starts."""
    from config import get_config
    return get_config()


# ─── Low-level sender ─────────────────────────────────────────────────────────
def _send(to_email: str, subject: str, html_body: str, text_body: str = None) -> bool:
    """
    Send an email via the Brevo HTTP API.
    Returns True on success, False on any failure.
    """
    api_key   = os.getenv("BREVO_API_KEY", "")
    cfg       = _get_cfg()
    from_email = cfg.EMAIL_FROM
    from_name  = cfg.APP_NAME

    if not api_key:
        print("❌ BREVO_API_KEY is not set — cannot send email")
        return False

    if not from_email:
        print("❌ EMAIL_FROM is not set in config — cannot send email")
        return False

    payload = {
        "sender":      {"name": from_name, "email": from_email},
        "to":          [{"email": to_email}],
        "subject":     subject,
        "htmlContent": html_body,
    }
    if text_body:
        payload["textContent"] = text_body

    headers = {
        "accept":       "application/json",
        "content-type": "application/json",
        "api-key":      api_key,
    }

    try:
        print(f"📤 Sending email via Brevo → {to_email} | Subject: {subject}")
        resp = requests.post(BREVO_API_URL, json=payload, headers=headers, timeout=10)

        if resp.status_code in (200, 201):
            print(f"✅ Email sent to {to_email} | messageId: {resp.json().get('messageId', 'N/A')}")
            return True

        print(f"❌ Brevo API error {resp.status_code}: {resp.text}")
        return False

    except Exception as exc:
        print(f"❌ Email send exception: {exc}")
        return False


# ─── OTP email ────────────────────────────────────────────────────────────────
def send_otp_email(to_email: str, otp_code: str, user_name: str) -> bool:
    """Send an OTP verification email."""
    cfg = _get_cfg()
    subject = f"Your {cfg.APP_NAME} Verification Code"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f3ff; }}
        .wrap {{ max-width: 600px; margin: 30px auto; background: #fff;
                 border-radius: 16px; overflow: hidden;
                 box-shadow: 0 8px 32px rgba(107,70,193,.15); }}
        .hdr  {{ background: linear-gradient(135deg,#6b46c1,#9333ea);
                 padding: 36px 24px; text-align: center; color: #fff; }}
        .hdr h1 {{ margin: 0; font-size: 26px; font-weight: 900; }}
        .hdr p  {{ margin: 6px 0 0; font-size: 13px; opacity: .85; }}
        .body {{ padding: 36px 32px; }}
        .otp-box {{ background: #f5f3ff; border-left: 4px solid #6b46c1;
                    border-radius: 10px; padding: 28px; margin: 28px 0;
                    text-align: center; }}
        .otp-code {{ font-size: 48px; font-weight: 900; color: #6b46c1;
                     letter-spacing: 10px; font-family: 'Courier New', monospace; }}
        .expiry {{ font-size: 13px; color: #e74c3c; font-weight: 700; margin-top: 12px; }}
        .note  {{ background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px;
                  padding: 14px; font-size: 13px; color: #856404; margin: 20px 0; }}
        .ftr  {{ background: #f5f3ff; padding: 18px 24px; text-align: center;
                 font-size: 12px; color: #9ca3af; border-top: 1px solid #ede9fe; }}
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="hdr">
          <h1>🧺 {cfg.APP_NAME}</h1>
          <p>Email Verification</p>
        </div>
        <div class="body">
          <h2 style="margin:0 0 8px;color:#1f2937;">Hello {user_name}! 👋</h2>
          <p style="color:#6b7280;line-height:1.7;">
            Thank you for registering with {cfg.APP_NAME}.<br/>
            Use the code below to verify your email address:
          </p>
          <div class="otp-box">
            <p style="margin:0;color:#6b7280;font-size:13px;font-weight:600;">
              Your Verification Code
            </p>
            <div class="otp-code">{otp_code}</div>
            <div class="expiry">⏱️ Expires in {cfg.OTP_EXPIRY_MINUTES} minutes</div>
          </div>
          <div class="note">
            🔒 <strong>Security notice:</strong> Never share this code with anyone.
            {cfg.APP_NAME} staff will never ask you for this code.
          </div>
          <p style="font-size:13px;color:#9ca3af;">
            If you didn't request this code, simply ignore this email.
          </p>
        </div>
        <div class="ftr">
          <p>&copy; 2025 {cfg.APP_NAME}. All rights reserved.</p>
          <p>This is an automated email — please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
    """

    text_body = (
        f"Hello {user_name},\n\n"
        f"Your {cfg.APP_NAME} verification code is: {otp_code}\n\n"
        f"This code expires in {cfg.OTP_EXPIRY_MINUTES} minutes.\n\n"
        f"If you didn't request this, please ignore this email.\n\n"
        f"— The {cfg.APP_NAME} Team"
    )

    return _send(to_email, subject, html_body, text_body)


# ─── Password-reset email ─────────────────────────────────────────────────────
def send_password_reset_email(to_email: str, reset_token: str, user_name: str) -> bool:
    """Send a password-reset link email."""
    cfg = _get_cfg()
    subject = f"🔐 {cfg.APP_NAME} — Password Reset Request"

    frontend_url = cfg.FRONTEND_URL.rstrip("/")
    reset_link   = f"{frontend_url}/reset-password.html?token={reset_token}"
    print(f"🔗 Password reset link: {reset_link}")

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f3ff; }}
        .wrap {{ max-width: 600px; margin: 30px auto; background: #fff;
                 border-radius: 16px; overflow: hidden;
                 box-shadow: 0 8px 32px rgba(107,70,193,.15); }}
        .hdr  {{ background: linear-gradient(135deg,#6b46c1,#9333ea);
                 padding: 36px 24px; text-align: center; color: #fff; }}
        .hdr h1 {{ margin: 0; font-size: 26px; font-weight: 900; }}
        .body {{ padding: 36px 32px; }}
        .btn  {{ display: inline-block; background: linear-gradient(135deg,#6b46c1,#9333ea);
                 color: #fff; padding: 14px 40px; border-radius: 8px; text-decoration: none;
                 font-weight: 700; font-size: 16px; margin: 24px 0; }}
        .link-box {{ background: #f5f3ff; border-radius: 8px; padding: 14px;
                     font-family: monospace; font-size: 12px; color: #6b7280;
                     word-break: break-all; margin: 16px 0; }}
        .warn {{ background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px;
                 padding: 14px; font-size: 13px; color: #856404; margin: 20px 0; }}
        .ftr  {{ background: #f5f3ff; padding: 18px 24px; text-align: center;
                 font-size: 12px; color: #9ca3af; border-top: 1px solid #ede9fe; }}
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="hdr"><h1>🔐 Password Reset</h1></div>
        <div class="body">
          <h2 style="margin:0 0 8px;color:#1f2937;">Hello {user_name},</h2>
          <p style="color:#6b7280;line-height:1.7;">
            We received a request to reset your {cfg.APP_NAME} password.
            Click the button below to set a new one:
          </p>
          <div style="text-align:center;">
            <a href="{reset_link}" class="btn">Reset My Password</a>
          </div>
          <p style="text-align:center;font-size:13px;color:#9ca3af;">
            Or copy and paste this link into your browser:
          </p>
          <div class="link-box">{reset_link}</div>
          <div class="warn">
            ⏱️ <strong>This link expires in 24 hours.</strong>
            After that you'll need to request a new one.
          </div>
          <p style="font-size:13px;color:#9ca3af;">
            If you didn't request a password reset, please ignore this email —
            your password will remain unchanged.
          </p>
        </div>
        <div class="ftr">
          <p>&copy; 2025 {cfg.APP_NAME}. All rights reserved.</p>
          <p>This is an automated email — please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
    """

    text_body = (
        f"Hello {user_name},\n\n"
        f"Reset your {cfg.APP_NAME} password here:\n{reset_link}\n\n"
        f"This link expires in 24 hours.\n\n"
        f"If you didn't request this, ignore this email.\n\n"
        f"— The {cfg.APP_NAME} Team"
    )

    return _send(to_email, subject, html_body, text_body)