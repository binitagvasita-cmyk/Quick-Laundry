// ============================================
// STEAM PRESS JAVASCRIPT — UPDATED
// ✅ Matches iron.js feature-set exactly:
//    • Address auto-fill from profile
//    • Add to Cart → /api/cart/add
//    • Place Order → Order Preview Modal → /api/orders/place
//    • QR / Online payment modal
//    • Iron-style order confirmation popup
// ============================================

console.log("🌪️ Steam Press Page Loading...");

// ============================================
// SAFE STORAGE (same as iron.js)
// ============================================
if (!window.safeStorage) {
  window.safeStorage = {
    getItem: (k) => {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    setItem: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch (e) {}
    },
    removeItem: (k) => {
      try {
        localStorage.removeItem(k);
      } catch (e) {}
    },
  };
}

// ============================================
// GLOBAL STATE
// ============================================
let steamPressServices = [];
let selectedService = null;

const API_BASE_URL = window.location.origin;
const STEAM_PRESS_CATEGORY_ID = 4;

// Profile cache (filled by loadUserProfile)
let _profileName = "";
let _profilePhone = "";
let _profileAddress = "";

// ============================================
// INIT
// ============================================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSteamPress);
} else {
  initSteamPress();
}

function initSteamPress() {
  console.log("🎯 Initializing Steam Press Page...");
  applyTheme();
  loadSteamPressServices();
  initializeEventListeners();
  initializeFAQ();
  setMinimumPickupDate();
  loadUserProfile(); // ← NEW: auto-fill address
  injectOrderPreviewModal(); // ← NEW: inject iron-style preview modal

  window.addEventListener("storage", (e) => {
    if (["authToken", "userData", "jwtToken", "isLoggedIn"].includes(e.key)) {
      loadUserProfile();
    }
  });

  window.addEventListener("loginSuccess", () => {
    setTimeout(loadUserProfile, 300);
  });

  console.log("✅ Steam Press page initialized!");
}

// ============================================
// THEME
// ============================================
function applyTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
}

// ============================================
// AUTO-FILL ADDRESS FROM PROFILE  (like iron.js)
// ============================================
async function loadUserProfile() {
  const isLoggedIn = window.safeStorage.getItem("isLoggedIn") === "true";
  const jwtToken = window.safeStorage.getItem("jwtToken");
  if (!isLoggedIn || !jwtToken) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/profile/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
    });

    if (!response.ok) return;

    const result = await response.json();
    const user = result?.data?.user || result?.data || {};

    _profileName = user.full_name || "";
    _profilePhone = user.phone || "";

    const parts = [];
    if (user.address) parts.push(user.address);
    if (user.city) parts.push(user.city);
    if (user.pincode) parts.push(user.pincode);
    _profileAddress = parts.join(", ");

    // Pre-fill the pickup address textarea
    const addrEl = document.getElementById("pickupAddress");
    if (addrEl && _profileAddress) {
      addrEl.value = _profileAddress;

      // Show autofill hint if it exists
      const hint = document.getElementById("spAddressAutofillHint");
      if (hint) hint.style.display = "flex";

      console.log("✅ Steam-press address auto-filled:", _profileAddress);
    }
  } catch (err) {
    console.warn("⚠️ Could not load profile for steam-press:", err.message);
  }
}

// ============================================
// LOAD SERVICES FROM API
// ============================================
async function loadSteamPressServices() {
  const serviceSelect = document.getElementById("serviceSelect");
  const serviceLoading = document.getElementById("serviceLoading");

  if (serviceLoading) serviceLoading.style.display = "flex";
  if (serviceSelect) serviceSelect.disabled = true;

  try {
    let response = await fetch(
      `${API_BASE_URL}/api/services/category/${STEAM_PRESS_CATEGORY_ID}`
    );
    if (!response.ok) {
      response = await fetch(
        `${API_BASE_URL}/api/services?category=${STEAM_PRESS_CATEGORY_ID}`
      );
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    let services = null;
    if (data.success) {
      services =
        data.data?.services || (Array.isArray(data.data) ? data.data : null);
    }

    if (services && services.length > 0) {
      steamPressServices = services.map((s) => ({
        id: s.id,
        name: (s.name || "").trim(),
        price: parseFloat(s.price) || 0,
        unit: (s.unit || "per piece").trim(),
        description: s.description || "",
      }));
      populateServiceDropdown();
    } else {
      throw new Error("No services found");
    }
  } catch (err) {
    console.error("❌ API services failed:", err);
    loadFallbackServices();
  } finally {
    if (serviceLoading) serviceLoading.style.display = "none";
    if (serviceSelect) serviceSelect.disabled = false;
  }
}

function loadFallbackServices() {
  steamPressServices = [
    { id: 401, name: "Shirt Steam Press", price: 20, unit: "per piece" },
    {
      id: 402,
      name: "Pant / Trouser Steam Press",
      price: 20,
      unit: "per piece",
    },
    { id: 403, name: "Kurta Steam Press", price: 50, unit: "per piece" },
    { id: 404, name: "Saree Steam Press", price: 80, unit: "per piece" },
    {
      id: 405,
      name: "Suit / Blazer Steam Press",
      price: 120,
      unit: "per piece",
    },
    {
      id: 406,
      name: "Dress / Gown Steam Press",
      price: 100,
      unit: "per piece",
    },
  ];
  populateServiceDropdown();
  showNotification("Using demo services (API offline)", "warning");
}

function populateServiceDropdown() {
  const serviceSelect = document.getElementById("serviceSelect");
  if (!serviceSelect) return;
  serviceSelect.innerHTML = '<option value="">-- Choose a Service --</option>';
  steamPressServices.forEach((s) => {
    const option = document.createElement("option");
    option.value = s.id;
    option.textContent = `${s.name} — ₹${s.price.toFixed(2)} ${s.unit}`;
    option.dataset.price = s.price;
    option.dataset.unit = s.unit;
    option.dataset.name = s.name;
    serviceSelect.appendChild(option);
  });
}

// ============================================
// EVENT LISTENERS
// ============================================
function initializeEventListeners() {
  const serviceSelect = document.getElementById("serviceSelect");
  const decreaseBtn = document.getElementById("decreaseQty");
  const increaseBtn = document.getElementById("increaseQty");
  const quantityInput = document.getElementById("quantityInput");
  const bookingForm = document.getElementById("steamPressBookingForm");
  const addToCartBtn = document.getElementById("addToCartBtn");

  if (serviceSelect)
    serviceSelect.addEventListener("change", handleServiceChange);
  if (quantityInput) quantityInput.addEventListener("input", updateTotalPrice);

  if (decreaseBtn && quantityInput) {
    decreaseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const v = parseInt(quantityInput.value) || 1;
      if (v > 1) {
        quantityInput.value = v - 1;
        updateTotalPrice();
      }
    });
  }
  if (increaseBtn && quantityInput) {
    increaseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const v = parseInt(quantityInput.value) || 1;
      if (v < 100) {
        quantityInput.value = v + 1;
        updateTotalPrice();
      }
    });
  }

  // Add to Cart
  if (addToCartBtn) addToCartBtn.addEventListener("click", handleAddToCart);

  // Place Order → open preview modal (same as iron.js)
  if (bookingForm) {
    bookingForm.addEventListener("submit", (e) => {
      e.preventDefault();
      openOrderPreview();
    });
  }

  console.log("✅ Event listeners initialized");
}

// ============================================
// SERVICE CHANGE & PRICE DISPLAY
// ============================================
function handleServiceChange(event) {
  const opt = event.target.options[event.target.selectedIndex];
  if (!opt.value) {
    selectedService = null;
    resetPriceDisplay();
    return;
  }
  selectedService = {
    id: parseInt(opt.value),
    name: opt.dataset.name,
    price: parseFloat(opt.dataset.price),
    unit: opt.dataset.unit,
  };
  document.getElementById(
    "unitPrice"
  ).textContent = `₹${selectedService.price.toFixed(2)}`;
  document.getElementById("unitType").textContent = selectedService.unit;
  updateTotalPrice();
  hideError("serviceError");
}

function updateTotalPrice() {
  if (!selectedService) {
    resetPriceDisplay();
    return;
  }
  const qty = parseInt(document.getElementById("quantityInput").value) || 1;
  const total = selectedService.price * qty;
  document.getElementById("totalAmount").textContent = `₹${total.toFixed(2)}`;
}

function resetPriceDisplay() {
  document.getElementById("unitPrice").textContent = "₹0.00";
  document.getElementById("unitType").textContent = "-";
  document.getElementById("totalAmount").textContent = "₹0.00";
}

// ============================================
// COLLECT & VALIDATE FORM DATA
// ============================================
function collectFormData() {
  return {
    serviceId: selectedService?.id || null,
    serviceName: selectedService?.name || null,
    quantity: parseInt(document.getElementById("quantityInput").value) || 1,
    unitPrice: selectedService?.price || 0,
    unit: selectedService?.unit || null,
    pickupDate: document.getElementById("pickupDate").value,
    pickupTime: document.getElementById("pickupTime").value,
    pickupAddress: document.getElementById("pickupAddress").value.trim(),
    specialInstructions:
      document.getElementById("specialInstructions").value.trim() || null,
    categoryId: STEAM_PRESS_CATEGORY_ID,
  };
}

function validateForm(data) {
  let ok = true;

  if (!selectedService) {
    showError("serviceError");
    ok = false;
  } else hideError("serviceError");
  if (!data.quantity || data.quantity < 1 || data.quantity > 100) {
    showError("quantityError");
    ok = false;
  } else hideError("quantityError");
  if (!data.pickupDate) {
    showError("dateError");
    ok = false;
  } else hideError("dateError");
  if (!data.pickupTime) {
    showError("timeError");
    ok = false;
  } else hideError("timeError");
  if (!data.pickupAddress) {
    showError("addressError");
    ok = false;
  } else hideError("addressError");

  return ok;
}

// ============================================
// ADD TO CART  (unchanged logic, kept intact)
// ============================================
async function handleAddToCart() {
  const isLoggedIn = window.safeStorage.getItem("isLoggedIn") === "true";
  const jwtToken = window.safeStorage.getItem("jwtToken");

  if (!isLoggedIn || !jwtToken) {
    showNotification("Please login first to add items to cart", "warning");
    setTimeout(() => {
      if (typeof window.openAuthModal === "function")
        window.openAuthModal("login");
    }, 800);
    return;
  }

  const data = collectFormData();
  if (!validateForm(data)) {
    showNotification("Please fill all required fields", "error");
    return;
  }

  const btn = document.getElementById("addToCartBtn");
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

  try {
    const response = await fetch(`${API_BASE_URL}/api/cart/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(data),
    });
    const result = await response.json();

    if (response.status === 401) {
      window.safeStorage.removeItem("jwtToken");
      window.safeStorage.removeItem("isLoggedIn");
      showNotification("Session expired. Please login again.", "error");
      setTimeout(() => {
        if (typeof window.openAuthModal === "function")
          window.openAuthModal("login");
      }, 800);
      return;
    }

    if (result.success) {
      showNotification(
        `✅ "${data.serviceName}" added to cart successfully!`,
        "success"
      );
      btn.innerHTML = '<i class="fas fa-check"></i> Added!';
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.disabled = false;
      }, 2000);
      if (typeof updateCartBadge === "function")
        setTimeout(updateCartBadge, 500);
    } else {
      showNotification(result.message || "Failed to add to cart", "error");
      btn.innerHTML = orig;
      btn.disabled = false;
    }
  } catch (err) {
    console.error("Add to cart error:", err);
    showNotification("Network error. Please try again.", "error");
    btn.innerHTML = orig;
    btn.disabled = false;
  }
}

// ============================================
// ORDER PREVIEW MODAL  (identical structure to iron.js)
// ============================================
function injectOrderPreviewModal() {
  if (document.getElementById("spOrderPreviewOverlay")) return;

  const html = `
    <div id="spOrderPreviewOverlay" class="iron-preview-overlay">
      <div class="iron-preview-modal">

        <!-- Header -->
        <div class="iron-preview-header">
          <div class="iron-preview-header-icon"><i class="fas fa-receipt"></i></div>
          <div>
            <h2>Order Summary</h2>
            <p>Review and confirm your order details</p>
          </div>
          <button class="iron-preview-close" onclick="document.getElementById('spOrderPreviewOverlay').classList.remove('active')" aria-label="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Service Summary (read-only) -->
        <div class="iron-preview-section">
          <div class="iron-preview-section-title">
            <i class="fas fa-th-list"></i> Service Details
          </div>
          <div id="spPreviewServiceSummary" class="iron-preview-service-box"></div>
        </div>

        <!-- Customer Details (pre-filled, editable) -->
        <div class="iron-preview-section">
          <div class="iron-preview-section-title">
            <i class="fas fa-user"></i> Customer Details
            <span class="iron-preview-edit-hint">Auto-filled · you can edit</span>
          </div>
          <div class="iron-preview-form-row">
            <div class="iron-preview-form-group">
              <label><i class="fas fa-user-circle"></i> Full Name *</label>
              <input type="text" id="spPreviewCustomerName" placeholder="Your full name" />
            </div>
            <div class="iron-preview-form-group">
              <label><i class="fas fa-phone"></i> Phone Number *</label>
              <input type="tel" id="spPreviewCustomerPhone" placeholder="10-digit mobile number" maxlength="10" />
            </div>
          </div>
        </div>

        <!-- Pickup Details (pre-filled, editable) -->
        <div class="iron-preview-section">
          <div class="iron-preview-section-title">
            <i class="fas fa-map-marker-alt"></i> Pickup Details
            <span class="iron-preview-edit-hint">Auto-filled · you can edit</span>
          </div>
          <div class="iron-preview-form-group">
            <label><i class="fas fa-home"></i> Pickup Address *</label>
            <textarea id="spPreviewPickupAddress" rows="2" placeholder="Enter pickup address"></textarea>
          </div>
          <div class="iron-preview-form-row">
            <div class="iron-preview-form-group">
              <label><i class="fas fa-calendar"></i> Pickup Date *</label>
              <input type="date" id="spPreviewPickupDate" />
            </div>
            <div class="iron-preview-form-group">
              <label><i class="fas fa-clock"></i> Pickup Time *</label>
              <select id="spPreviewPickupTime">
                <option value="09:00-11:00">9:00 AM – 11:00 AM</option>
                <option value="11:00-13:00">11:00 AM – 1:00 PM</option>
                <option value="13:00-15:00">1:00 PM – 3:00 PM</option>
                <option value="15:00-17:00">3:00 PM – 5:00 PM</option>
                <option value="17:00-19:00">5:00 PM – 7:00 PM</option>
              </select>
            </div>
          </div>
          <div class="iron-preview-form-group">
            <label><i class="fas fa-comment-alt"></i> Special Instructions (Optional)</label>
            <textarea id="spPreviewSpecialInstructions" rows="2" placeholder="Any special care instructions…"></textarea>
          </div>
        </div>

        <!-- Preferences -->
        <div class="iron-preview-section">
          <div class="iron-preview-section-title">
            <i class="fas fa-sliders-h"></i> Preferences
          </div>
          <div class="iron-preview-form-row">
            <div class="iron-preview-form-group">
              <label><i class="fas fa-tshirt"></i> Folding Preference</label>
              <select id="spPreviewFoldPref">
                <option value="folded">Folded</option>
                <option value="hanged">On Hanger</option>
                <option value="any">No Preference</option>
              </select>
            </div>
            <div class="iron-preview-form-group">
              <label><i class="fas fa-spray-can"></i> Starch</label>
              <select id="spPreviewStarchPref">
                <option value="none">No Starch</option>
                <option value="light">Light Starch</option>
                <option value="heavy">Heavy Starch</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Payment Method -->
        <div class="iron-preview-section">
          <div class="iron-preview-section-title">
            <i class="fas fa-credit-card"></i> Payment Method
          </div>
          <div class="iron-preview-payment-row">
            <label class="iron-payment-option active" id="spPayLabelCod">
              <input type="radio" name="spPreviewPayment" value="cod" checked />
              <i class="fas fa-money-bill-wave"></i>
              <span>Cash on Delivery</span>
            </label>
            <label class="iron-payment-option" id="spPayLabelOnline">
              <input type="radio" name="spPreviewPayment" value="online" />
              <i class="fas fa-globe"></i>
              <span>Online Payment</span>
            </label>
          </div>
        </div>

        <!-- Error -->
        <div id="spPreviewError" class="iron-preview-error" style="display:none;"></div>

        <!-- Footer -->
        <div class="iron-preview-footer">
          <button class="iron-preview-back-btn" onclick="document.getElementById('spOrderPreviewOverlay').classList.remove('active')">
            <i class="fas fa-arrow-left"></i> Go Back
          </button>
          <button id="spConfirmOrderBtn" class="iron-preview-confirm-btn">
            <i class="fas fa-check-circle"></i> Confirm Order
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);

  // Payment option active-style toggle
  document
    .querySelectorAll('input[name="spPreviewPayment"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        document
          .querySelectorAll("#spOrderPreviewOverlay .iron-payment-option")
          .forEach((l) => l.classList.remove("active"));
        radio.closest(".iron-payment-option")?.classList.add("active");
      });
    });

  // Confirm button
  document
    .getElementById("spConfirmOrderBtn")
    .addEventListener("click", confirmSteamOrder);

  // Inject shared preview-modal CSS (only once; iron.js uses same class names)
  if (!document.getElementById("iron-preview-modal-styles")) {
    const style = document.createElement("style");
    style.id = "iron-preview-modal-styles";
    style.textContent = `
      .iron-preview-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s;}
      .iron-preview-overlay.active{opacity:1;visibility:visible;}
      .iron-preview-modal{position:relative;z-index:1;background:var(--primary-bg,#fff);border-radius:20px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.35);}
      [data-theme="dark"] .iron-preview-modal{background:#1a0f2e;border:2px solid rgba(167,139,250,.3);}
      .iron-preview-header{display:flex;align-items:center;gap:1rem;padding:1.25rem 1.5rem;background:linear-gradient(135deg,#6b46c1,#a855f7);border-radius:18px 18px 0 0;color:#fff;}
      .iron-preview-header h2{font-size:1.2rem;font-weight:800;margin:0;}
      .iron-preview-header p{font-size:.8rem;opacity:.85;margin:0;}
      .iron-preview-header-icon{font-size:1.8rem;flex-shrink:0;}
      .iron-preview-close{margin-left:auto;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.2);border:none;color:#fff;cursor:pointer;font-size:.9rem;display:flex;align-items:center;justify-content:center;transition:background .2s,transform .2s;flex-shrink:0;}
      .iron-preview-close:hover{background:rgba(255,255,255,.35);transform:rotate(90deg);}
      .iron-preview-section{padding:1rem 1.5rem;border-bottom:1px solid var(--border-color,#e5e7eb);}
      [data-theme="dark"] .iron-preview-section{border-color:rgba(167,139,250,.2);}
      .iron-preview-section:last-of-type{border-bottom:none;}
      .iron-preview-section-title{font-size:.82rem;font-weight:700;color:#6b46c1;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.75rem;display:flex;align-items:center;gap:.4rem;}
      .iron-preview-edit-hint{margin-left:auto;font-size:.75rem;font-weight:500;color:var(--text-secondary,#6b7280);text-transform:none;letter-spacing:0;}
      .iron-preview-service-box{background:var(--secondary-bg,#f9fafb);border:1.5px solid var(--border-color,#e5e7eb);border-radius:12px;padding:.75rem 1rem;}
      [data-theme="dark"] .iron-preview-service-box{background:rgba(255,255,255,.04);}
      .iron-preview-summary-row{display:flex;justify-content:space-between;align-items:center;font-size:.88rem;color:var(--text-primary,#111);padding:.25rem 0;}
      .iron-preview-summary-total{border-top:1px dashed var(--border-color,#e5e7eb);margin-top:.5rem;padding-top:.5rem;}
      .iron-preview-price{font-weight:700;color:#6b46c1;}
      .iron-preview-total-amt{font-size:1rem;font-weight:800;color:#6b46c1;}
      .iron-preview-form-row{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;}
      @media(max-width:480px){.iron-preview-form-row{grid-template-columns:1fr;}}
      .iron-preview-form-group{display:flex;flex-direction:column;gap:.3rem;margin-bottom:.5rem;}
      .iron-preview-form-group label{font-size:.8rem;font-weight:600;color:var(--text-secondary,#6b7280);}
      .iron-preview-form-group input,
      .iron-preview-form-group select,
      .iron-preview-form-group textarea{padding:.6rem .8rem;border:1.5px solid var(--border-color,#e5e7eb);border-radius:8px;font-size:.88rem;background:var(--primary-bg,#fff);color:var(--text-primary,#111);transition:border-color .2s;}
      [data-theme="dark"] .iron-preview-form-group input,
      [data-theme="dark"] .iron-preview-form-group select,
      [data-theme="dark"] .iron-preview-form-group textarea{background:#2d1b69;border-color:rgba(167,139,250,.3);color:#e9d5ff;}
      .iron-preview-form-group input:focus,
      .iron-preview-form-group select:focus,
      .iron-preview-form-group textarea:focus{outline:none;border-color:#6b46c1;box-shadow:0 0 0 3px rgba(107,70,193,.1);}
      .iron-preview-payment-row{display:flex;gap:.75rem;flex-wrap:wrap;}
      .iron-payment-option{flex:1;min-width:140px;display:flex;align-items:center;gap:.6rem;padding:.75rem 1rem;border:2px solid var(--border-color,#e5e7eb);border-radius:12px;cursor:pointer;transition:all .2s;font-size:.9rem;font-weight:600;color:var(--text-primary,#111);}
      .iron-payment-option input{display:none;}
      .iron-payment-option.active{border-color:#6b46c1;background:rgba(107,70,193,.08);color:#6b46c1;}
      .iron-payment-option i{font-size:1.1rem;}
      .iron-preview-error{margin:0 1.5rem .5rem;padding:.7rem 1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:#ef4444;font-size:.85rem;font-weight:600;}
      .iron-preview-footer{display:flex;gap:.75rem;padding:1rem 1.5rem 1.25rem;border-top:2px solid var(--border-color,#e5e7eb);}
      [data-theme="dark"] .iron-preview-footer{border-color:rgba(167,139,250,.2);}
      .iron-preview-back-btn{display:flex;align-items:center;gap:.5rem;padding:.8rem 1.25rem;border-radius:12px;font-size:.92rem;font-weight:700;cursor:pointer;border:2px solid var(--border-color,#e5e7eb);background:var(--secondary-bg,#f3f4f6);color:var(--text-primary,#111);transition:all .3s;}
      .iron-preview-back-btn:hover{border-color:#6b46c1;}
      .iron-preview-confirm-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:.5rem;padding:.8rem 1.25rem;border-radius:12px;font-size:.92rem;font-weight:700;cursor:pointer;border:none;background:linear-gradient(135deg,#6b46c1,#a855f7);color:#fff;box-shadow:0 4px 14px rgba(107,70,193,.35);transition:all .3s;}
      .iron-preview-confirm-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 20px rgba(107,70,193,.45);}
      .iron-preview-confirm-btn:disabled{opacity:.6;cursor:not-allowed;transform:none;}
    `;
    document.head.appendChild(style);
  }
}

// ============================================
// OPEN ORDER PREVIEW  (called when Place Order is clicked)
// ============================================
function openOrderPreview() {
  const isLoggedIn = window.safeStorage.getItem("isLoggedIn") === "true";
  const jwtToken = window.safeStorage.getItem("jwtToken");

  if (!isLoggedIn || !jwtToken) {
    showNotification("Please login to place an order", "error");
    setTimeout(() => {
      if (typeof window.openAuthModal === "function")
        window.openAuthModal("login");
    }, 800);
    return;
  }

  const data = collectFormData();
  if (!validateForm(data)) {
    showNotification("Please fill all required fields", "error");
    return;
  }

  const qty = data.quantity;
  const unitPrice = selectedService.price;
  const totalPrice = (unitPrice * qty).toFixed(2);

  // Populate service summary box
  document.getElementById("spPreviewServiceSummary").innerHTML = `
    <div class="iron-preview-summary-row">
      <span><i class="fas fa-wind" style="color:#7c3aed;margin-right:6px;"></i>
        <b>Service:</b> ${selectedService.name}</span>
      <span class="iron-preview-price">₹${unitPrice.toFixed(2)} ${
    selectedService.unit
  }</span>
    </div>
    <div class="iron-preview-summary-row iron-preview-summary-total">
      <span><i class="fas fa-layer-group" style="color:#7c3aed;margin-right:6px;"></i>
        <b>Quantity:</b> ${qty} piece${qty !== 1 ? "s" : ""}</span>
      <span class="iron-preview-total-amt">Total: ₹${totalPrice}</span>
    </div>
  `;

  // Pre-fill customer details
  const nameEl = document.getElementById("spPreviewCustomerName");
  const phoneEl = document.getElementById("spPreviewCustomerPhone");
  if (nameEl)
    nameEl.value = _profileName || window.safeStorage.getItem("userName") || "";
  if (phoneEl) phoneEl.value = _profilePhone || "";

  // Pre-fill pickup details from main form
  const previewDateEl = document.getElementById("spPreviewPickupDate");
  if (previewDateEl) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 5);
    previewDateEl.min = tomorrow.toISOString().split("T")[0];
    previewDateEl.max = maxDate.toISOString().split("T")[0];
    previewDateEl.value = data.pickupDate;
  }
  document.getElementById("spPreviewPickupTime").value = data.pickupTime;
  document.getElementById("spPreviewPickupAddress").value = data.pickupAddress;
  document.getElementById("spPreviewSpecialInstructions").value =
    data.specialInstructions || "";

  // Reset error
  const errEl = document.getElementById("spPreviewError");
  if (errEl) errEl.style.display = "none";

  // Show modal
  document.getElementById("spOrderPreviewOverlay").classList.add("active");
}

// ============================================
// CONFIRM STEAM ORDER (COD or Online)
// ============================================
async function confirmSteamOrder() {
  const jwtToken = window.safeStorage.getItem("jwtToken");
  if (!jwtToken) return;

  const name =
    document.getElementById("spPreviewCustomerName")?.value.trim() || "";
  const phone =
    document.getElementById("spPreviewCustomerPhone")?.value.trim() || "";
  const address = document
    .getElementById("spPreviewPickupAddress")
    .value.trim();
  const date = document.getElementById("spPreviewPickupDate").value;
  const time = document.getElementById("spPreviewPickupTime").value;
  const payment =
    document.querySelector('input[name="spPreviewPayment"]:checked')?.value ||
    "cod";
  const foldPref = document.getElementById("spPreviewFoldPref")?.value || "any";
  const starchPref =
    document.getElementById("spPreviewStarchPref")?.value || "none";
  const baseInstr = document
    .getElementById("spPreviewSpecialInstructions")
    .value.trim();

  const prefParts = [];
  if (foldPref !== "any") prefParts.push(`Folding: ${foldPref}`);
  if (starchPref !== "none") prefParts.push(`Starch: ${starchPref}`);
  if (baseInstr) prefParts.push(baseInstr);
  const specialInstructions = prefParts.join(" | ");

  const showErr = (msg) => {
    const el = document.getElementById("spPreviewError");
    if (el) {
      el.textContent = msg;
      el.style.display = "block";
    }
  };

  if (!name || name.length < 2) return showErr("Please enter your full name.");
  if (!phone || phone.length < 10)
    return showErr("Please enter a valid 10-digit phone number.");
  if (!address || address.length < 5)
    return showErr("Please enter a complete pickup address.");
  if (!date) return showErr("Please select a pickup date.");
  if (!time) return showErr("Please select a pickup time.");

  const qty = parseInt(document.getElementById("quantityInput").value) || 1;

  // Online payment → show QR first
  if (payment === "online") {
    document.getElementById("spOrderPreviewOverlay").classList.remove("active");
    showSteamQRModal({
      name,
      phone,
      address,
      date,
      time,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      unit: selectedService.unit,
      quantity: qty,
      unitPrice: selectedService.price,
      specialInstructions,
      totalAmount: selectedService.price * qty,
    });
    const btn = document.getElementById("spConfirmOrderBtn");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Order';
    }
    return;
  }

  // COD → place order directly
  const orderData = {
    serviceId: selectedService.id,
    serviceName: selectedService.name,
    quantity: qty,
    unitPrice: selectedService.price,
    unit: selectedService.unit,
    pickupDate: date,
    pickupTime: time,
    pickupAddress: address,
    specialInstructions: specialInstructions,
    paymentMethod: "cod",
    categoryId: STEAM_PRESS_CATEGORY_ID,
  };

  const confirmBtn = document.getElementById("spConfirmOrderBtn");
  const origText = confirmBtn?.innerHTML || "";
  if (confirmBtn) {
    confirmBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Placing Order...';
    confirmBtn.disabled = true;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/orders/place`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(orderData),
    });
    const result = await response.json();

    if (response.status === 401) {
      window.safeStorage.removeItem("jwtToken");
      window.safeStorage.removeItem("isLoggedIn");
      document
        .getElementById("spOrderPreviewOverlay")
        .classList.remove("active");
      showNotification("Session expired. Please login again.", "error");
      setTimeout(() => {
        if (typeof window.openAuthModal === "function")
          window.openAuthModal("login");
      }, 800);
      return;
    }

    if (result.success) {
      document
        .getElementById("spOrderPreviewOverlay")
        .classList.remove("active");
      showSteamOrderConfirmation({
        orderNumber: result.data?.orderNumber,
        pickup_date: date,
        pickup_time: time,
        quantity: qty,
        totalAmount: result.data?.totalAmount,
        pickup_address: address,
        serviceName: selectedService.name,
      });
      resetForm();
    } else {
      showErr(result.message || "Failed to place order. Please try again.");
    }
  } catch (err) {
    console.error("❌ Confirm order error:", err);
    showErr("Network error. Please check your connection and try again.");
  } finally {
    if (confirmBtn) {
      confirmBtn.innerHTML = origText;
      confirmBtn.disabled = false;
    }
  }
}

// ============================================
// QR PAYMENT MODAL  (same as iron.js, sp-prefixed)
// ============================================
function showSteamQRModal(data) {
  document.getElementById("steamQRPaymentModal")?.remove();

  const amount = (data.totalAmount || 0).toFixed(2);
  const upiId = "9173576732@ybl";
  const upiLink = `upi://pay?pa=${upiId}&pn=QuickLaundry&am=${amount}&cu=INR&tn=SteamPressOrder`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    upiLink
  )}`;

  const modal = document.createElement("div");
  modal.id = "steamQRPaymentModal";
  modal.className = "iqm";
  modal.innerHTML = `
    <div class="iqm__backdrop"></div>
    <div class="iqm__box">
      <div class="iqm__header">
        <div class="iqm__header-icon"><i class="fas fa-qrcode"></i></div>
        <div><h2>Scan &amp; Pay</h2><p>Complete payment to confirm order</p></div>
        <button class="iqm__close" id="steamIqmClose"><i class="fas fa-times"></i></button>
      </div>
      <div class="iqm__amount">
        <span class="iqm__amount-label">Amount to Pay</span>
        <span class="iqm__amount-value">₹${amount}</span>
      </div>
      <div class="iqm__qr-wrapper">
        <img src="${qrImgUrl}" alt="UPI QR Code" class="iqm__qr-img"
          onerror="this.src='https://placehold.co/200x200/6b46c1/white?text=QR+Code'" />
        <div class="iqm__qr-hint"><i class="fas fa-mobile-alt"></i> Scan with PhonePe, GPay, Paytm or any UPI app</div>
      </div>
      <div class="iqm__upi-row">
        <span class="iqm__upi-label">UPI ID:</span>
        <span class="iqm__upi-id">${upiId}</span>
        <button class="iqm__copy-btn" onclick="navigator.clipboard.writeText('${upiId}').then(()=>{ this.innerHTML='<i class=\\'fas fa-check\\'></i> Copied!'; setTimeout(()=>{ this.innerHTML='<i class=\\'fas fa-copy\\'></i> Copy'; },2000); })">
          <i class="fas fa-copy"></i> Copy
        </button>
      </div>
      <div class="iqm__steps">
        <div class="iqm__step"><span class="iqm__step-num">1</span><span>Open your UPI app</span></div>
        <div class="iqm__step"><span class="iqm__step-num">2</span><span>Scan the QR code above</span></div>
        <div class="iqm__step"><span class="iqm__step-num">3</span><span>Pay ₹${amount} &amp; click below</span></div>
      </div>
      <div id="steamIqmError" class="iqm__error" style="display:none;"></div>
      <div class="iqm__footer">
        <button class="iqm__btn iqm__btn--back" id="steamIqmBack"><i class="fas fa-arrow-left"></i> Go Back</button>
        <button class="iqm__btn iqm__btn--paid" id="steamIqmPaid"><i class="fas fa-check-circle"></i> I've Paid ₹${amount}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("iqm--open"));

  // Inject QR styles once (iron.js may have already done it)
  if (!document.getElementById("iron-qr-styles")) {
    const style = document.createElement("style");
    style.id = "iron-qr-styles";
    style.textContent = `
      .iqm{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:1.5rem;opacity:0;visibility:hidden;transition:opacity .3s ease,visibility .3s ease;}
      .iqm--open{opacity:1;visibility:visible;}
      .iqm__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);}
      .iqm__box{position:relative;z-index:1;background:var(--primary-bg,#fff);border-radius:20px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.35);transform:scale(.92);transition:transform .3s ease;}
      .iqm--open .iqm__box{transform:scale(1);}
      [data-theme="dark"] .iqm__box{background:#1a0f2e;border:2px solid rgba(167,139,250,.3);}
      .iqm__header{display:flex;align-items:center;gap:1rem;padding:1.25rem 1.5rem;background:linear-gradient(135deg,#6b46c1,#a855f7);border-radius:18px 18px 0 0;color:#fff;}
      .iqm__header h2{font-size:1.2rem;font-weight:800;margin:0;}
      .iqm__header p{font-size:.8rem;opacity:.85;margin:0;}
      .iqm__header-icon{font-size:1.8rem;flex-shrink:0;}
      .iqm__close{margin-left:auto;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.2);border:none;color:#fff;cursor:pointer;font-size:.9rem;display:flex;align-items:center;justify-content:center;transition:background .2s,transform .2s;flex-shrink:0;}
      .iqm__close:hover{background:rgba(255,255,255,.35);transform:rotate(90deg);}
      .iqm__amount{display:flex;flex-direction:column;align-items:center;padding:1.25rem 1.5rem .75rem;gap:.25rem;}
      .iqm__amount-label{font-size:.8rem;color:var(--text-secondary,#6b7280);text-transform:uppercase;letter-spacing:.5px;font-weight:600;}
      .iqm__amount-value{font-size:2rem;font-weight:800;color:#6b46c1;}
      .iqm__qr-wrapper{display:flex;flex-direction:column;align-items:center;padding:.5rem 1.5rem 1rem;gap:.75rem;}
      .iqm__qr-img{width:200px;height:200px;border-radius:12px;border:3px solid #6b46c1;padding:6px;background:#fff;box-shadow:0 4px 20px rgba(107,70,193,.25);}
      .iqm__qr-hint{font-size:.82rem;color:var(--text-secondary,#6b7280);display:flex;align-items:center;gap:.4rem;text-align:center;}
      .iqm__qr-hint i{color:#6b46c1;}
      .iqm__upi-row{display:flex;align-items:center;gap:.6rem;margin:0 1.5rem .75rem;background:var(--secondary-bg,#f9fafb);border:1.5px solid var(--border-color,#e5e7eb);border-radius:10px;padding:.65rem 1rem;}
      .iqm__upi-label{font-size:.8rem;font-weight:600;color:var(--text-secondary,#6b7280);flex-shrink:0;}
      .iqm__upi-id{font-size:.88rem;font-weight:700;color:#6b46c1;flex:1;}
      .iqm__copy-btn{font-size:.75rem;padding:.3rem .7rem;border-radius:8px;background:rgba(107,70,193,.1);color:#6b46c1;border:1px solid rgba(107,70,193,.3);cursor:pointer;font-weight:600;transition:all .2s;white-space:nowrap;}
      .iqm__copy-btn:hover{background:#6b46c1;color:#fff;}
      .iqm__steps{display:flex;flex-direction:column;gap:.5rem;margin:0 1.5rem .75rem;}
      .iqm__step{display:flex;align-items:center;gap:.75rem;font-size:.85rem;color:var(--text-secondary,#6b7280);font-weight:500;}
      .iqm__step-num{width:22px;height:22px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#6b46c1,#a855f7);color:#fff;font-size:.75rem;font-weight:800;display:flex;align-items:center;justify-content:center;}
      .iqm__error{margin:.25rem 1.5rem;padding:.7rem 1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:#ef4444;font-size:.85rem;font-weight:600;}
      .iqm__footer{display:flex;gap:.75rem;padding:1rem 1.5rem 1.25rem;border-top:2px solid var(--border-color,#e5e7eb);}
      .iqm__btn{display:flex;align-items:center;justify-content:center;gap:.5rem;padding:.8rem 1rem;border-radius:12px;font-size:.92rem;font-weight:700;cursor:pointer;border:none;transition:all .3s ease;}
      .iqm__btn--back{background:var(--secondary-bg,#f3f4f6);color:var(--text-primary,#111);border:2px solid var(--border-color,#e5e7eb);flex-shrink:0;}
      .iqm__btn--back:hover{border-color:#6b46c1;transform:translateY(-2px);}
      .iqm__btn--paid{flex:1;background:linear-gradient(135deg,#10b981,#059669);color:#fff;box-shadow:0 4px 14px rgba(16,185,129,.35);}
      .iqm__btn--paid:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(16,185,129,.45);}
      .iqm__btn--paid:disabled{opacity:.6;cursor:not-allowed;transform:none;}
    `;
    document.head.appendChild(style);
  }

  const closeQR = () => {
    modal.classList.remove("iqm--open");
    setTimeout(() => modal.remove(), 300);
  };
  document.getElementById("steamIqmClose").onclick = closeQR;
  document.getElementById("steamIqmBack").onclick = closeQR;
  modal.querySelector(".iqm__backdrop").onclick = closeQR;
  document.getElementById("steamIqmPaid").onclick = () =>
    placeSteamOrderAfterPayment(data);
}

// ============================================
// PLACE ORDER AFTER QR PAYMENT
// ============================================
async function placeSteamOrderAfterPayment(data) {
  const jwtToken = window.safeStorage.getItem("jwtToken");
  if (!jwtToken) return;

  const btn = document.getElementById("steamIqmPaid");
  const errEl = document.getElementById("steamIqmError");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming...';
  }
  if (errEl) errEl.style.display = "none";

  const orderData = {
    serviceId: data.serviceId,
    serviceName: data.serviceName,
    quantity: data.quantity,
    unitPrice: data.unitPrice,
    unit: data.unit,
    pickupDate: data.date,
    pickupTime: data.time,
    pickupAddress: data.address,
    specialInstructions: data.specialInstructions,
    paymentMethod: "online",
    paymentStatus: "pending_verification",
    categoryId: STEAM_PRESS_CATEGORY_ID,
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/orders/place`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(orderData),
    });
    const result = await response.json();

    if (response.status === 401) {
      window.safeStorage.removeItem("jwtToken");
      window.safeStorage.removeItem("isLoggedIn");
      const modal = document.getElementById("steamQRPaymentModal");
      if (modal) {
        modal.classList.remove("iqm--open");
        setTimeout(() => modal.remove(), 300);
      }
      showNotification("Session expired. Please login again.", "error");
      setTimeout(() => {
        if (typeof window.openAuthModal === "function")
          window.openAuthModal("login");
      }, 800);
      return;
    }

    if (result.success) {
      const modal = document.getElementById("steamQRPaymentModal");
      if (modal) {
        modal.classList.remove("iqm--open");
        setTimeout(() => modal.remove(), 300);
      }
      showSteamOrderConfirmation({
        orderNumber: result.data?.orderNumber,
        pickup_date: data.date,
        pickup_time: data.time,
        quantity: data.quantity,
        totalAmount: result.data?.totalAmount,
        pickup_address: data.address,
        serviceName: data.serviceName,
        paymentMethod: "online",
      });
      resetForm();
    } else {
      if (errEl) {
        errEl.textContent = result.message || "Failed to place order.";
        errEl.style.display = "block";
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-check-circle"></i> I've Paid ₹${(
          data.totalAmount || 0
        ).toFixed(2)}`;
      }
    }
  } catch (err) {
    console.error("❌ Steam QR payment error:", err);
    if (errEl) {
      errEl.textContent = "Network error. Please try again.";
      errEl.style.display = "block";
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-check-circle"></i> I've Paid ₹${(
        data.totalAmount || 0
      ).toFixed(2)}`;
    }
  }
}

// ============================================
// ORDER CONFIRMATION POPUP  (identical to iron.js)
// ============================================
function showSteamOrderConfirmation(orderData) {
  document.getElementById("steamOrderConfirmationModal")?.remove();

  const modal = document.createElement("div");
  modal.className = "order-confirmation-modal";
  modal.id = "steamOrderConfirmationModal";
  modal.innerHTML = `
    <div class="confirmation-content">
      <div class="confirmation-icon"><i class="fas fa-check-circle"></i></div>
      <h2>Order Placed Successfully! 🎉</h2>
      <p>Your steam press order has been confirmed.</p>
      <div class="confirmation-details">
        ${
          orderData.orderNumber
            ? `<div class="detail-item"><i class="fas fa-hashtag"></i><span>Order #: ${orderData.orderNumber}</span></div>`
            : ""
        }
        ${
          orderData.serviceName
            ? `<div class="detail-item"><i class="fas fa-wind"></i><span>Service: ${orderData.serviceName}</span></div>`
            : ""
        }
        <div class="detail-item"><i class="fas fa-calendar"></i><span>Pickup Date: ${
          orderData.pickup_date || "TBD"
        }</span></div>
        <div class="detail-item"><i class="fas fa-clock"></i><span>Pickup Time: ${
          orderData.pickup_time || "TBD"
        }</span></div>
        <div class="detail-item"><i class="fas fa-layer-group"></i><span>Quantity: ${
          orderData.quantity || 0
        } pieces</span></div>
        ${
          orderData.totalAmount
            ? `<div class="detail-item"><i class="fas fa-rupee-sign"></i><span>Total: ₹${orderData.totalAmount}</span></div>`
            : ""
        }
        <div class="detail-item"><i class="fas fa-map-marker-alt"></i><span>${
          orderData.pickup_address || ""
        }</span></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:0;">
        <button class="btn-close-confirmation" onclick="document.getElementById('steamOrderConfirmationModal').remove();document.body.style.overflow='';"
          style="flex:1;background:var(--secondary-bg,#f3f4f6);color:var(--text-primary,#111);box-shadow:none;">
          Order More
        </button>
        <a href="orders.html" style="flex:1;text-decoration:none;">
          <button class="btn-close-confirmation" style="width:100%;background:linear-gradient(135deg,#7c3aed,#6d28d9);">
            <i class="fas fa-list"></i> View My Orders
          </button>
        </a>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  // Inject confirmation styles once (may already be present if iron.js loaded)
  if (!document.getElementById("order-confirmation-styles")) {
    const style = document.createElement("style");
    style.id = "order-confirmation-styles";
    style.textContent = `
      .order-confirmation-modal{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:10000;animation:fadeIn .3s ease;}
      .confirmation-content{background:var(--primary-bg,#fff);border:1.5px solid var(--accent-color,#6b46c1);border-radius:18px;padding:1.5rem 1.5rem 1.25rem;max-width:360px;width:92%;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.25);animation:slideInUp .4s ease;}
      .confirmation-icon{width:58px;height:58px;margin:0 auto .9rem;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.9rem;color:white;box-shadow:0 6px 18px rgba(16,185,129,.35);animation:scaleIn .5s ease .2s backwards;}
      .confirmation-content h2{font-size:1.2rem;font-weight:800;color:var(--text-primary,#111);margin-bottom:.3rem;}
      .confirmation-content p{color:var(--text-secondary,#6b7280);font-size:.82rem;margin-bottom:.9rem;}
      .confirmation-details{background:var(--secondary-bg,#f9fafb);border-radius:10px;padding:.7rem .9rem;margin-bottom:1rem;text-align:left;}
      .detail-item{display:flex;align-items:flex-start;gap:.6rem;padding:.35rem 0;color:var(--text-primary,#111);font-weight:600;font-size:.82rem;border-bottom:1px solid var(--border-color,#f0f0f0);}
      .detail-item:last-child{border-bottom:none;}
      .detail-item i{color:var(--accent-color,#6b46c1);font-size:.9rem;margin-top:2px;flex-shrink:0;}
      .btn-close-confirmation{padding:.65rem 1rem;background:linear-gradient(135deg,#6b46c1,#a855f7);color:white;border:none;border-radius:10px;font-size:.85rem;font-weight:700;cursor:pointer;transition:all .3s ease;box-shadow:0 4px 12px rgba(107,70,193,.3);}
      .btn-close-confirmation:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(107,70,193,.4);}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes slideInUp{from{transform:translateY(50px);opacity:0}to{transform:translateY(0);opacity:1}}
      @keyframes scaleIn{from{transform:scale(0)}to{transform:scale(1)}}
    `;
    document.head.appendChild(style);
  }
}

// ============================================
// RESET FORM AFTER ORDER
// ============================================
function resetForm() {
  const form = document.getElementById("steamPressBookingForm");
  if (form) form.reset();
  selectedService = null;
  resetPriceDisplay();
  setMinimumPickupDate();
  // Re-fill address after reset
  setTimeout(loadUserProfile, 400);
}

// ============================================
// FAQ ACCORDION
// ============================================
function initializeFAQ() {
  document.querySelectorAll(".faq-item").forEach((item) => {
    const q = item.querySelector(".faq-question");
    if (!q) return;
    q.addEventListener("click", () => {
      const isActive = item.classList.contains("active");
      document
        .querySelectorAll(".faq-item")
        .forEach((o) => o.classList.remove("active"));
      if (!isActive) item.classList.add("active");
    });
  });
}

// ============================================
// SET MINIMUM & MAXIMUM PICKUP DATE (5-day window)
// ============================================
function setMinimumPickupDate() {
  const el = document.getElementById("pickupDate");
  if (!el) return;
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 5);
  el.setAttribute("min", tomorrow.toISOString().split("T")[0]);
  el.setAttribute("max", maxDate.toISOString().split("T")[0]);
}

// ============================================
// ERROR HELPERS
// ============================================
function showError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "block";
}
function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

// ============================================
// NOTIFICATION SYSTEM (unchanged)
// ============================================
function showNotification(message, type = "info") {
  document.querySelectorAll(".steam-notification").forEach((n) => n.remove());

  const icons = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    warning: "fa-exclamation-triangle",
    info: "fa-info-circle",
  };
  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
  };

  const notification = document.createElement("div");
  notification.className = `steam-notification notification-${type}`;
  notification.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background:transparent;border:none;color:white;margin-left:auto;cursor:pointer;font-size:1rem;padding:0 0 0 .5rem;">
      <i class="fas fa-times"></i>
    </button>
  `;
  notification.style.cssText = `
    position:fixed;bottom:100px;right:30px;background:${
      colors[type] || colors.info
    };color:white;
    padding:1rem 1.5rem;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);
    display:flex;align-items:center;gap:.75rem;font-weight:600;font-size:.95rem;
    z-index:99999;animation:slideInRight .3s ease;max-width:420px;min-width:280px;
  `;
  document.body.appendChild(notification);
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = "slideOutRight .3s ease forwards";
      setTimeout(() => notification.remove(), 300);
    }
  }, 4500);
}

if (!document.getElementById("steam-notif-styles")) {
  const style = document.createElement("style");
  style.id = "steam-notif-styles";
  style.textContent = `
    @keyframes slideInRight{from{transform:translateX(450px);opacity:0}to{transform:translateX(0);opacity:1}}
    @keyframes slideOutRight{from{transform:translateX(0);opacity:1}to{transform:translateX(450px);opacity:0}}
    @media(max-width:600px){.steam-notification{right:15px!important;bottom:80px!important;left:15px!important;max-width:calc(100% - 30px)!important;}}
  `;
  document.head.appendChild(style);
}

console.log(
  "✅ Steam Press JavaScript loaded — iron.js feature-parity achieved!"
);
