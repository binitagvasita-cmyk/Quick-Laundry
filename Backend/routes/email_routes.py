"""
============================================
EMAIL ROUTES — Quick Laundry
Blueprint: /api/email

Handles 3 email flows:
  1. POST /api/email/order-placed      → Customer confirmation (instant, on order)
  2. POST /api/email/order-approved    → Customer approval (admin triggers this)
  3. POST /api/email/delivery-assigned → Customer notified of delivery boy name (admin triggers)

Admin triggers emails 2 & 3 from the admin panel.
No new dependencies — uses Flask-Mail or smtplib (configured in config.py)
============================================
"""


import traceback

from datetime              import datetime

import sys
import os

# ── Make sure the Backend root is on sys.path so that
#    auth_middleware, config, etc. can be imported from routes/ ──────────────
_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _root not in sys.path:
    sys.path.insert(0, _root)

from flask           import Blueprint, request, jsonify
from middleware.auth_middleware import token_required   # Backend/middleware/auth_middleware.py
from config          import get_config

cfg = get_config()

email_bp = Blueprint("email", __name__, url_prefix="/api/email")


# ============================================
# HELPER: Send email via SMTP
# ============================================
def _send_email(to_email, subject, html_body):
    try:
        import requests as req
        resend_api_key = os.getenv('RESEND_API_KEY', '')
        email_from     = os.getenv('EMAIL_FROM', 'onboarding@resend.dev')

        if not resend_api_key:
            print("⚠️ RESEND_API_KEY not configured")
            return False

        resp = req.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json"
            },
            json={
                "from": f"Cleanify Laundry <{email_from}>",
                "to": [to_email],
                "subject": subject,
                "html": html_body
            },
            timeout=10
        )
        return resp.status_code in (200, 201)
    except Exception as e:
        print(f"❌ Email error: {e}")
        return False


# ============================================
# SHARED: HTML email wrapper (branded)
# ============================================
def _email_wrapper(content_html: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Quick Laundry</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:20px;overflow:hidden;
                    box-shadow:0 8px 32px rgba(107,70,193,0.12);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6b46c1,#9333ea);
                     padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:900;
                       letter-spacing:-0.5px;">
              🧺 Quick Laundry
            </h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
              {cfg.SHOP_NAME} · {cfg.SHOP_TAGLINE}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            {content_html}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f5f3ff;padding:20px 32px;text-align:center;
                     border-top:1px solid #ede9fe;">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
              {cfg.SHOP_ADDRESS}<br/>
              📞 {cfg.SHOP_PHONE} &nbsp;|&nbsp; ✉️ {cfg.SHOP_EMAIL}<br/>
              🕐 {cfg.SHOP_HOURS}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""


# ─── Reusable detail row ────────────────────────────────────────────────────
def _row(icon, label, value):
    return f"""
    <tr>
      <td style="padding:8px 12px;font-size:14px;color:#6b7280;font-weight:600;
                 white-space:nowrap;">{icon} {label}</td>
      <td style="padding:8px 12px;font-size:14px;color:#1f2937;font-weight:700;">
        {value}
      </td>
    </tr>"""


def _order_table(data: dict) -> str:
    rows = ""
    if data.get("orderNumber"):
        rows += _row("🔢", "Order #",       f"<strong>#{data['orderNumber']}</strong>")
    if data.get("serviceName"):
        rows += _row("👔", "Service",        data["serviceName"])
    if data.get("quantity"):
        rows += _row("📦", "Quantity",       f"{data['quantity']} item(s)")
    if data.get("totalAmount"):
        rows += _row("💰", "Total Amount",   f"<strong>₹{data['totalAmount']}</strong>")
    if data.get("pickupDate"):
        rows += _row("📅", "Pickup Date",    data["pickupDate"])
    if data.get("pickupTime"):
        rows += _row("⏰", "Pickup Slot",    data["pickupTime"])
    if data.get("pickupAddress"):
        rows += _row("📍", "Pickup Address", data["pickupAddress"])
    if data.get("paymentMethod"):
        label = "Cash on Delivery" if data["paymentMethod"] == "cod" else "Online Payment"
        rows += _row("💳", "Payment",        label)
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f9f7ff;border-radius:14px;border:1.5px solid #ede9fe;
                  margin:20px 0;">
      {rows}
    </table>"""


# ============================================
# 1. POST /api/email/order-placed
#    Called by frontend immediately after successful order placement.
#    Sends confirmation email to customer.
# ============================================
@email_bp.route("/order-placed", methods=["POST"])
@token_required
def send_order_placed_email(current_user):
    """
    Body (JSON):
      orderNumber, customerName, customerEmail,
      serviceName, quantity, totalAmount,
      pickupDate, pickupTime, pickupAddress, paymentMethod
    """
    try:
        data = request.get_json(silent=True) or {}

        to_email = data.get("customerEmail", "").strip()
        if not to_email:
            return jsonify({"success": False, "message": "customerEmail required"}), 400

        name = data.get("customerName", "Valued Customer")

        content = f"""
        <h2 style="margin:0 0 6px;color:#1f2937;font-size:22px;font-weight:900;">
          🎉 Order Placed Successfully!
        </h2>
        <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
          Hi <strong>{name}</strong>, thank you for choosing Quick Laundry!
          Your dry clean order has been received and is being reviewed.
        </p>

        {_order_table(data)}

        <!-- What happens next -->
        <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:14px;
                    padding:18px 20px;margin:20px 0;">
          <p style="margin:0 0 12px;font-weight:800;color:#166534;font-size:14px;">
            📋 What happens next?
          </p>
          <div style="display:flex;flex-direction:column;gap:10px;">
            {"".join([
              f'<div style="display:flex;gap:10px;align-items:flex-start;">'
              f'<div style="width:10px;height:10px;border-radius:50%;background:{"#10b981" if i==0 else "#d1d5db"};'
              f'flex-shrink:0;margin-top:4px;"></div>'
              f'<div><strong style="font-size:13px;color:#1f2937;">{s}</strong>'
              f'<span style="display:block;font-size:12px;color:#6b7280;">{d}</span></div></div>'
              for i, (s, d) in enumerate([
                ("Order Confirmed ✅",   "We've received your dry clean order"),
                ("Admin Approval",       "Admin will review & send you an approval email"),
                ("Delivery Boy Assigned","You'll receive an email with the delivery boy's name"),
                ("Pickup",              "Clothes collected from your address"),
                ("Cleaning & Delivery", "Professionally cleaned & delivered back to you"),
              ])
            ])}
          </div>
        </div>

        <p style="font-size:13px;color:#9ca3af;text-align:center;margin:20px 0 0;">
          Need help? Reply to this email or WhatsApp us at
          <a href="https://wa.me/{cfg.SHOP_WHATSAPP}"
             style="color:#6b46c1;font-weight:700;">+{cfg.SHOP_WHATSAPP}</a>
        </p>
        """

        ok = _send_email(
            to_email,
            f"✅ Order Confirmed — Quick Laundry (#{data.get('orderNumber','')})",
            _email_wrapper(content)
        )

        if ok:
            return jsonify({"success": True, "message": "Order confirmation email sent"}), 200
        else:
            return jsonify({"success": False, "message": "Email delivery failed"}), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500


# ============================================
# 2. POST /api/email/order-approved
#    Admin triggers this after reviewing the order.
#    Notifies customer their order is approved.
# ============================================
@email_bp.route("/order-approved", methods=["POST"])
@token_required
def send_order_approved_email(current_user):
    """
    Body (JSON):
      orderNumber, customerName, customerEmail,
      serviceName, pickupDate, pickupTime, pickupAddress,
      adminNote (optional)
    Requires: admin JWT token
    """
    try:
        data     = request.get_json(silent=True) or {}
        to_email = data.get("customerEmail", "").strip()
        if not to_email:
            return jsonify({"success": False, "message": "customerEmail required"}), 400

        name      = data.get("customerName", "Valued Customer")
        adminNote = data.get("adminNote", "")

        note_block = (
            f'<div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:12px;'
            f'padding:14px 18px;margin:16px 0;">'
            f'<p style="margin:0;font-size:13px;color:#92400e;">'
            f'📝 <strong>Note from admin:</strong> {adminNote}</p></div>'
        ) if adminNote else ""

        content = f"""
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:72px;height:72px;background:linear-gradient(135deg,#6b46c1,#9333ea);
                      border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
                      font-size:32px;margin-bottom:12px;">✅</div>
          <h2 style="margin:0 0 6px;color:#1f2937;font-size:22px;font-weight:900;">
            Order Approved!
          </h2>
          <p style="margin:0;color:#6b7280;font-size:15px;">
            Hi <strong>{name}</strong>, great news! Your order has been approved by our team.
          </p>
        </div>

        {_order_table(data)}
        {note_block}

        <div style="background:#ede9fe;border-radius:14px;padding:18px 20px;margin:20px 0;
                    text-align:center;">
          <p style="margin:0;font-size:14px;color:#4c1d95;font-weight:700;">
            🚚 A delivery boy will be assigned soon!<br/>
            <span style="font-weight:500;font-size:13px;">
              You'll receive another email once your pickup person is assigned.
            </span>
          </p>
        </div>

        <p style="font-size:13px;color:#9ca3af;text-align:center;margin:20px 0 0;">
          Questions? WhatsApp us at
          <a href="https://wa.me/{cfg.SHOP_WHATSAPP}"
             style="color:#6b46c1;font-weight:700;">+{cfg.SHOP_WHATSAPP}</a>
        </p>
        """

        ok = _send_email(
            to_email,
            f"✅ Your Order #{data.get('orderNumber','')} is Approved — Quick Laundry",
            _email_wrapper(content)
        )

        if ok:
            return jsonify({"success": True, "message": "Approval email sent"}), 200
        else:
            return jsonify({"success": False, "message": "Email delivery failed"}), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500


# ============================================
# 3. POST /api/email/delivery-assigned
#    Admin triggers this after assigning a delivery boy.
#    Sends delivery boy name + contact to customer.
# ============================================
@email_bp.route("/delivery-assigned", methods=["POST"])
@token_required
def send_delivery_assigned_email(current_user):
    """
    Body (JSON):
      orderNumber, customerName, customerEmail,
      serviceName, pickupDate, pickupTime,
      deliveryBoyName, deliveryBoyPhone,
      adminNote (optional)
    Requires: admin JWT token
    """
    try:
        data     = request.get_json(silent=True) or {}
        to_email = data.get("customerEmail", "").strip()
        if not to_email:
            return jsonify({"success": False, "message": "customerEmail required"}), 400

        name     = data.get("customerName",    "Valued Customer")
        db_name  = data.get("deliveryBoyName", "Our team member")
        db_phone = data.get("deliveryBoyPhone","")
        adminNote= data.get("adminNote",       "")

        phone_line = (
            f'<p style="margin:6px 0 0;font-size:13px;color:#6b46c1;font-weight:700;">'
            f'📞 Contact: <a href="tel:{db_phone}" style="color:#6b46c1;">{db_phone}</a></p>'
        ) if db_phone else ""

        note_block = (
            f'<div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:12px;'
            f'padding:14px 18px;margin:16px 0;">'
            f'<p style="margin:0;font-size:13px;color:#92400e;">'
            f'📝 <strong>Note from admin:</strong> {adminNote}</p></div>'
        ) if adminNote else ""

        content = f"""
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:72px;height:72px;background:linear-gradient(135deg,#0891b2,#0284c7);
                      border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
                      font-size:32px;margin-bottom:12px;">🛵</div>
          <h2 style="margin:0 0 6px;color:#1f2937;font-size:22px;font-weight:900;">
            Delivery Boy Assigned!
          </h2>
          <p style="margin:0;color:#6b7280;font-size:15px;">
            Hi <strong>{name}</strong>, your pickup person has been assigned.
            They will collect your clothes soon!
          </p>
        </div>

        <!-- Delivery boy card -->
        <div style="background:linear-gradient(135deg,rgba(14,165,233,0.08),rgba(99,102,241,0.06));
                    border:1.5px solid rgba(14,165,233,0.25);border-radius:16px;
                    padding:20px 24px;margin:0 0 20px;text-align:center;">
          <div style="width:56px;height:56px;background:linear-gradient(135deg,#0ea5e9,#6366f1);
                      border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
                      font-size:24px;margin-bottom:10px;">👤</div>
          <p style="margin:0;font-size:18px;font-weight:900;color:#1f2937;">{db_name}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Your Pickup & Delivery Person</p>
          {phone_line}
        </div>

        {_order_table(data)}
        {note_block}

        <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:14px;
                    padding:18px 20px;margin:20px 0;">
          <p style="margin:0;font-size:14px;color:#166534;font-weight:700;">
            ✅ What to do when they arrive?
          </p>
          <ul style="margin:10px 0 0;padding-left:20px;color:#374151;font-size:13px;line-height:2;">
            <li>Hand over your garments securely packed</li>
            <li>Verify the delivery boy name matches <strong>{db_name}</strong></li>
            <li>Ask for a pickup receipt / confirmation message</li>
          </ul>
        </div>

        <p style="font-size:13px;color:#9ca3af;text-align:center;margin:20px 0 0;">
          Any issues? WhatsApp us at
          <a href="https://wa.me/{cfg.SHOP_WHATSAPP}"
             style="color:#6b46c1;font-weight:700;">+{cfg.SHOP_WHATSAPP}</a>
        </p>
        """

        ok = _send_email(
            to_email,
            f"🛵 Delivery Boy Assigned — Order #{data.get('orderNumber','')} | Quick Laundry",
            _email_wrapper(content)
        )

        if ok:
            return jsonify({"success": True, "message": "Delivery assignment email sent"}), 200
        else:
            return jsonify({"success": False, "message": "Email delivery failed"}), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500


print("✅ Email Routes Blueprint Loaded")