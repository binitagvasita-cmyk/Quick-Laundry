"""
============================================
EMAIL SENDER UTILITY - FIXED RESET LINK
Send OTP and notification emails via SMTP
============================================
"""

from config import get_config
import os
config = get_config()


class EmailSender:
    """Email sending utilities"""
    
    @staticmethod
    def send_email(to_email, subject, html_body, text_body=None):
        try:
            import requests as req
            resend_api_key = os.getenv('RESEND_API_KEY', '')
            email_from = config.EMAIL_FROM

            response = req.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": email_from,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_body
                },
                timeout=10
            )

            if response.status_code in (200, 201):
                print(f"✅ Email sent to {to_email}: {subject}")
                return True
            else:
                print(f"❌ Email send error: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print(f"❌ Email send error: {e}")
            return False
    
    @staticmethod
    def send_otp_email(to_email, otp_code, user_name):
        """
        Send OTP verification email
        
        Args:
            to_email (str): Recipient email
            otp_code (str): OTP code
            user_name (str): User's full name
            
        Returns:
            bool: Success status
        """
        subject = f"Your {config.APP_NAME} Verification Code"
        
        # HTML email template
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                }}
                .header {{
                    background-color: #4F46E5;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px 5px 0 0;
                }}
                .content {{
                    background-color: white;
                    padding: 30px;
                    border-radius: 0 0 5px 5px;
                }}
                .otp-code {{
                    font-size: 32px;
                    font-weight: bold;
                    color: #4F46E5;
                    text-align: center;
                    padding: 20px;
                    background-color: #f0f0f0;
                    border-radius: 5px;
                    letter-spacing: 5px;
                    margin: 20px 0;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 20px;
                    color: #666;
                    font-size: 12px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{config.APP_NAME}</h1>
                </div>
                <div class="content">
                    <h2>Hello {user_name}!</h2>
                    <p>Welcome to {config.APP_NAME}. Please use the following verification code to complete your registration:</p>
                    
                    <div class="otp-code">{otp_code}</div>
                    
                    <p><strong>This code will expire in {config.OTP_EXPIRY_MINUTES} minutes.</strong></p>
                    
                    <p>If you didn't request this code, please ignore this email.</p>
                    
                    <p>Best regards,<br>The {config.APP_NAME} Team</p>
                </div>
                <div class="footer">
                    <p>&copy; 2024 {config.APP_NAME}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text fallback
        text_body = f"""
        Hello {user_name}!
        
        Welcome to {config.APP_NAME}.
        
        Your verification code is: {otp_code}
        
        This code will expire in {config.OTP_EXPIRY_MINUTES} minutes.
        
        If you didn't request this code, please ignore this email.
        
        Best regards,
        The {config.APP_NAME} Team
        """
        
        return EmailSender.send_email(to_email, subject, html_body, text_body)
    
    @staticmethod
    def send_password_reset_email(to_email, reset_token, user_name):
        """
        Send password reset email
        
        Args:
            to_email (str): Recipient email
            reset_token (str): Password reset token
            user_name (str): User's full name
            
        Returns:
            bool: Success status
        """
        subject = f"{config.APP_NAME} - Password Reset Request"
        
        # 🔥 FIX: Build reset link based on where frontend is actually running
        # Try multiple possible frontend URLs
        frontend_url = config.FRONTEND_URL
        
        # Remove trailing slash if exists
        if frontend_url.endswith('/'):
            frontend_url = frontend_url[:-1]
        
        # 🔥 CRITICAL FIX: Always use /reset-password.html (relative to frontend root)
        reset_link = f"{frontend_url}/reset-password.html?token={reset_token}"
        
        print(f"📧 Sending password reset email to: {to_email}")
        print(f"🔗 Reset link: {reset_link}")
        print(f"🌐 Frontend URL from config: {config.FRONTEND_URL}")
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                }}
                .header {{
                    background-color: #4F46E5;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px 5px 0 0;
                }}
                .content {{
                    background-color: white;
                    padding: 30px;
                    border-radius: 0 0 5px 5px;
                }}
                .button {{
                    display: inline-block;
                    padding: 15px 30px;
                    background-color: #10b981;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: bold;
                    margin: 20px 0;
                    text-align: center;
                }}
                .button:hover {{
                    background-color: #059669;
                }}
                .warning {{
                    background-color: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 5px;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 20px;
                    color: #666;
                    font-size: 12px;
                }}
                .link-text {{
                    color: #4F46E5;
                    word-break: break-all;
                    font-size: 12px;
                    display: block;
                    margin-top: 15px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{config.APP_NAME}</h1>
                    <p style="margin: 0; font-size: 18px;">Password Reset Request</p>
                </div>
                <div class="content">
                    <h2>Hello {user_name},</h2>
                    
                    <p>You requested to reset your password. Click the button below to reset it:</p>
                    
                    <div style="text-align: center;">
                        <a href="{reset_link}" class="button">Reset Password</a>
                    </div>
                    
                    <div class="warning">
                        <strong>⏱️ Important:</strong> This link will expire in <strong>24 hours</strong>.
                    </div>
                    
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <span class="link-text">{reset_link}</span>
                    
                    <p style="margin-top: 30px;">If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
                    
                    <p>Best regards,<br>The {config.APP_NAME} Team</p>
                </div>
                <div class="footer">
                    <p>&copy; 2024 {config.APP_NAME}. All rights reserved.</p>
                    <p>This is an automated email. Please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
        Password Reset Request
        
        Hello {user_name},
        
        You requested to reset your password. 
        Use this link to reset it: {reset_link}
        
        ⏱️ This link will expire in 24 hours.
        
        If you didn't request this, please ignore this email.
        
        Best regards,
        The {config.APP_NAME} Team
        """
        
        return EmailSender.send_email(to_email, subject, html_body, text_body)


# ============================================
# CONVENIENCE FUNCTIONS
# ============================================

def send_otp_email(to_email, otp_code, user_name):
    """Convenience function to send OTP email"""
    return EmailSender.send_otp_email(to_email, otp_code, user_name)


def send_password_reset_email(to_email, reset_token, user_name):
    """Convenience function to send password reset email"""
    return EmailSender.send_password_reset_email(to_email, reset_token, user_name)


# ============================================
# TEST EMAIL SENDER
# ============================================

if __name__ == "__main__":
    print("=" * 50)
    print("EMAIL SENDER TEST")
    print("=" * 50)
    
    # Test password reset email
    print("\n🔐 Testing password reset email:")
    test_email = "test@example.com"
    test_token = "test_token_12345"
    test_name = "Test User"
    
    success = send_password_reset_email(test_email, test_token, test_name)
    
    if success:
        print("✅ Password reset email sent successfully!")
    else:
        print("❌ Failed to send password reset email")
        print("⚠️ Make sure SMTP credentials are configured in .env")
    
    print("\n" + "=" * 50)
    print("✅ Email sender test completed!")