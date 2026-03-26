"""
============================================
EMAIL SENDER - BREVO HTTP API VERSION
Uses Brevo (Sendinblue) HTTP API via requests library
Works on Railway (no SMTP port blocking)
============================================
"""

import requests
import os
from config import get_config

config = get_config()

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
BREVO_API_KEY = os.getenv('BREVO_API_KEY', '')


class EmailSender:
    """Email sending utilities via Brevo HTTP API"""
    
    @staticmethod
    def send_email(to_email, subject, html_body, text_body=None):
        """
        Send email via Brevo HTTP API
        
        Args:
            to_email (str): Recipient email
            subject (str): Email subject
            html_body (str): HTML email content
            text_body (str): Plain text fallback
            
        Returns:
            bool: Success status
        """
        try:
            # Get API key and sender from config
            api_key = BREVO_API_KEY
            sender_email = config.EMAIL_FROM
            
            if not api_key:
                print("❌ BREVO_API_KEY not configured in .env")
                return False
            
            if not sender_email:
                print("❌ EMAIL_FROM not configured in config")
                return False
            
            # Brevo API payload
            payload = {
                "sender": {
                    "name": config.APP_NAME,
                    "email": sender_email
                },
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": html_body,
            }
            
            # Add plain text if provided
            if text_body:
                payload["textContent"] = text_body
            
            # Brevo API headers
            headers = {
                "accept": "application/json",
                "content-type": "application/json",
                "api-key": api_key
            }
            
            # Make API request
            print(f"📤 Sending email via Brevo API to {to_email}")
            print(f"   From: {sender_email}")
            print(f"   Subject: {subject}")
            
            response = requests.post(
                BREVO_API_URL,
                json=payload,
                headers=headers,
                timeout=10
            )
            
            # Check response
            if response.status_code in (200, 201):
                print(f"✅ Email sent successfully to {to_email}")
                print(f"   Message ID: {response.json().get('messageId', 'N/A')}")
                return True
            else:
                print(f"❌ Brevo API error {response.status_code}: {response.text}")
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
                    font-family: 'Segoe UI', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                }}
                .email-wrapper {{
                    background-color: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 40px 20px;
                    text-align: center;
                }}
                .header h1 {{
                    margin: 0;
                    font-size: 28px;
                    font-weight: 700;
                }}
                .header p {{
                    margin: 8px 0 0;
                    opacity: 0.9;
                    font-size: 14px;
                }}
                .content {{
                    padding: 40px 30px;
                }}
                .content h2 {{
                    color: #333;
                    margin: 0 0 10px;
                    font-size: 20px;
                }}
                .content p {{
                    margin: 0 0 20px;
                    color: #666;
                    line-height: 1.8;
                }}
                .otp-section {{
                    background-color: #f5f5f5;
                    border-left: 4px solid #667eea;
                    padding: 25px;
                    margin: 30px 0;
                    border-radius: 8px;
                    text-align: center;
                }}
                .otp-code {{
                    font-size: 48px;
                    font-weight: 900;
                    color: #667eea;
                    letter-spacing: 8px;
                    margin: 15px 0;
                    font-family: 'Courier New', monospace;
                }}
                .otp-expiry {{
                    font-size: 14px;
                    color: #e74c3c;
                    font-weight: 600;
                    margin-top: 15px;
                }}
                .divider {{
                    border: 0;
                    border-top: 1px solid #eee;
                    margin: 30px 0;
                }}
                .security-note {{
                    background-color: #fff3cd;
                    border: 1px solid #ffc107;
                    padding: 15px;
                    border-radius: 6px;
                    margin: 20px 0;
                    font-size: 13px;
                    color: #856404;
                }}
                .footer {{
                    text-align: center;
                    padding: 20px;
                    background-color: #f9f9f9;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #999;
                }}
                .footer p {{
                    margin: 5px 0;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="email-wrapper">
                    <div class="header">
                        <h1>{config.APP_NAME}</h1>
                        <p>Email Verification</p>
                    </div>
                    
                    <div class="content">
                        <h2>Hello {user_name}! 👋</h2>
                        <p>
                            Thank you for registering with {config.APP_NAME}. 
                            To verify your email address and complete your registration, 
                            please use the verification code below:
                        </p>
                        
                        <div class="otp-section">
                            <p style="margin: 0; color: #666; font-size: 14px; font-weight: 500;">
                                Your Verification Code
                            </p>
                            <div class="otp-code">{otp_code}</div>
                            <div class="otp-expiry">
                                ⏱️ This code expires in {config.OTP_EXPIRY_MINUTES} minutes
                            </div>
                        </div>
                        
                        <div class="security-note">
                            🔒 <strong>Security Notice:</strong> Never share this code with anyone. 
                            {config.APP_NAME} staff will never ask you for this code.
                        </div>
                        
                        <p style="margin-top: 30px; color: #999; font-size: 13px;">
                            If you didn't request this verification code, 
                            please ignore this email. Your account will remain secure.
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p>&copy; 2025 {config.APP_NAME}. All rights reserved.</p>
                        <p>This is an automated email. Please do not reply to this message.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text fallback
        text_body = f"""
        Hello {user_name},
        
        Thank you for registering with {config.APP_NAME}.
        
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
        subject = f"🔐 {config.APP_NAME} - Password Reset Request"
        
        # Build reset link
        frontend_url = config.FRONTEND_URL
        if frontend_url.endswith('/'):
            frontend_url = frontend_url[:-1]
        
        reset_link = f"{frontend_url}/reset-password.html?token={reset_token}"
        
        print(f"🔗 Password reset link: {reset_link}")
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: 'Segoe UI', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                }}
                .email-wrapper {{
                    background-color: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 40px 20px;
                    text-align: center;
                }}
                .header h1 {{
                    margin: 0;
                    font-size: 28px;
                    font-weight: 700;
                }}
                .content {{
                    padding: 40px 30px;
                }}
                .content h2 {{
                    color: #333;
                    margin: 0 0 10px;
                    font-size: 20px;
                }}
                .content p {{
                    margin: 0 0 20px;
                    color: #666;
                    line-height: 1.8;
                }}
                .button-section {{
                    text-align: center;
                    margin: 35px 0;
                }}
                .reset-button {{
                    display: inline-block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 40px;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 16px;
                    transition: transform 0.2s;
                }}
                .reset-button:hover {{
                    transform: scale(1.05);
                }}
                .warning-box {{
                    background-color: #fff3cd;
                    border: 1px solid #ffc107;
                    padding: 15px;
                    border-radius: 6px;
                    margin: 20px 0;
                    font-size: 13px;
                    color: #856404;
                }}
                .link-box {{
                    background-color: #f5f5f5;
                    padding: 15px;
                    border-radius: 6px;
                    margin: 20px 0;
                    word-break: break-all;
                    font-size: 12px;
                    color: #666;
                    font-family: 'Courier New', monospace;
                }}
                .footer {{
                    text-align: center;
                    padding: 20px;
                    background-color: #f9f9f9;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #999;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="email-wrapper">
                    <div class="header">
                        <h1>🔐 Password Reset</h1>
                    </div>
                    
                    <div class="content">
                        <h2>Hello {user_name},</h2>
                        <p>
                            We received a request to reset your password. 
                            Click the button below to create a new password:
                        </p>
                        
                        <div class="button-section">
                            <a href="{reset_link}" class="reset-button">
                                Reset Your Password
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 13px; text-align: center;">
                            Or copy and paste this link in your browser:
                        </p>
                        <div class="link-box">
                            {reset_link}
                        </div>
                        
                        <div class="warning-box">
                            ⏱️ <strong>This link expires in 24 hours.</strong> 
                            If you don't use it by then, you'll need to request a new password reset.
                        </div>
                        
                        <p>
                            <strong>Didn't request a password reset?</strong><br/>
                            If you didn't request this reset, please ignore this email. 
                            Your password will remain unchanged. If you believe your account 
                            has been compromised, please contact our support team immediately.
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p>&copy; 2025 {config.APP_NAME}. All rights reserved.</p>
                        <p>This is an automated email. Please do not reply to this message.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
        Password Reset Request
        
        Hello {user_name},
        
        We received a request to reset your password. 
        Click the link below to create a new password:
        
        {reset_link}
        
        This link expires in 24 hours.
        
        If you didn't request this reset, please ignore this email.
        
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
# TEST
# ============================================

if __name__ == "__main__":
    print("=" * 60)
    print("EMAIL SENDER TEST - BREVO HTTP API")
    print("=" * 60)
    
    # Test OTP email
    print("\n🔐 Testing OTP email:")
    test_email = "test@example.com"
    test_otp = "123456"
    test_name = "Test User"
    
    success = send_otp_email(test_email, test_otp, test_name)
    
    if success:
        print("✅ OTP email sent successfully!")
    else:
        print("❌ Failed to send OTP email")
        print("⚠️ Make sure BREVO_API_KEY is set in .env")
    
    print("\n" + "=" * 60)
    print("✅ Email sender test completed!")