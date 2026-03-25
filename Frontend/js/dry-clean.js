// ============================================
// DRY CLEAN PAGE — UPDATED
// ✅ Address auto-fill from profile
// ✅ Add to Cart → /api/cart/add  (unchanged)
// ✅ Place Order → Order Preview Modal → /api/orders/place
// ✅ QR / Online payment modal  (iron-style)
// ✅ Iron-style order confirmation popup
// ✅ Consistent UI with iron.js & steam-press.js
// ============================================

console.log("🧴 Dry Clean Page JS Loading...");

const API_BASE = window.location.origin + "/api";
const DRY_CLEAN_CATEGORY_ID = 2;

// ─── State ───────────────────────────────────
let servicesData = [];
let selectedService = null;
let currentQty = 1;

// Profile cache (filled by loadUserProfile)
let _profileName = "";
let _profilePhone = "";
let _profileAddress = "";

// ─── Safe Storage ─────────────────────────────
const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

// Also expose as window.safeStorage for consistency
if (!window.safeStorage) {
  window.safeStorage = {
    getItem: (k) => store.get(k),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.remove(k),
  };
}

// ============================================
// INIT
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Dry Clean DOM ready");
  setMinDate();
  loadDryCleanServices();
  bindEvents();
  setupAuth();
  checkAuth();
  loadUserProfile(); // ← NEW: auto-fill address
  injectOrderPreviewModal(); // ← NEW: inject iron-style preview modal

  window.addEventListener("loginSuccess", () => {
    checkAuth();
    setTimeout(loadUserProfile, 300);
  });

  window.addEventListener("storage", (e) => {
    if (e.key === "isLoggedIn") checkAuth();
    if (["jwtToken", "isLoggedIn"].includes(e.key)) loadUserProfile();
  });
});

// ============================================
// SET MIN/MAX PICKUP DATE  (5-day booking window)
// Min = tomorrow  |  Max = today + 5 days
// ============================================
function setMinDate() {
  const el = document.getElementById("pickupDate");
  if (!el) return;

  const today = new Date();

  const tom = new Date(today);
  tom.setDate(today.getDate() + 1);

  const maxD = new Date(today);
  maxD.setDate(today.getDate() + 5);

  const fmt = (d) => d.toISOString().split("T")[0];
  el.min = fmt(tom);
  el.max = fmt(maxD);
  el.value = fmt(tom);

  // Also enforce on the preview-modal date picker every time it opens
  const pEl = document.getElementById("dcPreviewPickupDate");
  if (pEl) {
    pEl.min = fmt(tom);
    pEl.max = fmt(maxD);
  }

  // Show helper text under the date field
  const hint = document.getElementById("pickupDateHint");
  if (hint) {
    hint.textContent = `📅 Available: ${fmt(tom)} to ${fmt(
      maxD
    )} (next 5 days only)`;
    hint.style.display = "block";
  }
}

// ── Validate that a chosen date is still inside the 5-day window ──────────
function isDateInWindow(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tom = new Date(today);
  tom.setDate(today.getDate() + 1);
  const maxD = new Date(today);
  maxD.setDate(today.getDate() + 5);
  const chosen = new Date(dateStr + "T00:00:00");

  return chosen >= tom && chosen <= maxD;
}

// ============================================
// AUTO-FILL ADDRESS FROM PROFILE  (like iron.js)
// ============================================
async function loadUserProfile() {
  const isLoggedIn = store.get("isLoggedIn") === "true";
  const jwtToken = store.get("jwtToken");
  if (!isLoggedIn || !jwtToken) return;

  try {
    const response = await fetch(window.location.origin + "/api/profile/", {
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

    const addrEl = document.getElementById("pickupAddress");
    if (addrEl && _profileAddress) {
      addrEl.value = _profileAddress;
      const hint = document.getElementById("dcAddressAutofillHint");
      if (hint) hint.style.display = "flex";
      console.log("✅ Dry-clean address auto-filled:", _profileAddress);
    }
  } catch (err) {
    console.warn("⚠️ Could not load profile for dry-clean:", err.message);
  }
}

// ============================================
// LOAD SERVICES FROM BACKEND
// ============================================
async function loadDryCleanServices() {
  showState("loading");
  try {
    let response = await fetch(`${API_BASE}/dry-clean/services`);
    if (!response.ok)
      response = await fetch(
        `${API_BASE}/services/category/${DRY_CLEAN_CATEGORY_ID}`
      );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.success) throw new Error(data.message || "API error");

    const raw = data.data;
    if (Array.isArray(raw)) servicesData = raw;
    else if (raw && Array.isArray(raw.services)) servicesData = raw.services;
    else if (Array.isArray(data.services)) servicesData = data.services;
    else servicesData = [];

    servicesData = servicesData.map((s) => ({
      service_id: s.service_id ?? s.id,
      service_name: s.service_name ?? s.name ?? s.serviceName ?? "Unknown",
      description: s.description ?? s.desc ?? "",
      base_price: parseFloat(s.base_price ?? s.price ?? s.basePrice ?? 0),
      price_unit: s.price_unit ?? s.unit ?? s.priceUnit ?? "per piece",
      icon: s.icon ?? "fas fa-vest",
      is_featured: !!(s.is_featured ?? s.featured ?? false),
    }));

    populateDropdown();
    renderServicesGrid();
    showState("form");
  } catch (err) {
    console.warn("⚠️ API failed, using fallback:", err.message);
    loadFallback();
    populateDropdown();
    renderServicesGrid();
    showState("form");
  }
}

function showState(state) {
  const loader = document.getElementById("dcLoader");
  const error = document.getElementById("dcError");
  const form = document.getElementById("dryCleanForm");
  if (loader) loader.style.display = state === "loading" ? "flex" : "none";
  if (error) error.style.display = state === "error" ? "flex" : "none";
  if (form) form.style.display = state === "form" ? "flex" : "none";
}

function loadFallback() {
  servicesData = [
    {
      service_id: 4,
      service_name: "Women Panjabi Suit",
      description: "Professional dry cleaning for suits and formal wear",
      base_price: 150,
      price_unit: "Per Pair",
      icon: "fas fa-user-tie",
      is_featured: true,
    },
    {
      service_id: 17,
      service_name: "Men Suits",
      description: "Professional dry cleaning for suits and formal wear",
      base_price: 200,
      price_unit: "Piece",
      icon: "fas fa-user-tie",
      is_featured: true,
    },
    {
      service_id: 5,
      service_name: "Heavy Dress for Women",
      description: "Expert dry cleaning for dresses and gowns",
      base_price: 200,
      price_unit: "Per Piece",
      icon: "fas fa-female",
      is_featured: false,
    },
    {
      service_id: 6,
      service_name: "Coat & Jacket",
      description: "Specialized dry cleaning for coats and jackets",
      base_price: 180,
      price_unit: "piece",
      icon: "fas fa-vest",
      is_featured: false,
    },
    {
      service_id: 33,
      service_name: "Pant",
      description: "Professional dry cleaning for pants",
      base_price: 70,
      price_unit: "Per Piece",
      icon: "fas fa-tshirt",
      is_featured: false,
    },
    {
      service_id: 34,
      service_name: "Shirt",
      description: "Gentle dry cleaning service for shirts",
      base_price: 70,
      price_unit: "Per Piece",
      icon: "fas fa-tshirt",
      is_featured: false,
    },
    {
      service_id: 35,
      service_name: "Men's Kurta & Pajama",
      description: "Dry cleaning service for ethnic wear",
      base_price: 150,
      price_unit: "per cloth",
      icon: "fas fa-user-tie",
      is_featured: false,
    },
    {
      service_id: 36,
      service_name: "Chaniya Choli",
      description: "Special dry cleaning for heavy traditional garments",
      base_price: 450,
      price_unit: "per pair",
      icon: "fas fa-female",
      is_featured: true,
    },
    {
      service_id: 38,
      service_name: "Saree & Blouse",
      description: "Premium dry cleaning for saree",
      base_price: 250,
      price_unit: "per pair",
      icon: "fas fa-gem",
      is_featured: true,
    },
  ];
  showDcNotif("⚠️ Using cached data — some prices may vary.", "warning");
}

// ============================================
// POPULATE DROPDOWN
// ============================================
function populateDropdown() {
  const sel = document.getElementById("serviceSelect");
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Select Garment Type --</option>';
  servicesData.forEach((s) => {
    if (!s.service_id || !s.service_name || s.service_name === "Unknown")
      return;
    if (isNaN(parseFloat(s.base_price))) return;
    const opt = document.createElement("option");
    opt.value = s.service_id;
    const pu = s.price_unit ? ` / ${s.price_unit}` : "";
    opt.textContent = `${s.service_name}  —  ₹${parseFloat(
      s.base_price
    ).toFixed(0)}${pu}`;
    opt.dataset.price = s.base_price;
    opt.dataset.unit = s.price_unit || "per piece";
    opt.dataset.desc = s.description || "";
    opt.dataset.icon = s.icon || "fas fa-vest";
    sel.appendChild(opt);
  });
  if (sel.options.length <= 1) {
    loadFallback();
    sel.innerHTML = '<option value="">-- Select Garment Type --</option>';
    servicesData.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.service_id;
      const pu = s.price_unit ? ` / ${s.price_unit}` : "";
      opt.textContent = `${s.service_name}  —  ₹${parseFloat(
        s.base_price
      ).toFixed(0)}${pu}`;
      opt.dataset.price = s.base_price;
      opt.dataset.unit = s.price_unit || "per piece";
      opt.dataset.desc = s.description || "";
      opt.dataset.icon = s.icon || "fas fa-vest";
      sel.appendChild(opt);
    });
  }
}

// ============================================
// RENDER SERVICES GRID
// ============================================
function renderServicesGrid() {
  const grid = document.getElementById("servicesGrid");
  if (!grid) return;
  if (!servicesData.length) {
    grid.innerHTML = `<p class="dc-sg-loading">No services available</p>`;
    return;
  }
  grid.innerHTML = servicesData
    .map((s) => {
      const price = parseFloat(s.base_price).toFixed(0);
      const unit = s.price_unit ? `<span>/ ${s.price_unit}</span>` : "";
      const badge = s.is_featured
        ? `<div class="dc-sc-featured">Popular</div>`
        : "";
      return `
      <div class="dc-service-card">
        ${badge}
        <div class="dc-sc-icon"><i class="${s.icon || "fas fa-vest"}"></i></div>
        <div class="dc-sc-name">${s.service_name}</div>
        <p class="dc-sc-desc">${s.description || ""}</p>
        <div class="dc-sc-price">₹${price} ${unit}</div>
        <button class="dc-sc-btn" onclick="selectFromGrid(${s.service_id})">
          <i class="fas fa-plus"></i> Select
        </button>
      </div>`;
    })
    .join("");
}

function selectFromGrid(serviceId) {
  const sel = document.getElementById("serviceSelect");
  if (!sel) return;
  sel.value = serviceId;
  sel.dispatchEvent(new Event("change"));
  document
    .getElementById("order-form")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
window.selectFromGrid = selectFromGrid;

// ============================================
// BIND EVENTS
// ============================================
function bindEvents() {
  document
    .getElementById("serviceSelect")
    ?.addEventListener("change", onServiceChange);
  document
    .getElementById("qtyMinus")
    ?.addEventListener("click", () => changeQty(-1));
  document
    .getElementById("qtyPlus")
    ?.addEventListener("click", () => changeQty(+1));
  document
    .getElementById("quantityInput")
    ?.addEventListener("input", onQtyInput);
  document
    .getElementById("quantityInput")
    ?.addEventListener("change", onQtyInput);
  document
    .getElementById("pickupDate")
    ?.addEventListener("change", updateSummary);
  document
    .getElementById("pickupTime")
    ?.addEventListener("change", updateSummary);

  // Add to Cart (unchanged)
  document
    .getElementById("addToCartBtn")
    ?.addEventListener("click", handleAddToCart);

  // Place Order → open preview modal
  document.getElementById("dryCleanForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    openOrderPreview();
  });

  // Login link
  document.getElementById("loginLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    openAuth("login");
  });

  // ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const dcPreview = document.getElementById("dcOrderPreviewOverlay");
      if (dcPreview?.classList.contains("active")) {
        dcPreview.classList.remove("active");
      }
    }
  });
}

// ============================================
// SERVICE CHANGE
// ============================================
function onServiceChange() {
  const sel = document.getElementById("serviceSelect");
  const box = document.getElementById("priceBox");
  const hint = document.getElementById("serviceHint");

  if (!sel.value) {
    selectedService = null;
    if (box) box.style.display = "none";
    if (hint) hint.textContent = "Select a garment to view pricing";
    updateSummary();
    return;
  }

  selectedService = servicesData.find((s) => s.service_id == sel.value);
  if (!selectedService) {
    const opt = sel.options[sel.selectedIndex];
    selectedService = {
      service_id: sel.value,
      service_name: opt.textContent.split("  —  ")[0].trim(),
      base_price: parseFloat(opt.dataset.price),
      price_unit: opt.dataset.unit,
      description: opt.dataset.desc,
      icon: opt.dataset.icon,
    };
  }

  if (box) box.style.display = "block";
  if (hint) hint.textContent = selectedService.description || "";

  refreshPrice();
  updateSummary();
}

// ============================================
// QUANTITY HANDLERS
// ============================================
function changeQty(delta) {
  const el = document.getElementById("quantityInput");
  if (!el) return;
  let v = parseInt(el.value) + delta;
  v = Math.max(1, Math.min(100, v));
  el.value = v;
  currentQty = v;
  updateQtyLabel();
  refreshPrice();
  updateSummary();
}

function onQtyInput() {
  const el = document.getElementById("quantityInput");
  if (!el) return;
  let v = parseInt(el.value);
  if (isNaN(v) || v < 1) v = 1;
  if (v > 100) v = 100;
  el.value = v;
  currentQty = v;
  updateQtyLabel();
  refreshPrice();
  updateSummary();
}

function updateQtyLabel() {
  const lbl = document.getElementById("qtyLabel");
  if (lbl)
    lbl.textContent = `${currentQty} item${
      currentQty !== 1 ? "s" : ""
    } selected`;
}

// ============================================
// PRICE DISPLAY
// ============================================
function refreshPrice() {
  if (!selectedService) return;
  const unit = parseFloat(selectedService.base_price) || 0;
  const total = unit * currentQty;
  const unitEl = document.getElementById("unitPriceDisplay");
  const totEl = document.getElementById("totalDisplay");
  const unitLbl = document.getElementById("unitDisplay");
  const descEl = document.getElementById("serviceDescText");
  if (unitEl) unitEl.textContent = `₹${unit.toFixed(0)}`;
  if (totEl) totEl.textContent = `₹${total.toFixed(0)}`;
  if (unitLbl) unitLbl.textContent = selectedService.price_unit || "per piece";
  if (descEl) descEl.textContent = selectedService.description || "";
}

// ============================================
// ORDER SUMMARY PANEL
// ============================================
function updateSummary() {
  const body = document.getElementById("summaryBody");
  if (!body) return;
  if (!selectedService) {
    body.innerHTML = `
      <div class="dc-summary-empty">
        <i class="fas fa-clipboard-list"></i>
        <p>Select a service to preview your order</p>
      </div>`;
    return;
  }
  const unit = parseFloat(selectedService.base_price) || 0;
  const total = unit * currentQty;
  const dateRaw = document.getElementById("pickupDate")?.value || "";
  const time = document.getElementById("pickupTime")?.value || "—";
  body.innerHTML = `
    <div class="dc-sum-row"><span>Service</span><strong>${
      selectedService.service_name
    }</strong></div>
    <div class="dc-sum-row"><span>Unit Price</span><strong>₹${unit.toFixed(
      0
    )} / ${selectedService.price_unit || "piece"}</strong></div>
    <div class="dc-sum-row"><span>Quantity</span><strong>${currentQty}</strong></div>
    <div class="dc-sum-row"><span>Pickup Date</span><strong>${
      dateRaw ? fmtDate(dateRaw) : "—"
    }</strong></div>
    <div class="dc-sum-row"><span>Pickup Time</span><strong>${time}</strong></div>
    <div class="dc-sum-total">
      <span class="dc-sum-total-label">Total</span>
      <span class="dc-sum-total-val">₹${total.toFixed(0)}</span>
    </div>`;
}

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ============================================
// AUTH CHECK
// ============================================
function checkAuth() {
  const loggedIn = store.get("isLoggedIn") === "true";
  const notice = document.getElementById("loginNotice");
  if (notice) notice.style.display = loggedIn ? "none" : "block";
}

// ============================================
// VALIDATE FORM
// ============================================
function validate() {
  const sel = document.getElementById("serviceSelect");
  const qty = document.getElementById("quantityInput");
  const date = document.getElementById("pickupDate");
  const time = document.getElementById("pickupTime");
  const addr = document.getElementById("pickupAddress");

  if (!sel?.value) {
    showDcNotif("Please select a service", "error");
    sel?.focus();
    return false;
  }
  if (!qty?.value || +qty.value < 1) {
    showDcNotif("Please enter a valid quantity", "error");
    return false;
  }
  if (!date?.value) {
    showDcNotif("Please select a pickup date", "error");
    date?.focus();
    return false;
  }
  if (!isDateInWindow(date.value)) {
    showDcNotif(
      "⚠️ Pickup date must be within the next 5 days (tomorrow to +5 days).",
      "error"
    );
    date.focus();
    return false;
  }
  if (!time?.value) {
    showDcNotif("Please select a pickup time slot", "error");
    time?.focus();
    return false;
  }
  if (!addr?.value?.trim()) {
    showDcNotif("Please enter your pickup address", "error");
    addr?.focus();
    return false;
  }
  return true;
}

// ============================================
// BUILD PAYLOAD
// ============================================
function buildPayload() {
  return {
    serviceId: parseInt(document.getElementById("serviceSelect").value),
    serviceName: selectedService.service_name,
    quantity: parseInt(document.getElementById("quantityInput").value),
    unitPrice: parseFloat(selectedService.base_price),
    unit: selectedService.price_unit || "per piece",
    pickupDate: document.getElementById("pickupDate").value,
    pickupTime: document.getElementById("pickupTime").value,
    pickupAddress: document.getElementById("pickupAddress").value.trim(),
    specialInstructions:
      document.getElementById("specialInstructions")?.value?.trim() || "",
    categoryId: DRY_CLEAN_CATEGORY_ID,
    // kept for popup display
    service_name: selectedService.service_name,
    unit_price: parseFloat(selectedService.base_price),
    pickup_date: document.getElementById("pickupDate").value,
    pickup_time: document.getElementById("pickupTime").value,
  };
}

// ============================================
// ADD TO CART  (unchanged, still calls /api/cart/add)
// ============================================
async function handleAddToCart() {
  if (store.get("isLoggedIn") !== "true") {
    showDcNotif("Please login to add items to cart", "warning");
    setTimeout(() => openAuth("login"), 500);
    return;
  }
  if (!validate()) return;

  setLoading(
    "addToCartBtn",
    true,
    '<i class="fas fa-spinner fa-spin"></i> Adding...'
  );
  try {
    const payload = buildPayload();
    const res = await fetch(`${API_BASE}/cart/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${store.get("jwtToken")}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      store.remove("jwtToken");
      store.remove("isLoggedIn");
      showDcNotif("Session expired. Please login again.", "error");
      setTimeout(() => openAuth("login"), 800);
      return;
    }

    const data = await res.json();
    if (data.success) {
      showDcNotif(
        `✅ "${selectedService.service_name}" added to cart!`,
        "success"
      );
      if (typeof updateCartBadge === "function")
        setTimeout(updateCartBadge, 500);
    } else {
      throw new Error(data.message || data.error || "Failed");
    }
  } catch (err) {
    console.warn("Cart API error:", err.message);
    showDcNotif(err.message || "Failed to add to cart", "error");
  } finally {
    setLoading(
      "addToCartBtn",
      false,
      '<i class="fas fa-shopping-cart"></i> Add to Cart'
    );
  }
}

// ============================================
// INJECT ORDER PREVIEW MODAL  (iron-style)
// ============================================
function injectOrderPreviewModal() {
  if (document.getElementById("dcOrderPreviewOverlay")) return;

  const html = `
    <div id="dcOrderPreviewOverlay" class="iron-preview-overlay">
      <div class="iron-preview-modal">

        <!-- Header -->
        <div class="iron-preview-header">
          <div class="iron-preview-header-icon"><i class="fas fa-receipt"></i></div>
          <div>
            <h2>Order Summary</h2>
            <p>Review and confirm your order details</p>
          </div>
          <button class="iron-preview-close" onclick="document.getElementById('dcOrderPreviewOverlay').classList.remove('active')" aria-label="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Service Summary (read-only) -->
        <div class="iron-preview-section">
          <div class="iron-preview-section-title">
            <i class="fas fa-vest"></i> Service Details
          </div>
          <div id="dcPreviewServiceSummary" class="iron-preview-service-box"></div>
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
              <input type="text" id="dcPreviewCustomerName" placeholder="Your full name" />
            </div>
            <div class="iron-preview-form-group">
              <label><i class="fas fa-phone"></i> Phone Number *</label>
              <input type="tel" id="dcPreviewCustomerPhone" placeholder="10-digit mobile number" maxlength="10" />
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
            <textarea id="dcPreviewPickupAddress" rows="2" placeholder="Enter pickup address"></textarea>
          </div>
          <div class="iron-preview-form-row">
            <div class="iron-preview-form-group">
              <label><i class="fas fa-calendar"></i> Pickup Date *</label>
              <input type="date" id="dcPreviewPickupDate" />
            </div>
            <div class="iron-preview-form-group">
              <label><i class="fas fa-clock"></i> Pickup Time *</label>
              <select id="dcPreviewPickupTime">
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
            <textarea id="dcPreviewSpecialInstructions" rows="2" placeholder="E.g. handle with care, specific stain on collar…"></textarea>
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
              <select id="dcPreviewFoldPref">
                <option value="folded">Folded</option>
                <option value="hanged">On Hanger</option>
                <option value="any">No Preference</option>
              </select>
            </div>
            <div class="iron-preview-form-group">
              <label><i class="fas fa-spray-can"></i> Starch</label>
              <select id="dcPreviewStarchPref">
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
            <label class="iron-payment-option active" id="dcPayLabelCod">
              <input type="radio" name="dcPreviewPayment" value="cod" checked />
              <i class="fas fa-money-bill-wave"></i>
              <span>Cash on Delivery</span>
            </label>
            <label class="iron-payment-option" id="dcPayLabelOnline">
              <input type="radio" name="dcPreviewPayment" value="online" />
              <i class="fas fa-globe"></i>
              <span>Online Payment</span>
            </label>
          </div>
        </div>

        <!-- Error -->
        <div id="dcPreviewError" class="iron-preview-error" style="display:none;"></div>

        <!-- Footer -->
        <div class="iron-preview-footer">
          <button class="iron-preview-back-btn" onclick="document.getElementById('dcOrderPreviewOverlay').classList.remove('active')">
            <i class="fas fa-arrow-left"></i> Go Back
          </button>
          <button id="dcConfirmOrderBtn" class="iron-preview-confirm-btn">
            <i class="fas fa-check-circle"></i> Confirm Order
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);

  // Payment option toggle
  document
    .querySelectorAll('input[name="dcPreviewPayment"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        document
          .querySelectorAll("#dcOrderPreviewOverlay .iron-payment-option")
          .forEach((l) => l.classList.remove("active"));
        radio.closest(".iron-payment-option")?.classList.add("active");
      });
    });

  document
    .getElementById("dcConfirmOrderBtn")
    .addEventListener("click", confirmDryCleanOrder);

  // Inject shared preview-modal CSS (only once)
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
      .iron-preview-form-group input,.iron-preview-form-group select,.iron-preview-form-group textarea{padding:.6rem .8rem;border:1.5px solid var(--border-color,#e5e7eb);border-radius:8px;font-size:.88rem;background:var(--primary-bg,#fff);color:var(--text-primary,#111);transition:border-color .2s;}
      [data-theme="dark"] .iron-preview-form-group input,[data-theme="dark"] .iron-preview-form-group select,[data-theme="dark"] .iron-preview-form-group textarea{background:#2d1b69;border-color:rgba(167,139,250,.3);color:#e9d5ff;}
      .iron-preview-form-group input:focus,.iron-preview-form-group select:focus,.iron-preview-form-group textarea:focus{outline:none;border-color:#6b46c1;box-shadow:0 0 0 3px rgba(107,70,193,.1);}
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
// OPEN ORDER PREVIEW
// ============================================
function openOrderPreview() {
  if (store.get("isLoggedIn") !== "true") {
    showDcNotif("Please login to place an order", "warning");
    setTimeout(() => openAuth("login"), 500);
    return;
  }
  if (!validate()) return;

  const qty = currentQty;
  const unitPrice = parseFloat(selectedService.base_price);
  const totalPrice = (unitPrice * qty).toFixed(0);

  // Populate service summary
  document.getElementById("dcPreviewServiceSummary").innerHTML = `
    <div class="iron-preview-summary-row">
      <span><i class="${
        selectedService.icon || "fas fa-vest"
      }" style="color:#7c3aed;margin-right:6px;"></i>
        <b>Service:</b> ${selectedService.service_name}</span>
      <span class="iron-preview-price">₹${unitPrice.toFixed(0)} / ${
    selectedService.price_unit || "piece"
  }</span>
    </div>
    <div class="iron-preview-summary-row iron-preview-summary-total">
      <span><i class="fas fa-layer-group" style="color:#7c3aed;margin-right:6px;"></i>
        <b>Quantity:</b> ${qty} item${qty !== 1 ? "s" : ""}</span>
      <span class="iron-preview-total-amt">Total: ₹${totalPrice}</span>
    </div>
  `;

  // Pre-fill customer details
  const nameEl = document.getElementById("dcPreviewCustomerName");
  const phoneEl = document.getElementById("dcPreviewCustomerPhone");
  if (nameEl) nameEl.value = _profileName || store.get("userName") || "";
  if (phoneEl) phoneEl.value = _profilePhone || "";

  // Pre-fill pickup details — enforce 5-day window
  const previewDateEl = document.getElementById("dcPreviewPickupDate");
  if (previewDateEl) {
    const _today = new Date();
    const _tom = new Date(_today);
    _tom.setDate(_today.getDate() + 1);
    const _max = new Date(_today);
    _max.setDate(_today.getDate() + 5);
    const _fmt = (d) => d.toISOString().split("T")[0];
    previewDateEl.min = _fmt(_tom);
    previewDateEl.max = _fmt(_max);
    previewDateEl.value =
      document.getElementById("pickupDate")?.value || _fmt(_tom);
  }
  document.getElementById("dcPreviewPickupTime").value =
    document.getElementById("pickupTime")?.value || "";
  document.getElementById("dcPreviewPickupAddress").value =
    document.getElementById("pickupAddress")?.value || "";
  document.getElementById("dcPreviewSpecialInstructions").value =
    document.getElementById("specialInstructions")?.value || "";

  // Reset error
  const errEl = document.getElementById("dcPreviewError");
  if (errEl) errEl.style.display = "none";

  document.getElementById("dcOrderPreviewOverlay").classList.add("active");
}

// ============================================
// CONFIRM DRY CLEAN ORDER
// ============================================
async function confirmDryCleanOrder() {
  const jwtToken = store.get("jwtToken");
  if (!jwtToken) return;

  const name =
    document.getElementById("dcPreviewCustomerName")?.value.trim() || "";
  const phone =
    document.getElementById("dcPreviewCustomerPhone")?.value.trim() || "";
  const address = document
    .getElementById("dcPreviewPickupAddress")
    .value.trim();
  const date = document.getElementById("dcPreviewPickupDate").value;
  const time = document.getElementById("dcPreviewPickupTime").value;
  const payment =
    document.querySelector('input[name="dcPreviewPayment"]:checked')?.value ||
    "cod";
  const foldPref = document.getElementById("dcPreviewFoldPref")?.value || "any";
  const starchPref =
    document.getElementById("dcPreviewStarchPref")?.value || "none";
  const baseInstr = document
    .getElementById("dcPreviewSpecialInstructions")
    .value.trim();

  const prefParts = [];
  if (foldPref !== "any") prefParts.push(`Folding: ${foldPref}`);
  if (starchPref !== "none") prefParts.push(`Starch: ${starchPref}`);
  if (baseInstr) prefParts.push(baseInstr);
  const specialInstructions = prefParts.join(" | ");

  const showErr = (msg) => {
    const el = document.getElementById("dcPreviewError");
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
  if (!isDateInWindow(date))
    return showErr(
      "⚠️ Pickup date must be within the next 5 days (tomorrow to +5 days)."
    );
  if (!time) return showErr("Please select a pickup time.");

  // Online payment → show QR modal first
  if (payment === "online") {
    document.getElementById("dcOrderPreviewOverlay").classList.remove("active");
    showDryCleanQRModal({
      name,
      phone,
      address,
      date,
      time,
      serviceId: selectedService.service_id,
      serviceName: selectedService.service_name,
      unit: selectedService.price_unit || "per piece",
      quantity: currentQty,
      unitPrice: parseFloat(selectedService.base_price),
      specialInstructions,
      totalAmount: parseFloat(selectedService.base_price) * currentQty,
    });
    const btn = document.getElementById("dcConfirmOrderBtn");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Order';
    }
    return;
  }

  // COD → place order directly
  const orderData = {
    serviceId: selectedService.service_id,
    serviceName: selectedService.service_name,
    quantity: currentQty,
    unitPrice: parseFloat(selectedService.base_price),
    unit: selectedService.price_unit || "per piece",
    pickupDate: date,
    pickupTime: time,
    pickupAddress: address,
    specialInstructions: specialInstructions,
    paymentMethod: "cod",
    categoryId: DRY_CLEAN_CATEGORY_ID,
  };

  const confirmBtn = document.getElementById("dcConfirmOrderBtn");
  const origText = confirmBtn?.innerHTML || "";
  if (confirmBtn) {
    confirmBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Placing Order...';
    confirmBtn.disabled = true;
  }

  try {
    const response = await fetch(`${API_BASE}/orders/place`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(orderData),
    });
    const result = await response.json();

    if (response.status === 401) {
      store.remove("jwtToken");
      store.remove("isLoggedIn");
      document
        .getElementById("dcOrderPreviewOverlay")
        .classList.remove("active");
      showDcNotif("Session expired. Please login again.", "error");
      setTimeout(() => openAuth("login"), 800);
      return;
    }

    if (result.success) {
      document
        .getElementById("dcOrderPreviewOverlay")
        .classList.remove("active");

      // ── Trigger order-placed email to customer ──
      const customerEmail = store.get("userEmail") || "";
      if (customerEmail) {
        fetch(`${API_BASE}/email/order-placed`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwtToken}`,
          },
          body: JSON.stringify({
            orderNumber: result.data?.orderNumber,
            customerName: name,
            customerEmail,
            serviceName: selectedService.service_name,
            quantity: currentQty,
            totalAmount: result.data?.totalAmount,
            pickupDate: date,
            pickupTime: time,
            pickupAddress: address,
            paymentMethod: "cod",
          }),
        }).catch(() => {}); // fire-and-forget; don't block UI
      }

      showDryCleanOrderConfirmation({
        orderNumber: result.data?.orderNumber,
        serviceName: selectedService.service_name,
        pickup_date: date,
        pickup_time: time,
        quantity: currentQty,
        totalAmount: result.data?.totalAmount,
        pickup_address: address,
        customerEmail,
      });
      doResetForm();
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
// QR PAYMENT MODAL  (iron-style)
// ============================================
function showDryCleanQRModal(data) {
  document.getElementById("dcQRPaymentModal")?.remove();

  const amount = (data.totalAmount || 0).toFixed(2);
  const upiId = "9173576732@ybl";
  const upiLink = `upi://pay?pa=${upiId}&pn=QuickLaundry&am=${amount}&cu=INR&tn=DryCleanOrder`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    upiLink
  )}`;

  const modal = document.createElement("div");
  modal.id = "dcQRPaymentModal";
  modal.className = "iqm";
  modal.innerHTML = `
    <div class="iqm__backdrop"></div>
    <div class="iqm__box">
      <div class="iqm__header">
        <div class="iqm__header-icon"><i class="fas fa-qrcode"></i></div>
        <div><h2>Scan &amp; Pay</h2><p>Complete payment to confirm order</p></div>
        <button class="iqm__close" id="dcIqmClose"><i class="fas fa-times"></i></button>
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
      <div id="dcIqmError" class="iqm__error" style="display:none;"></div>
      <div class="iqm__footer">
        <button class="iqm__btn iqm__btn--back" id="dcIqmBack"><i class="fas fa-arrow-left"></i> Go Back</button>
        <button class="iqm__btn iqm__btn--paid" id="dcIqmPaid"><i class="fas fa-check-circle"></i> I've Paid ₹${amount}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("iqm--open"));

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
  document.getElementById("dcIqmClose").onclick = closeQR;
  document.getElementById("dcIqmBack").onclick = closeQR;
  modal.querySelector(".iqm__backdrop").onclick = closeQR;
  document.getElementById("dcIqmPaid").onclick = () =>
    placeDryCleanOrderAfterPayment(data);
}

// ============================================
// PLACE ORDER AFTER QR PAYMENT
// ============================================
async function placeDryCleanOrderAfterPayment(data) {
  const jwtToken = store.get("jwtToken");
  if (!jwtToken) return;

  const btn = document.getElementById("dcIqmPaid");
  const errEl = document.getElementById("dcIqmError");
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
    categoryId: DRY_CLEAN_CATEGORY_ID,
  };

  try {
    const response = await fetch(`${API_BASE}/orders/place`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(orderData),
    });
    const result = await response.json();

    if (response.status === 401) {
      store.remove("jwtToken");
      store.remove("isLoggedIn");
      const modal = document.getElementById("dcQRPaymentModal");
      if (modal) {
        modal.classList.remove("iqm--open");
        setTimeout(() => modal.remove(), 300);
      }
      showDcNotif("Session expired. Please login again.", "error");
      setTimeout(() => openAuth("login"), 800);
      return;
    }

    if (result.success) {
      const modal = document.getElementById("dcQRPaymentModal");
      if (modal) {
        modal.classList.remove("iqm--open");
        setTimeout(() => modal.remove(), 300);
      }
      showDryCleanOrderConfirmation({
        orderNumber: result.data?.orderNumber,
        serviceName: data.serviceName,
        pickup_date: data.date,
        pickup_time: data.time,
        quantity: data.quantity,
        totalAmount: result.data?.totalAmount,
        pickup_address: data.address,
        paymentMethod: "online",
      });
      doResetForm();
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
    console.error("❌ Dry clean QR payment error:", err);
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
// ORDER CONFIRMATION POPUP — ENHANCED
// Email notice + What-next delivery steps
// ============================================
function showDryCleanOrderConfirmation(orderData) {
  document.getElementById("dcOrderConfirmationModal")?.remove();

  const emailLine = orderData.customerEmail
    ? `<div class="dcconf-email-notice">
         <i class="fas fa-envelope-open-text"></i>
         <div>
           <strong>Confirmation email sent!</strong>
           <span>Check your inbox at <em>${orderData.customerEmail}</em></span>
         </div>
       </div>`
    : "";

  const modal = document.createElement("div");
  modal.className = "dcconf-overlay";
  modal.id = "dcOrderConfirmationModal";
  modal.innerHTML = `
    <div class="dcconf-content">
      <div class="dcconf-icon-wrap">
        <div class="dcconf-ring"></div>
        <div class="dcconf-check"><i class="fas fa-check"></i></div>
      </div>
      <h2 class="dcconf-title">Order Placed! 🎉</h2>
      <p class="dcconf-sub">Your dry clean order has been confirmed.</p>
      ${emailLine}
      <div class="dcconf-details">
        ${
          orderData.orderNumber
            ? `<div class="dcconf-row"><i class="fas fa-hashtag"></i><span>Order <strong>#${orderData.orderNumber}</strong></span></div>`
            : ""
        }
        ${
          orderData.serviceName
            ? `<div class="dcconf-row"><i class="fas fa-vest"></i><span>${orderData.serviceName}</span></div>`
            : ""
        }
        <div class="dcconf-row"><i class="fas fa-calendar-alt"></i><span>Pickup: <strong>${
          orderData.pickup_date || "TBD"
        }</strong> &nbsp;|&nbsp; ${orderData.pickup_time || "TBD"}</span></div>
        <div class="dcconf-row"><i class="fas fa-layer-group"></i><span>${
          orderData.quantity || 0
        } item${(orderData.quantity || 0) !== 1 ? "s" : ""}</span></div>
        ${
          orderData.totalAmount
            ? `<div class="dcconf-row dcconf-total"><i class="fas fa-rupee-sign"></i><span>Total: ₹${orderData.totalAmount}</span></div>`
            : ""
        }
        <div class="dcconf-row"><i class="fas fa-map-marker-alt"></i><span>${
          orderData.pickup_address || ""
        }</span></div>
      </div>
      <div class="dcconf-next">
        <p class="dcconf-next-title"><i class="fas fa-road"></i> What happens next?</p>
        <div class="dcconf-step"><div class="dcconf-step-dot done"></div><div><strong>Order Confirmed</strong><span>We received your order</span></div></div>
        <div class="dcconf-step"><div class="dcconf-step-dot pending"></div><div><strong>Admin Approval Email</strong><span>Admin confirms & sends approval email to you</span></div></div>
        <div class="dcconf-step"><div class="dcconf-step-dot pending"></div><div><strong>Delivery Boy Assigned</strong><span>You will get an email with the delivery boy name</span></div></div>
        <div class="dcconf-step"><div class="dcconf-step-dot pending"></div><div><strong>Pickup</strong><span>Clothes collected from your address</span></div></div>
      </div>
      <div class="dcconf-actions">
        <button class="dcconf-btn dcconf-btn-sec"
          onclick="document.getElementById('dcOrderConfirmationModal').remove();document.body.style.overflow='';">
          <i class="fas fa-plus"></i> Order More
        </button>
        <a href="orders.html" style="flex:1;text-decoration:none;">
          <button class="dcconf-btn dcconf-btn-pri" style="width:100%;">
            <i class="fas fa-list"></i> View My Orders
          </button>
        </a>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  if (!document.getElementById("dcconf-styles")) {
    const style = document.createElement("style");
    style.id = "dcconf-styles";
    style.textContent = `
      .dcconf-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:10000;padding:1rem;animation:dcconfFadeIn .3s ease;}
      .dcconf-content{background:var(--primary-bg,#fff);border:1.5px solid rgba(107,70,193,.25);border-radius:22px;padding:1.75rem 1.5rem 1.4rem;max-width:400px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:dcconfSlideUp .4s cubic-bezier(.34,1.56,.64,1);overflow-y:auto;max-height:90vh;}
      [data-theme="dark"] .dcconf-content{background:#120d22;border-color:rgba(167,139,250,.3);}
      .dcconf-icon-wrap{position:relative;width:76px;height:76px;margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;}
      .dcconf-ring{position:absolute;inset:0;border-radius:50%;border:3px solid rgba(16,185,129,.3);animation:dcconfRing 1.4s ease infinite;}
      .dcconf-check{width:64px;height:64px;background:linear-gradient(135deg,#10b981,#059669);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.7rem;color:#fff;box-shadow:0 8px 24px rgba(16,185,129,.4);animation:dcconfPop .5s cubic-bezier(.34,1.56,.64,1) .1s backwards;}
      .dcconf-title{font-size:1.35rem;font-weight:900;color:var(--text-primary,#111);margin:0 0 .3rem;}
      .dcconf-sub{font-size:.85rem;color:var(--text-secondary,#6b7280);margin:0 0 1rem;}
      .dcconf-email-notice{display:flex;align-items:flex-start;gap:.75rem;padding:.75rem 1rem;background:linear-gradient(135deg,rgba(59,130,246,.08),rgba(99,102,241,.06));border:1.5px solid rgba(59,130,246,.2);border-radius:12px;margin-bottom:1rem;text-align:left;}
      .dcconf-email-notice i{color:#3b82f6;font-size:1.2rem;flex-shrink:0;margin-top:2px;}
      .dcconf-email-notice strong{display:block;font-size:.85rem;font-weight:800;color:var(--text-primary,#111);margin-bottom:2px;}
      .dcconf-email-notice span{font-size:.78rem;color:var(--text-secondary,#6b7280);}
      .dcconf-email-notice em{font-style:normal;color:#3b82f6;font-weight:600;}
      .dcconf-details{background:var(--secondary-bg,#f9fafb);border-radius:12px;padding:.8rem 1rem;margin-bottom:1rem;text-align:left;}
      [data-theme="dark"] .dcconf-details{background:rgba(255,255,255,.04);}
      .dcconf-row{display:flex;align-items:flex-start;gap:.6rem;padding:.3rem 0;font-size:.83rem;color:var(--text-primary,#111);font-weight:500;border-bottom:1px dashed rgba(0,0,0,.06);}
      [data-theme="dark"] .dcconf-row{border-color:rgba(255,255,255,.06);}
      .dcconf-row:last-child{border-bottom:none;}
      .dcconf-row i{color:#6b46c1;font-size:.85rem;flex-shrink:0;margin-top:2px;}
      .dcconf-total{font-weight:800;}
      .dcconf-total span{font-weight:900;color:#6b46c1;}
      .dcconf-next{text-align:left;margin-bottom:1.1rem;}
      .dcconf-next-title{font-size:.8rem;font-weight:800;color:#6b46c1;text-transform:uppercase;letter-spacing:.06em;margin:0 0 .6rem;display:flex;align-items:center;gap:.4rem;}
      .dcconf-step{display:flex;align-items:flex-start;gap:.75rem;margin-bottom:.55rem;}
      .dcconf-step-dot{width:14px;height:14px;border-radius:50%;flex-shrink:0;margin-top:3px;}
      .dcconf-step-dot.done{background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 2px 8px rgba(16,185,129,.4);}
      .dcconf-step-dot.pending{background:var(--border-color,#e5e7eb);border:2px dashed #a78bfa;}
      .dcconf-step strong{display:block;font-size:.82rem;font-weight:700;color:var(--text-primary,#111);}
      .dcconf-step span{font-size:.75rem;color:var(--text-secondary,#6b7280);}
      .dcconf-actions{display:flex;gap:.75rem;}
      .dcconf-btn{display:flex;align-items:center;justify-content:center;gap:.4rem;padding:.7rem 1rem;border-radius:12px;font-size:.85rem;font-weight:700;cursor:pointer;border:none;transition:all .25s ease;}
      .dcconf-btn-pri{background:linear-gradient(135deg,#6b46c1,#a855f7);color:#fff;box-shadow:0 4px 14px rgba(107,70,193,.3);}
      .dcconf-btn-pri:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(107,70,193,.4);}
      .dcconf-btn-sec{flex:1;background:var(--secondary-bg,#f3f4f6);color:var(--text-primary,#111);border:1.5px solid var(--border-color,#e5e7eb);}
      .dcconf-btn-sec:hover{border-color:#6b46c1;}
      @keyframes dcconfFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes dcconfSlideUp{from{transform:translateY(40px) scale(.96);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
      @keyframes dcconfPop{from{transform:scale(0)}to{transform:scale(1)}}
      @keyframes dcconfRing{0%{transform:scale(.9);opacity:1}100%{transform:scale(1.5);opacity:0}}
    `;
    document.head.appendChild(style);
  }
}

// ============================================
// RESET FORM AFTER ORDER
// ============================================
function doResetForm() {
  document.getElementById("serviceSelect").value = "";
  document.getElementById("quantityInput").value = 1;
  document.getElementById("pickupTime").value = "";
  document.getElementById("specialInstructions") &&
    (document.getElementById("specialInstructions").value = "");
  selectedService = null;
  currentQty = 1;
  setMinDate();
  const box = document.getElementById("priceBox");
  if (box) box.style.display = "none";
  const hint = document.getElementById("serviceHint");
  if (hint) hint.textContent = "Select a garment to view pricing";
  updateQtyLabel();
  updateSummary();
  // Re-fill address from profile
  setTimeout(loadUserProfile, 400);
}

// ============================================
// AUTH MODAL INTEGRATION
// ============================================
function setupAuth() {
  document
    .getElementById("authModalClose")
    ?.addEventListener("click", closeAuth);
  document
    .getElementById("authModalOverlay")
    ?.addEventListener("click", (e) => {
      if (e.target.id === "authModalOverlay") closeAuth();
    });
  window.addEventListener("message", ({ data: msg = {} }) => {
    if (!msg.type) return;
    if (msg.type === "CLOSE_MODAL") closeAuth();
    if (msg.type === "SWITCH_TO_REGISTRATION") {
      const f = document.getElementById("authIframe");
      if (f) f.src = "registration.html";
    }
    if (msg.type === "SWITCH_TO_LOGIN") {
      const f = document.getElementById("authIframe");
      if (f) f.src = "login.html";
    }
    if (msg.type === "AUTH_SUCCESS") onAuthSuccess(msg.data);
  });
}

function openAuth(page = "login") {
  const overlay = document.getElementById("authModalOverlay");
  const iframe = document.getElementById("authIframe");
  if (!overlay || !iframe) return;
  iframe.src = page === "login" ? "login.html" : "registration.html";
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeAuth() {
  const overlay = document.getElementById("authModalOverlay");
  const iframe = document.getElementById("authIframe");
  if (overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }
  if (iframe) iframe.src = "about:blank";
}

function onAuthSuccess(userData) {
  if (!userData) return;
  store.set("isLoggedIn", "true");
  store.set("userName", userData.userName || "User");
  store.set("userEmail", userData.userEmail || "");
  store.set("jwtToken", userData.token || "demo_" + Date.now());
  closeAuth();
  checkAuth();
  if (typeof checkAuthState === "function") checkAuthState();
  if (typeof checkSidebarAuthState === "function") checkSidebarAuthState();
  window.dispatchEvent(new CustomEvent("loginSuccess", { detail: userData }));
  showDcNotif(`Welcome back, ${userData.userName || "User"}! 👋`, "success");
}

window.openAuthModal = openAuth;
window.closeAuthModal = closeAuth;

// ─── Loading state helper ──────────────────────
function setLoading(id, on, label) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.innerHTML = label;
  btn.disabled = on;
}

// ============================================
// NOTIFICATION
// ============================================
function showDcNotif(msg, type = "info") {
  document.querySelector(".dc-notification")?.remove();
  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
  };
  const icons = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    warning: "fa-exclamation-triangle",
    info: "fa-info-circle",
  };
  const n = document.createElement("div");
  n.className = "dc-notification";
  n.style.cssText = `
    position:fixed;top:100px;right:20px;background:${
      colors[type] || colors.info
    };color:#fff;
    padding:1rem 1.5rem;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);
    display:flex;align-items:center;gap:10px;font-weight:600;z-index:10000;
    animation:dcSlideIn .3s ease;max-width:380px;
  `;
  n.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${msg}`;
  document.body.appendChild(n);
  if (!document.getElementById("dc-notif-anim")) {
    const s = document.createElement("style");
    s.id = "dc-notif-anim";
    s.textContent = `@keyframes dcSlideIn{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}`;
    document.head.appendChild(s);
  }
  setTimeout(() => {
    n.style.transition = "all .3s ease";
    n.style.opacity = "0";
    n.style.transform = "translateX(350px)";
    setTimeout(() => n.remove(), 320);
  }, 3600);
}

// ─── Expose for error state retry button ──────
window.loadDryCleanServices = loadDryCleanServices;

console.log("✨ Dry Clean JS fully loaded — iron.js feature-parity achieved!");
