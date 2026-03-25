// ============================================
// ROLL PRESS PAGE - COMPLETE UPDATED JS
// ✅ Auto-fill address from profile
// ✅ Add to Cart → /api/cart/add
// ✅ Place Order → Order Summary Modal (editable)
// ✅ Online Payment → QR Modal
// ✅ Success → Congratulations Modal (iron page style)
// ✅ Live Order Summary box (inline + side panel)
// ✅ Delivery charge in summary
// ============================================

console.log("🎯 Roll Press Page JS Loading...");

const API_BASE = window.location.origin + "/api";
const ROLL_PRESS_CATEGORY_ID = 12;

// State
let servicesData = [];
let selectedService = null;
let currentQuantity = 1;
let userProfile = null;

// ============================================
// SAFE STORAGE
// ============================================
const storage = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  set: (key, v) => {
    try {
      localStorage.setItem(key, v);
    } catch (e) {}
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  },
};

// ============================================
// DOM READY
// ============================================
document.addEventListener("DOMContentLoaded", async function () {
  console.log("✅ Roll Press DOM Ready");
  setMinPickupDate();
  loadRollPressServices();
  setupEventListeners();
  setupAuthModal();
  checkLoginStatus();
  await fetchUserProfile();
});

// ============================================
// FETCH USER PROFILE → AUTO-FILL ADDRESS
// ============================================
async function fetchUserProfile() {
  const token = storage.get("jwtToken");
  if (!token || storage.get("isLoggedIn") !== "true") return;
  try {
    const res = await fetch(window.location.origin + "/api/profile/", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return;
    const result = await res.json();
    if (result.success && result.data?.user) {
      userProfile = result.data.user;
      preFillAddress();
    }
  } catch (e) {
    console.warn("⚠️ Could not fetch profile:", e);
  }
}

function preFillAddress() {
  if (!userProfile) return;
  const field = document.getElementById("pickupAddress");
  if (!field || field.value.trim() !== "") return;
  const parts = [
    userProfile.address,
    userProfile.city,
    userProfile.pincode,
  ].filter(Boolean);
  if (parts.length > 0) {
    field.value = parts.join(", ");
    const hint = document.getElementById("rpAddressHint");
    if (hint) hint.style.display = "inline-flex";
    console.log("✅ Address auto-filled");
  }
}

// ============================================
// SET MIN DATE
// ============================================
function setMinPickupDate() {
  const pickupDate = document.getElementById("pickupDate");
  if (!pickupDate) return;

  // Min = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Max = 5 days from today (inclusive)
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 5);

  pickupDate.min = tomorrow.toISOString().split("T")[0];
  pickupDate.max = maxDate.toISOString().split("T")[0];
  pickupDate.value = tomorrow.toISOString().split("T")[0];

  // Warn user if they try to pick beyond 5 days
  pickupDate.addEventListener("change", function () {
    const chosen = new Date(this.value);
    const maxAllowed = new Date();
    maxAllowed.setDate(maxAllowed.getDate() + 5);
    if (chosen > maxAllowed) {
      showRPNotification(
        "📅 Pickup can only be scheduled up to 5 days in advance.",
        "warning"
      );
      this.value = maxDate.toISOString().split("T")[0];
    }
  });
}

// ============================================
// LOAD SERVICES FROM BACKEND
// ============================================
async function loadRollPressServices() {
  const loadingState = document.getElementById("formLoadingState");
  const errorState = document.getElementById("formErrorState");
  const form = document.getElementById("rollPressForm");
  const serviceSelect = document.getElementById("serviceSelect");

  if (loadingState) loadingState.style.display = "flex";
  if (errorState) errorState.style.display = "none";
  if (form) form.style.display = "none";

  try {
    const response = await fetch(`${API_BASE}/roll-press/services`);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const data = await response.json();
    if (!data.success)
      throw new Error(data.message || "Failed to load services");

    servicesData = data.data || data.services || [];
    if (serviceSelect) {
      serviceSelect.innerHTML =
        '<option value="">-- Choose a Roll Press Service --</option>';
      servicesData.forEach((service) => {
        const opt = document.createElement("option");
        opt.value = service.service_id;
        opt.textContent = `${service.service_name} — ₹${parseFloat(
          service.base_price
        ).toFixed(0)}${service.price_unit ? " / " + service.price_unit : ""}`;
        opt.dataset.price = service.base_price;
        opt.dataset.unit = service.price_unit || "per piece";
        opt.dataset.desc = service.description || "";
        serviceSelect.appendChild(opt);
      });
    }
    if (loadingState) loadingState.style.display = "none";
    if (form) form.style.display = "flex";
  } catch (error) {
    console.error("❌ Error loading services:", error);
    loadFallbackServices();
    if (loadingState) loadingState.style.display = "none";
    if (form) form.style.display = "flex";
  }
}

// ============================================
// FALLBACK SERVICES
// ============================================
function loadFallbackServices() {
  const serviceSelect = document.getElementById("serviceSelect");
  if (!serviceSelect) return;
  servicesData = [
    {
      service_id: 57,
      service_name: "Saree",
      description: "Professional roll press for saree.",
      base_price: 70.0,
      price_unit: "per piece",
    },
    {
      service_id: 58,
      service_name: "Heavy Dupatta",
      description: "Professional roll press for heavy dupatta.",
      base_price: 50.0,
      price_unit: "per piece",
    },
  ];
  serviceSelect.innerHTML =
    '<option value="">-- Choose a Roll Press Service --</option>';
  servicesData.forEach((service) => {
    const opt = document.createElement("option");
    opt.value = service.service_id;
    opt.textContent = `${service.service_name} — ₹${parseFloat(
      service.base_price
    ).toFixed(0)} / ${service.price_unit}`;
    opt.dataset.price = service.base_price;
    opt.dataset.unit = service.price_unit;
    opt.dataset.desc = service.description;
    serviceSelect.appendChild(opt);
  });
  console.warn("⚠️ Loaded offline service data (API unavailable).");
}

// ============================================
// SETUP EVENT LISTENERS
// ============================================
function setupEventListeners() {
  const serviceSelect = document.getElementById("serviceSelect");
  const qtyMinus = document.getElementById("qtyMinus");
  const qtyPlus = document.getElementById("qtyPlus");
  const qtyInput = document.getElementById("quantityInput");
  const addToCartBtn = document.getElementById("addToCartBtn");
  const placeOrderBtn = document.getElementById("placeOrderBtn");
  const rollPressForm = document.getElementById("rollPressForm");
  const loginLink = document.getElementById("loginLinkInForm");

  if (serviceSelect) serviceSelect.addEventListener("change", onServiceChange);
  if (qtyMinus) qtyMinus.addEventListener("click", () => adjustQuantity(-1));
  if (qtyPlus) qtyPlus.addEventListener("click", () => adjustQuantity(1));
  if (qtyInput) qtyInput.addEventListener("input", onQuantityChange);
  if (qtyInput) qtyInput.addEventListener("change", onQuantityChange);
  if (addToCartBtn) addToCartBtn.addEventListener("click", handleAddToCart);
  if (placeOrderBtn) placeOrderBtn.addEventListener("click", handlePlaceOrder);
  if (loginLink)
    loginLink.addEventListener("click", (e) => {
      e.preventDefault();
      openAuthModal("login");
    });
  if (rollPressForm)
    rollPressForm.addEventListener("submit", (e) => e.preventDefault());

  document.addEventListener("change", function (e) {
    if (["pickupDate", "pickupTime"].includes(e.target.id))
      updateOrderSummary();
    if (e.target.name === "deliveryType") {
      updateOrderSummary();
      updateInlineSummary();
    }
  });
}

// ============================================
// SERVICE CHANGE
// ============================================
function onServiceChange() {
  const serviceSelect = document.getElementById("serviceSelect");
  const priceDisplay = document.getElementById("priceDisplay");
  const serviceHint = document.getElementById("serviceHint");
  const serviceDescDisplay = document.getElementById("serviceDescDisplay");

  if (!serviceSelect.value) {
    selectedService = null;
    if (priceDisplay) priceDisplay.style.display = "none";
    if (serviceHint)
      serviceHint.textContent = "Select a service to see pricing details";
    updateOrderSummary();
    updateInlineSummary();
    return;
  }

  selectedService = servicesData.find(
    (s) => s.service_id == serviceSelect.value
  );
  if (!selectedService) {
    const opt = serviceSelect.options[serviceSelect.selectedIndex];
    selectedService = {
      service_id: serviceSelect.value,
      service_name: opt.textContent.split(" — ")[0],
      base_price: parseFloat(opt.dataset.price),
      price_unit: opt.dataset.unit,
      description: opt.dataset.desc,
    };
  }

  if (priceDisplay) priceDisplay.style.display = "block";
  updatePriceDisplay();
  updateOrderSummary();
  updateInlineSummary();
  if (serviceHint) serviceHint.textContent = selectedService.description || "";
  if (serviceDescDisplay)
    serviceDescDisplay.textContent = selectedService.description || "";
}

// ============================================
// QUANTITY
// ============================================
function adjustQuantity(delta) {
  const qtyInput = document.getElementById("quantityInput");
  if (!qtyInput) return;
  let newVal = parseInt(qtyInput.value) + delta;
  if (newVal < 1) newVal = 1;
  if (newVal > 100) newVal = 100;
  qtyInput.value = newVal;
  currentQuantity = newVal;
  updatePriceDisplay();
  updateOrderSummary();
  updateInlineSummary();
}

function onQuantityChange() {
  const qtyInput = document.getElementById("quantityInput");
  if (!qtyInput) return;
  let val = parseInt(qtyInput.value);
  if (isNaN(val) || val < 1) val = 1;
  if (val > 100) val = 100;
  qtyInput.value = val;
  currentQuantity = val;
  updatePriceDisplay();
  updateOrderSummary();
  updateInlineSummary();
}

// ============================================
// UPDATE PRICE DISPLAY (top card)
// ============================================
function updatePriceDisplay() {
  if (!selectedService) return;
  const unitPrice = parseFloat(selectedService.base_price) || 0;
  const total = unitPrice * currentQuantity;
  const el_unit = document.getElementById("unitPriceDisplay");
  const el_total = document.getElementById("totalPriceDisplay");
  const el_uname = document.getElementById("unitDisplay");
  if (el_unit) el_unit.textContent = `₹${unitPrice.toFixed(0)}`;
  if (el_total) el_total.textContent = `₹${total.toFixed(0)}`;
  if (el_uname)
    el_uname.textContent = selectedService.price_unit || "per piece";
}

// ============================================
// DELIVERY CHARGE
// ============================================
function getDeliveryCharge() {
  const d = document.querySelector('input[name="deliveryType"]:checked');
  return d?.value === "express" ? 50 : 0;
}

// ============================================
// UPDATE SIDE PANEL ORDER SUMMARY
// ============================================
function updateOrderSummary() {
  const summaryBody = document.getElementById("summaryBody");
  if (!summaryBody) return;
  if (!selectedService) {
    summaryBody.innerHTML = `<div class="rp-summary-empty"><i class="fas fa-shopping-basket"></i><p>Select a service to see your order summary</p></div>`;
    return;
  }
  const unitPrice = parseFloat(selectedService.base_price) || 0;
  const deliveryCharge = getDeliveryCharge();
  const total = unitPrice * currentQuantity + deliveryCharge;
  const pickupDate = document.getElementById("pickupDate")?.value || "—";
  const pickupTime = document.getElementById("pickupTime")?.value || "—";

  summaryBody.innerHTML = `
    <div class="rp-summary-item"><span>Service</span><strong>${
      selectedService.service_name
    }</strong></div>
    <div class="rp-summary-item"><span>Unit Price</span><strong>₹${unitPrice.toFixed(
      0
    )} / ${selectedService.price_unit || "piece"}</strong></div>
    <div class="rp-summary-item"><span>Quantity</span><strong>${currentQuantity}</strong></div>
    <div class="rp-summary-item"><span>Delivery</span><strong>${
      deliveryCharge > 0 ? "₹" + deliveryCharge + " (Express)" : "Free"
    }</strong></div>
    <div class="rp-summary-item"><span>Pickup Date</span><strong>${
      pickupDate !== "—" ? formatDate(pickupDate) : "—"
    }</strong></div>
    <div class="rp-summary-item"><span>Pickup Time</span><strong>${pickupTime}</strong></div>
    <div class="rp-summary-total">
      <span class="rp-summary-total-label">Total Amount</span>
      <span class="rp-summary-total-amount">₹${total.toFixed(0)}</span>
    </div>`;
}

// ============================================
// UPDATE INLINE SUMMARY (inside form, iron-style)
// ============================================
function updateInlineSummary() {
  const el_service = document.getElementById("rps_service");
  const el_qty = document.getElementById("rps_qty");
  const el_price = document.getElementById("rps_price");
  const el_delivery = document.getElementById("rps_delivery");
  const el_total = document.getElementById("rps_total");
  if (!el_service) return;

  if (!selectedService) {
    if (el_service) el_service.textContent = "-";
    if (el_qty) el_qty.textContent = "-";
    if (el_price) el_price.textContent = "-";
    if (el_delivery) el_delivery.textContent = "Free";
    if (el_total) el_total.textContent = "₹0";
    return;
  }
  const unitPrice = parseFloat(selectedService.base_price) || 0;
  const deliveryCharge = getDeliveryCharge();
  const total = unitPrice * currentQuantity + deliveryCharge;
  if (el_service) el_service.textContent = selectedService.service_name;
  if (el_qty)
    el_qty.textContent = `${currentQuantity} piece${
      currentQuantity !== 1 ? "s" : ""
    }`;
  if (el_price)
    el_price.textContent = `₹${unitPrice.toFixed(0)} / ${
      selectedService.price_unit || "piece"
    }`;
  if (el_delivery)
    el_delivery.textContent =
      deliveryCharge > 0 ? `₹${deliveryCharge} (Express)` : "Free";
  if (el_total) el_total.textContent = `₹${total.toFixed(0)}`;
}

// ============================================
// FORMAT DATE
// ============================================
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ============================================
// CHECK LOGIN
// ============================================
function checkLoginStatus() {
  const isLoggedIn = storage.get("isLoggedIn") === "true";
  const loginNotice = document.getElementById("loginNotice");
  if (!isLoggedIn) {
    if (loginNotice) loginNotice.style.display = "block";
  } else {
    if (loginNotice) loginNotice.style.display = "none";
  }
}
window.addEventListener("loginSuccess", checkLoginStatus);
window.addEventListener("storage", function (e) {
  if (e.key === "isLoggedIn") checkLoginStatus();
});

// ============================================
// VALIDATE FORM
// ============================================
function validateForm() {
  const serviceSelect = document.getElementById("serviceSelect");
  const quantityInput = document.getElementById("quantityInput");
  const pickupDate = document.getElementById("pickupDate");
  const pickupTime = document.getElementById("pickupTime");
  const pickupAddress = document.getElementById("pickupAddress");

  if (!serviceSelect?.value) {
    showRPNotification("Please select a service", "error");
    serviceSelect?.focus();
    return false;
  }
  if (!quantityInput?.value || parseInt(quantityInput.value) < 1) {
    showRPNotification("Please enter a valid quantity", "error");
    return false;
  }
  if (!pickupDate?.value) {
    showRPNotification("Please select a pickup date", "error");
    pickupDate?.focus();
    return false;
  }
  if (!pickupTime?.value) {
    showRPNotification("Please select a pickup time", "error");
    pickupTime?.focus();
    return false;
  }
  if (!pickupAddress?.value?.trim()) {
    showRPNotification("Please enter your pickup address", "error");
    pickupAddress?.focus();
    return false;
  }
  return true;
}

// ============================================
// BUILD ORDER PAYLOAD
// ============================================
function buildOrderPayload() {
  const serviceSelect = document.getElementById("serviceSelect");
  const quantityInput = document.getElementById("quantityInput");
  const pickupDate = document.getElementById("pickupDate");
  const pickupTime = document.getElementById("pickupTime");
  const pickupAddress = document.getElementById("pickupAddress");
  const specialInstructions = document.getElementById("specialInstructions");

  const qty = parseInt(quantityInput.value);
  const unitPrice = parseFloat(selectedService.base_price);
  const deliveryCharge = getDeliveryCharge();
  const deliveryType =
    document.querySelector('input[name="deliveryType"]:checked')?.value ||
    "standard";
  const paymentMethod =
    document.querySelector('input[name="paymentMethod"]:checked')?.value ||
    "cod";

  return {
    serviceId: parseInt(serviceSelect.value),
    serviceName: selectedService.service_name,
    quantity: qty,
    unitPrice: unitPrice,
    unit: selectedService.price_unit || "per piece",
    totalPrice: unitPrice * qty + deliveryCharge,
    pickupDate: pickupDate.value,
    pickupTime: pickupTime.value,
    pickupAddress: pickupAddress.value.trim(),
    specialInstructions: specialInstructions?.value?.trim() || "",
    deliveryType,
    deliveryCharge,
    paymentMethod,
    service_name: selectedService.service_name,
    unit_price: unitPrice,
    pickup_date: pickupDate.value,
    pickup_time: pickupTime.value,
  };
}

// ============================================
// HANDLE ADD TO CART
// ============================================
async function handleAddToCart() {
  if (storage.get("isLoggedIn") !== "true") {
    showRPNotification("Please login to add items to cart", "warning");
    setTimeout(() => openAuthModal("login"), 500);
    return;
  }
  if (!validateForm()) return;

  const btn = document.getElementById("addToCartBtn");
  const orig = btn?.innerHTML || "";
  if (btn) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    btn.disabled = true;
  }

  try {
    const payload = buildOrderPayload();
    const token = storage.get("jwtToken");
    const response = await fetch(`${API_BASE}/cart/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (response.status === 401) {
      storage.remove("jwtToken");
      storage.remove("isLoggedIn");
      showRPNotification("Session expired. Please login again.", "error");
      setTimeout(() => openAuthModal("login"), 800);
      return;
    }
    if (data.success) {
      showCartSuccessModal(payload);
      if (typeof updateCartBadge === "function")
        setTimeout(updateCartBadge, 500);
    } else {
      throw new Error(data.message || "Failed to add to cart");
    }
  } catch (error) {
    console.error("❌ Add to cart error:", error);
    showRPNotification(error.message || "Failed to add to cart", "error");
  } finally {
    if (btn) {
      btn.innerHTML = orig;
      btn.disabled = false;
    }
  }
}

// ============================================
// HANDLE PLACE ORDER → Order Summary Modal
// ============================================
function handlePlaceOrder() {
  if (storage.get("isLoggedIn") !== "true") {
    showRPNotification("Please login to place an order", "warning");
    setTimeout(() => openAuthModal("login"), 500);
    return;
  }
  if (!validateForm()) return;
  showOrderSummaryModal(buildOrderPayload());
}

// ============================================
// ORDER SUMMARY MODAL (editable, iron-style)
// ============================================
function showOrderSummaryModal(data) {
  document.getElementById("rpOrderSummaryModal")?.remove();

  const userName = userProfile?.full_name || storage.get("userName") || "";
  const userPhone = userProfile?.phone || "";

  const timeOptions = [
    { v: "09:00-11:00", l: "9:00 AM – 11:00 AM" },
    { v: "11:00-13:00", l: "11:00 AM – 1:00 PM" },
    { v: "13:00-15:00", l: "1:00 PM – 3:00 PM" },
    { v: "15:00-17:00", l: "3:00 PM – 5:00 PM" },
    { v: "17:00-19:00", l: "5:00 PM – 7:00 PM" },
  ];
  const timeSelectHTML = timeOptions
    .map(
      (t) =>
        `<option value="${t.v}" ${data.pickupTime === t.v ? "selected" : ""}>${
          t.l
        }</option>`
    )
    .join("");

  const deliveryLabel =
    data.deliveryType === "express"
      ? "Express (24h) + ₹50"
      : data.deliveryType === "economy"
      ? "Economy (3-5 days)"
      : "Standard (48h)";
  const paymentLabel =
    data.paymentMethod === "online"
      ? "Online Payment (UPI)"
      : "Cash on Delivery";

  const modal = document.createElement("div");
  modal.id = "rpOrderSummaryModal";
  modal.className = "rp-osm";
  modal.innerHTML = `
    <div class="rp-osm__backdrop" id="rpOsmBackdrop"></div>
    <div class="rp-osm__box">
      <div class="rp-osm__head">
        <div class="rp-osm__head-left">
          <span class="rp-osm__head-icon"><i class="fas fa-receipt"></i></span>
          <div><h2>Order Summary</h2><p>Review and confirm your order</p></div>
        </div>
        <button class="rp-osm__close" id="rpOsmClose"><i class="fas fa-times"></i></button>
      </div>
      <div class="rp-osm__body">
        <div class="rp-osm__section">
          <div class="rp-osm__sec-title"><i class="fas fa-tshirt"></i> Service Details</div>
          <div class="rp-osm__info-card">
            <div class="rp-osm__row"><span>Service</span><strong>${
              data.serviceName
            }</strong></div>
            <div class="rp-osm__row"><span>Quantity</span><strong>${
              data.quantity
            } ${data.unit}</strong></div>
            <div class="rp-osm__row"><span>Price / item</span><strong>₹${data.unitPrice.toFixed(
              0
            )}</strong></div>
            <div class="rp-osm__row"><span>Delivery</span><strong>${
              data.deliveryCharge > 0
                ? "₹" + data.deliveryCharge + " (Express)"
                : "Free"
            }</strong></div>
            <div class="rp-osm__row rp-osm__row--total"><span>Total</span><strong class="rp-osm__total-val">₹${data.totalPrice.toFixed(
              0
            )}</strong></div>
          </div>
        </div>
        <div class="rp-osm__section">
          <div class="rp-osm__sec-title"><i class="fas fa-user"></i> Contact Details <span class="rp-osm__edit-tag">Editable</span></div>
          <div class="rp-osm__form-row">
            <div class="rp-osm__field"><label>Full Name</label><input id="rp_osm_name"  class="rp-osm__input" type="text" value="${userName}"  placeholder="Your full name" /></div>
            <div class="rp-osm__field"><label>Phone</label>    <input id="rp_osm_phone" class="rp-osm__input" type="text" value="${userPhone}" placeholder="10-digit mobile" /></div>
          </div>
        </div>
        <div class="rp-osm__section">
          <div class="rp-osm__sec-title"><i class="fas fa-map-marker-alt"></i> Pickup Details <span class="rp-osm__edit-tag">Editable</span></div>
          <div class="rp-osm__form-row">
            <div class="rp-osm__field"><label>Pickup Date</label><input id="rp_osm_date" class="rp-osm__input" type="date" value="${
              data.pickupDate
            }" min="${document.getElementById("pickupDate").min}" /></div>
            <div class="rp-osm__field"><label>Time Slot</label><select id="rp_osm_time" class="rp-osm__input">${timeSelectHTML}</select></div>
          </div>
          <div class="rp-osm__field" style="margin-top:1rem">
            <label>Pickup Address</label>
            <textarea id="rp_osm_address" class="rp-osm__input rp-osm__textarea" rows="2">${
              data.pickupAddress
            }</textarea>
          </div>
          <div class="rp-osm__field" style="margin-top:1rem">
            <label>Special Instructions (Optional)</label>
            <textarea id="rp_osm_instructions" class="rp-osm__input rp-osm__textarea" rows="2">${
              data.specialInstructions || ""
            }</textarea>
          </div>
        </div>
        <div class="rp-osm__section">
          <div class="rp-osm__sec-title"><i class="fas fa-sliders-h"></i> Preferences</div>
          <div class="rp-osm__prefs">
            <div class="rp-osm__pref"><i class="fas fa-truck"></i><span>${deliveryLabel}</span></div>
            <div class="rp-osm__pref"><i class="fas fa-wallet"></i><span>${paymentLabel}</span></div>
          </div>
        </div>
        <div id="rpOsmError" class="rp-osm__error" style="display:none;"></div>
      </div>
      <div class="rp-osm__foot">
        <button class="rp-osm__btn rp-osm__btn--back" id="rpOsmBack"><i class="fas fa-arrow-left"></i> Go Back</button>
        <button class="rp-osm__btn rp-osm__btn--confirm" id="rpOsmConfirm"><i class="fas fa-check-circle"></i> Confirm Order</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("rp-osm--open"));

  const closeModal = () => {
    modal.classList.remove("rp-osm--open");
    setTimeout(() => modal.remove(), 300);
  };
  document.getElementById("rpOsmClose").onclick = closeModal;
  document.getElementById("rpOsmBack").onclick = closeModal;
  document.getElementById("rpOsmBackdrop").onclick = closeModal;
  document.getElementById("rpOsmConfirm").onclick = () =>
    confirmRollPressOrder(data);
}

// ============================================
// CONFIRM ORDER
// ============================================
async function confirmRollPressOrder(originalData) {
  const token = storage.get("jwtToken");
  if (!token) return;

  const finalData = {
    ...originalData,
    customerName:
      document.getElementById("rp_osm_name")?.value?.trim() ||
      userProfile?.full_name ||
      "",
    customerPhone:
      document.getElementById("rp_osm_phone")?.value?.trim() ||
      userProfile?.phone ||
      "",
    pickupDate:
      document.getElementById("rp_osm_date")?.value || originalData.pickupDate,
    pickupTime:
      document.getElementById("rp_osm_time")?.value || originalData.pickupTime,
    pickupAddress:
      document.getElementById("rp_osm_address")?.value?.trim() ||
      originalData.pickupAddress,
    specialInstructions:
      document.getElementById("rp_osm_instructions")?.value?.trim() || "",
  };

  const showErr = (msg) => {
    const el = document.getElementById("rpOsmError");
    if (el) {
      el.textContent = msg;
      el.style.display = "block";
    }
  };

  if (!finalData.customerName) return showErr("Please enter your full name.");
  if (!finalData.customerPhone || finalData.customerPhone.length < 10)
    return showErr("Please enter a valid 10-digit phone number.");
  if (!finalData.pickupAddress) return showErr("Please enter pickup address.");
  if (!finalData.pickupDate) return showErr("Please select a pickup date.");
  if (!finalData.pickupTime) return showErr("Please select a pickup time.");

  // Online → QR modal
  if (finalData.paymentMethod === "online") {
    const osmModal = document.getElementById("rpOrderSummaryModal");
    if (osmModal) {
      osmModal.classList.remove("rp-osm--open");
      setTimeout(() => osmModal.remove(), 300);
    }
    showRPQRModal(finalData);
    return;
  }

  await placeRollPressOrderAPI(finalData);
}

// ============================================
// PLACE ORDER API
// ============================================
async function placeRollPressOrderAPI(finalData) {
  const token = storage.get("jwtToken");
  const confirmBtn = document.getElementById("rpOsmConfirm");
  const origText = confirmBtn?.innerHTML || "";
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Placing Order...';
  }

  try {
    const response = await fetch(`${API_BASE}/orders/place`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(finalData),
    });
    const result = await response.json();

    if (response.status === 401) {
      storage.remove("jwtToken");
      storage.remove("isLoggedIn");
      const modal = document.getElementById("rpOrderSummaryModal");
      if (modal) {
        modal.classList.remove("rp-osm--open");
        setTimeout(() => modal.remove(), 300);
      }
      showRPNotification("Session expired. Please login again.", "error");
      setTimeout(() => openAuthModal("login"), 800);
      return;
    }

    if (result.success) {
      const modal = document.getElementById("rpOrderSummaryModal");
      if (modal) {
        modal.classList.remove("rp-osm--open");
        setTimeout(() => modal.remove(), 300);
      }
      showRPSuccessModal({
        orderId:
          result.data?.order_id ||
          result.data?.orderId ||
          result.data?.orderNumber ||
          "RP" + Date.now(),
        pickupDate: finalData.pickupDate,
        pickupTime: finalData.pickupTime,
        quantity: finalData.quantity,
        unit: finalData.unit || "piece",
        totalPrice: result.data?.totalAmount || finalData.totalPrice,
        pickupAddress: finalData.pickupAddress,
        paymentMethod: finalData.paymentMethod,
      });
      resetForm();
    } else {
      const el = document.getElementById("rpOsmError");
      if (el) {
        el.textContent = result.message || "Failed to place order.";
        el.style.display = "block";
      }
    }
  } catch (err) {
    console.error("❌ Place order error:", err);
    const el = document.getElementById("rpOsmError");
    if (el) {
      el.textContent = "Network error. Please try again.";
      el.style.display = "block";
    }
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = origText;
    }
  }
}

// ============================================
// QR PAYMENT MODAL
// ============================================
function showRPQRModal(finalData) {
  document.getElementById("rpQRModal")?.remove();
  const amount = (finalData.totalPrice || 0).toFixed(0);
  const upiId = "quicklaundry@upi"; // 🔁 Replace with your real UPI ID
  const upiLink = `upi://pay?pa=${upiId}&pn=QuickLaundry&am=${amount}&cu=INR&tn=RollPressOrder`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    upiLink
  )}`;

  const modal = document.createElement("div");
  modal.id = "rpQRModal";
  modal.className = "rp-qpm";
  modal.innerHTML = `
    <div class="rp-qpm__backdrop"></div>
    <div class="rp-qpm__box">
      <div class="rp-qpm__header">
        <div class="rp-qpm__header-icon"><i class="fas fa-qrcode"></i></div>
        <div><h2>Scan &amp; Pay</h2><p>Complete payment to confirm order</p></div>
        <button class="rp-qpm__close" id="rpQpmClose"><i class="fas fa-times"></i></button>
      </div>
      <div class="rp-qpm__amount">
        <span class="rp-qpm__amount-label">Amount to Pay</span>
        <span class="rp-qpm__amount-value">₹${amount}</span>
      </div>
      <div class="rp-qpm__qr-wrapper">
        <img src="${qrImgUrl}" alt="UPI QR Code" class="rp-qpm__qr-img"
             onerror="this.src='https://placehold.co/200x200/6b46c1/white?text=QR+Code'" />
        <div class="rp-qpm__qr-hint"><i class="fas fa-mobile-alt"></i> Scan with PhonePe, GPay, Paytm or any UPI app</div>
      </div>
      <div class="rp-qpm__upi-row">
        <span class="rp-qpm__upi-label">UPI ID:</span>
        <span class="rp-qpm__upi-id">${upiId}</span>
        <button class="rp-qpm__copy-btn" onclick="navigator.clipboard.writeText('${upiId}').then(()=>{ this.innerHTML='<i class=\\"fas fa-check\\"></i> Copied!'; setTimeout(()=>{ this.innerHTML='<i class=\\"fas fa-copy\\"></i> Copy'; },2000); })">
          <i class="fas fa-copy"></i> Copy
        </button>
      </div>
      <div class="rp-qpm__steps">
        <div class="rp-qpm__step"><span class="rp-qpm__step-num">1</span><span>Open your UPI app</span></div>
        <div class="rp-qpm__step"><span class="rp-qpm__step-num">2</span><span>Scan the QR code above</span></div>
        <div class="rp-qpm__step"><span class="rp-qpm__step-num">3</span><span>Pay ₹${amount} &amp; click below</span></div>
      </div>
      <div id="rpQpmError" class="rp-qpm__error" style="display:none;"></div>
      <div class="rp-qpm__footer">
        <button class="rp-qpm__btn rp-qpm__btn--back" id="rpQpmBack"><i class="fas fa-arrow-left"></i> Go Back</button>
        <button class="rp-qpm__btn rp-qpm__btn--paid" id="rpQpmPaid"><i class="fas fa-check-circle"></i> I've Paid ₹${amount}</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("rp-qpm--open"));

  const closeModal = () => {
    modal.classList.remove("rp-qpm--open");
    setTimeout(() => modal.remove(), 300);
  };
  document.getElementById("rpQpmClose").onclick = closeModal;
  document.getElementById("rpQpmBack").onclick = closeModal;
  modal.querySelector(".rp-qpm__backdrop").onclick = closeModal;
  document.getElementById("rpQpmPaid").onclick = () =>
    placeRollPressAfterPayment(finalData);
}

// ============================================
// PLACE ORDER AFTER QR PAYMENT
// ============================================
async function placeRollPressAfterPayment(finalData) {
  const token = storage.get("jwtToken");
  const btn = document.getElementById("rpQpmPaid");
  const errEl = document.getElementById("rpQpmError");

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming...';
  }
  if (errEl) errEl.style.display = "none";

  const orderData = {
    ...finalData,
    paymentMethod: "online",
    paymentStatus: "pending_verification",
  };

  try {
    const response = await fetch(`${API_BASE}/orders/place`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderData),
    });
    const result = await response.json();

    if (result.success) {
      const qModal = document.getElementById("rpQRModal");
      if (qModal) {
        qModal.classList.remove("rp-qpm--open");
        setTimeout(() => qModal.remove(), 300);
      }
      showRPSuccessModal({
        orderId:
          result.data?.order_id ||
          result.data?.orderId ||
          result.data?.orderNumber ||
          "RP" + Date.now(),
        pickupDate: finalData.pickupDate,
        pickupTime: finalData.pickupTime,
        quantity: finalData.quantity,
        unit: finalData.unit || "piece",
        totalPrice: result.data?.totalAmount || finalData.totalPrice,
        pickupAddress: finalData.pickupAddress,
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
        btn.innerHTML = `<i class="fas fa-check-circle"></i> I've Paid ₹${amount}`;
      }
    }
  } catch (err) {
    console.error("❌ QR payment error:", err);
    if (errEl) {
      errEl.textContent = "Network error. Please try again.";
      errEl.style.display = "block";
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-check-circle"></i> I've Paid ₹${(
        finalData.totalPrice || 0
      ).toFixed(0)}`;
    }
  }
}

// ============================================
// CART SUCCESS MODAL
// ============================================
function showCartSuccessModal(payload) {
  document.getElementById("rpCartSuccessModal")?.remove();
  const modal = document.createElement("div");
  modal.id = "rpCartSuccessModal";
  modal.className = "rp-csm";
  modal.innerHTML = `
    <div class="rp-csm__backdrop"></div>
    <div class="rp-csm__box">
      <div class="rp-csm__icon"><i class="fas fa-shopping-cart"></i></div>
      <h3>Added to Cart! 🛒</h3>
      <p>${payload.serviceName} (${payload.quantity} ${payload.unit}) added to your cart.</p>
      <div class="rp-csm__actions">
        <button class="rp-csm__btn rp-csm__btn--view" onclick="window.location.href='cart.html'"><i class="fas fa-shopping-cart"></i> View Cart</button>
        <button class="rp-csm__btn rp-csm__btn--cont" id="rpCsmClose"><i class="fas fa-plus"></i> Continue</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("rp-csm--open"));
  const closeIt = () => {
    modal.classList.remove("rp-csm--open");
    setTimeout(() => modal.remove(), 300);
  };
  document.getElementById("rpCsmClose").onclick = closeIt;
  modal.querySelector(".rp-csm__backdrop").onclick = closeIt;
  setTimeout(closeIt, 6000);
}

// ============================================
// SUCCESS MODAL (iron page style)
// ============================================
function showRPSuccessModal(data) {
  document.getElementById("rpSuccessModal")?.remove();
  const modal = document.createElement("div");
  modal.id = "rpSuccessModal";
  modal.className = "rp-cgm";
  modal.innerHTML = `
    <div class="rp-cgm__backdrop"></div>
    <div class="rp-cgm__box">
      <div class="rp-cgm__check"><i class="fas fa-check"></i></div>
      <h2 class="rp-cgm__title">Order Placed Successfully! 🎉</h2>
      <p class="rp-cgm__sub">Your roll press order has been confirmed.</p>
      <div class="rp-cgm__details">
        ${
          data.orderId
            ? `<div class="rp-cgm__detail-item"><i class="fas fa-hashtag"></i><span>Order #: ${data.orderId}</span></div>`
            : ""
        }
        ${
          data.pickupDate
            ? `<div class="rp-cgm__detail-item"><i class="fas fa-calendar"></i><span>Pickup Date: ${data.pickupDate}</span></div>`
            : ""
        }
        ${
          data.pickupTime
            ? `<div class="rp-cgm__detail-item"><i class="fas fa-clock"></i><span>Pickup Time: ${data.pickupTime}</span></div>`
            : ""
        }
        <div class="rp-cgm__detail-item"><i class="fas fa-tshirt"></i><span>Quantity: ${
          data.quantity
        } ${data.unit}${data.quantity !== 1 ? "s" : ""}</span></div>
        ${
          data.totalPrice
            ? `<div class="rp-cgm__detail-item"><i class="fas fa-rupee-sign"></i><span>Total: ₹${data.totalPrice}</span></div>`
            : ""
        }
        ${
          data.pickupAddress
            ? `<div class="rp-cgm__detail-item"><i class="fas fa-map-marker-alt"></i><span>${data.pickupAddress}</span></div>`
            : ""
        }
        <div class="rp-cgm__detail-item"><i class="fas fa-credit-card"></i><span>Payment: ${
          data.paymentMethod === "online"
            ? "Online (Pending Verification)"
            : "Cash on Delivery"
        }</span></div>
      </div>
      <div class="rp-cgm__actions">
        <button id="rpCgmClose" class="rp-cgm__btn rp-cgm__btn--sec"><i class="fas fa-soap"></i> Order More</button>
        <a href="orders.html" class="rp-cgm__btn rp-cgm__btn--primary"><i class="fas fa-list-alt"></i> View My Orders</a>
      </div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("rp-cgm--open"));
  const closeIt = () => {
    modal.classList.remove("rp-cgm--open");
    setTimeout(() => modal.remove(), 300);
  };
  document.getElementById("rpCgmClose").onclick = closeIt;
  modal.querySelector(".rp-cgm__backdrop").onclick = closeIt;
}

// ============================================
// RESET FORM
// ============================================
function resetForm() {
  document.getElementById("serviceSelect").value = "";
  document.getElementById("quantityInput").value = 1;
  document.getElementById("pickupTime").value = "";
  document.getElementById("pickupAddress").value = "";
  const si = document.getElementById("specialInstructions");
  if (si) si.value = "";
  selectedService = null;
  currentQuantity = 1;
  setMinPickupDate();
  const priceDisplay = document.getElementById("priceDisplay");
  if (priceDisplay) priceDisplay.style.display = "none";
  const serviceHint = document.getElementById("serviceHint");
  if (serviceHint)
    serviceHint.textContent = "Select a service to see pricing details";
  updateOrderSummary();
  updateInlineSummary();
  setTimeout(() => preFillAddress(), 100);
}

// ============================================
// AUTH MODAL
// ============================================
function setupAuthModal() {
  const authModalClose = document.getElementById("authModalClose");
  const authModalOverlay = document.getElementById("authModalOverlay");
  const authIframe = document.getElementById("authIframe");
  if (authModalClose) authModalClose.addEventListener("click", closeAuthModal);
  if (authModalOverlay)
    authModalOverlay.addEventListener("click", (e) => {
      if (e.target === authModalOverlay) closeAuthModal();
    });
  window.addEventListener("message", function (event) {
    const { type, data } = event.data || {};
    if (type === "CLOSE_MODAL") closeAuthModal();
    else if (type === "SWITCH_TO_REGISTRATION") {
      if (authIframe) authIframe.src = "registration.html";
    } else if (type === "AUTH_SUCCESS") handleAuthSuccess(data);
  });
  document.addEventListener("keydown", (e) => {
    const overlay = document.getElementById("authModalOverlay");
    if (e.key === "Escape" && overlay?.classList.contains("active"))
      closeAuthModal();
  });
}

function openAuthModal(page = "login") {
  const overlay = document.getElementById("authModalOverlay");
  const iframe = document.getElementById("authIframe");
  if (!overlay || !iframe) return;
  iframe.src = page === "login" ? "login.html" : "registration.html";
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeAuthModal() {
  const overlay = document.getElementById("authModalOverlay");
  const iframe = document.getElementById("authIframe");
  if (!overlay) return;
  overlay.classList.remove("active");
  if (iframe) iframe.src = "about:blank";
  document.body.style.overflow = "";
}

function handleAuthSuccess(userData) {
  if (!userData) return;
  storage.set("isLoggedIn", "true");
  storage.set("userName", userData.userName || "User");
  storage.set("userEmail", userData.userEmail || "");
  storage.set("jwtToken", userData.token || "demo_token_" + Date.now());
  closeAuthModal();
  checkLoginStatus();
  if (typeof checkAuthState === "function") checkAuthState();
  if (typeof checkSidebarAuthState === "function") checkSidebarAuthState();
  showRPNotification(`Welcome, ${userData.userName || "User"}!`, "success");
  fetchUserProfile();
}

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;

// ============================================
// NOTIFICATION
// ============================================
function showRPNotification(message, type = "info") {
  const existing = document.querySelector(".rp-notification");
  if (existing) existing.remove();
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
  const notif = document.createElement("div");
  notif.className = "rp-notification";
  notif.style.background = colors[type] || colors.info;
  notif.innerHTML = `<i class="fas ${
    icons[type] || icons.info
  }"></i> ${message}`;
  document.body.appendChild(notif);
  setTimeout(() => {
    notif.style.transition = "all 0.3s";
    notif.style.opacity = "0";
    notif.style.transform = "translateX(200px)";
    setTimeout(() => notif.remove(), 300);
  }, 3500);
}

// ============================================
// INJECT ALL MODAL CSS
// ============================================
if (!document.getElementById("rp-modal-styles")) {
  const style = document.createElement("style");
  style.id = "rp-modal-styles";
  style.textContent = `
    .rp-osm{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;padding:1.5rem;opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s;}
    .rp-osm--open{opacity:1;visibility:visible;}
    .rp-osm__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);}
    .rp-osm__box{position:relative;z-index:1;background:var(--primary-bg,#fff);border-radius:20px;width:100%;max-width:680px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.3);transform:scale(.92);transition:transform .3s;}
    .rp-osm--open .rp-osm__box{transform:scale(1);}
    [data-theme="dark"] .rp-osm__box{background:#1a0f2e;border:2px solid rgba(167,139,250,.3);}
    .rp-osm__head{display:flex;align-items:center;justify-content:space-between;padding:1.5rem 2rem;background:linear-gradient(135deg,#6b46c1,#a855f7);border-radius:18px 18px 0 0;color:#fff;}
    .rp-osm__head h2{font-size:1.4rem;font-weight:800;margin:0;}.rp-osm__head p{font-size:.85rem;opacity:.85;margin:0;}
    .rp-osm__head-left{display:flex;align-items:center;gap:1rem;}.rp-osm__head-icon{font-size:1.8rem;}
    .rp-osm__close{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);border:none;color:#fff;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:background .2s,transform .2s;}
    .rp-osm__close:hover{background:rgba(255,255,255,.35);transform:rotate(90deg);}
    .rp-osm__body{padding:1.5rem 2rem;display:flex;flex-direction:column;gap:1.5rem;}
    .rp-osm__sec-title{display:flex;align-items:center;gap:.5rem;font-weight:700;color:var(--text-primary,#111);margin-bottom:1rem;font-size:.95rem;}
    .rp-osm__edit-tag{margin-left:auto;background:rgba(107,70,193,.15);color:#6b46c1;padding:.2rem .6rem;border-radius:20px;font-size:.75rem;font-weight:600;}
    .rp-osm__info-card{background:var(--secondary-bg,#f9fafb);border-radius:12px;padding:1rem 1.25rem;border:1.5px solid var(--border-color,#e5e7eb);}
    [data-theme="dark"] .rp-osm__info-card{background:rgba(255,255,255,.04);}
    .rp-osm__row{display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border-color,#e5e7eb);font-size:.95rem;}
    .rp-osm__row:last-child{border-bottom:none;}.rp-osm__row span{color:var(--text-secondary,#6b7280);}.rp-osm__row strong{color:var(--text-primary,#111);}
    .rp-osm__row--total{padding-top:.75rem;}.rp-osm__total-val{font-size:1.25rem;color:#6b46c1;font-weight:800;}
    .rp-osm__form-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem;}
    .rp-osm__field{display:flex;flex-direction:column;gap:.4rem;}
    .rp-osm__field label{font-size:.82rem;font-weight:600;color:var(--text-secondary,#6b7280);text-transform:uppercase;letter-spacing:.4px;}
    .rp-osm__input{padding:.7rem 1rem;border-radius:10px;border:1.5px solid var(--border-color,#e5e7eb);background:var(--primary-bg,#fff);color:var(--text-primary,#111);font-size:.95rem;width:100%;transition:border-color .2s,box-shadow .2s;font-family:inherit;}
    .rp-osm__input:focus{outline:none;border-color:#6b46c1;box-shadow:0 0 0 3px rgba(107,70,193,.15);}
    [data-theme="dark"] .rp-osm__input{background:#0d0720;border-color:rgba(167,139,250,.3);color:#fff;}
    .rp-osm__textarea{resize:vertical;min-height:65px;}
    .rp-osm__prefs{display:flex;gap:.75rem;flex-wrap:wrap;}
    .rp-osm__pref{display:flex;align-items:center;gap:.5rem;padding:.5rem 1rem;border-radius:20px;background:var(--secondary-bg,#f3f0ff);color:var(--text-primary,#111);font-size:.9rem;font-weight:600;}
    .rp-osm__pref i{color:#6b46c1;}
    .rp-osm__error{padding:.7rem 1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:#ef4444;font-size:.85rem;font-weight:600;}
    .rp-osm__foot{display:flex;justify-content:space-between;align-items:center;padding:1.25rem 2rem;border-top:2px solid var(--border-color,#e5e7eb);gap:1rem;}
    .rp-osm__btn{display:flex;align-items:center;gap:.6rem;padding:.85rem 1.5rem;border-radius:12px;font-size:.95rem;font-weight:700;cursor:pointer;border:none;transition:all .3s;}
    .rp-osm__btn--back{background:var(--secondary-bg,#f3f4f6);color:var(--text-primary,#111);border:2px solid var(--border-color,#e5e7eb);}
    .rp-osm__btn--back:hover{border-color:#6b46c1;transform:translateY(-2px);}
    .rp-osm__btn--confirm{background:linear-gradient(135deg,#6b46c1,#a855f7);color:#fff;flex:1;justify-content:center;}
    .rp-osm__btn--confirm:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(107,70,193,.4);}
    @media(max-width:560px){.rp-osm__body,.rp-osm__foot{padding:1.25rem;}.rp-osm__form-row{grid-template-columns:1fr;}.rp-osm__foot{flex-direction:column-reverse;}.rp-osm__btn{width:100%;justify-content:center;}}
    .rp-qpm{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:1.5rem;opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s;}
    .rp-qpm--open{opacity:1;visibility:visible;}
    .rp-qpm__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);}
    .rp-qpm__box{position:relative;z-index:1;background:var(--primary-bg,#fff);border-radius:20px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.35);transform:scale(.92);transition:transform .3s;}
    .rp-qpm--open .rp-qpm__box{transform:scale(1);}
    [data-theme="dark"] .rp-qpm__box{background:#1a0f2e;border:2px solid rgba(167,139,250,.3);}
    .rp-qpm__header{display:flex;align-items:center;gap:1rem;padding:1.25rem 1.5rem;background:linear-gradient(135deg,#6b46c1,#a855f7);border-radius:18px 18px 0 0;color:#fff;}
    .rp-qpm__header h2{font-size:1.2rem;font-weight:800;margin:0;}.rp-qpm__header p{font-size:.8rem;opacity:.85;margin:0;}
    .rp-qpm__header-icon{font-size:1.8rem;flex-shrink:0;}
    .rp-qpm__close{margin-left:auto;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.2);border:none;color:#fff;cursor:pointer;font-size:.9rem;display:flex;align-items:center;justify-content:center;transition:background .2s,transform .2s;flex-shrink:0;}
    .rp-qpm__close:hover{background:rgba(255,255,255,.35);transform:rotate(90deg);}
    .rp-qpm__amount{display:flex;flex-direction:column;align-items:center;padding:1.25rem 1.5rem .75rem;gap:.25rem;}
    .rp-qpm__amount-label{font-size:.8rem;color:var(--text-secondary,#6b7280);text-transform:uppercase;letter-spacing:.5px;font-weight:600;}
    .rp-qpm__amount-value{font-size:2rem;font-weight:800;color:#6b46c1;}
    .rp-qpm__qr-wrapper{display:flex;flex-direction:column;align-items:center;padding:.5rem 1.5rem 1rem;gap:.75rem;}
    .rp-qpm__qr-img{width:200px;height:200px;border-radius:12px;border:3px solid #6b46c1;padding:6px;background:#fff;box-shadow:0 4px 20px rgba(107,70,193,.25);}
    .rp-qpm__qr-hint{font-size:.82rem;color:var(--text-secondary,#6b7280);display:flex;align-items:center;gap:.4rem;text-align:center;}
    .rp-qpm__qr-hint i{color:#6b46c1;}
    .rp-qpm__upi-row{display:flex;align-items:center;gap:.6rem;margin:0 1.5rem .75rem;background:var(--secondary-bg,#f9fafb);border:1.5px solid var(--border-color,#e5e7eb);border-radius:10px;padding:.65rem 1rem;}
    .rp-qpm__upi-label{font-size:.8rem;font-weight:600;color:var(--text-secondary,#6b7280);flex-shrink:0;}
    .rp-qpm__upi-id{font-size:.88rem;font-weight:700;color:#6b46c1;flex:1;}
    .rp-qpm__copy-btn{font-size:.75rem;padding:.3rem .7rem;border-radius:8px;background:rgba(107,70,193,.1);color:#6b46c1;border:1px solid rgba(107,70,193,.3);cursor:pointer;font-weight:600;transition:all .2s;white-space:nowrap;}
    .rp-qpm__copy-btn:hover{background:#6b46c1;color:#fff;}
    .rp-qpm__steps{display:flex;flex-direction:column;gap:.5rem;margin:0 1.5rem .75rem;}
    .rp-qpm__step{display:flex;align-items:center;gap:.75rem;font-size:.85rem;color:var(--text-secondary,#6b7280);font-weight:500;}
    .rp-qpm__step-num{width:22px;height:22px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#6b46c1,#a855f7);color:#fff;font-size:.75rem;font-weight:800;display:flex;align-items:center;justify-content:center;}
    .rp-qpm__error{margin:.25rem 1.5rem;padding:.7rem 1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:#ef4444;font-size:.85rem;font-weight:600;}
    .rp-qpm__footer{display:flex;gap:.75rem;padding:1rem 1.5rem 1.25rem;border-top:2px solid var(--border-color,#e5e7eb);}
    .rp-qpm__btn{display:flex;align-items:center;justify-content:center;gap:.5rem;padding:.8rem 1rem;border-radius:12px;font-size:.92rem;font-weight:700;cursor:pointer;border:none;transition:all .3s;}
    .rp-qpm__btn--back{background:var(--secondary-bg,#f3f4f6);color:var(--text-primary,#111);border:2px solid var(--border-color,#e5e7eb);flex-shrink:0;}
    .rp-qpm__btn--back:hover{border-color:#6b46c1;transform:translateY(-2px);}
    .rp-qpm__btn--paid{flex:1;background:linear-gradient(135deg,#10b981,#059669);color:#fff;box-shadow:0 4px 14px rgba(16,185,129,.35);}
    .rp-qpm__btn--paid:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(16,185,129,.45);}
    .rp-qpm__btn--paid:disabled{opacity:.6;cursor:not-allowed;transform:none;}
    .rp-cgm{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem;opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s;}
    .rp-cgm--open{opacity:1;visibility:visible;}
    .rp-cgm__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(5px);}
    .rp-cgm__box{position:relative;z-index:1;background:var(--primary-bg,#fff);border-radius:18px;padding:1.5rem 1.5rem 1.25rem;width:100%;max-width:360px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.25);transform:scale(.9);transition:transform .4s;}
    .rp-cgm--open .rp-cgm__box{transform:scale(1);}
    [data-theme="dark"] .rp-cgm__box{background:#1a0f2e;border:1.5px solid rgba(167,139,250,.3);}
    .rp-cgm__check{width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:1.9rem;display:flex;align-items:center;justify-content:center;margin:0 auto .9rem;box-shadow:0 6px 18px rgba(16,185,129,.35);animation:rpPopIn .5s cubic-bezier(.34,1.56,.64,1) .1s both;}
    @keyframes rpPopIn{from{transform:scale(0)}to{transform:scale(1)}}
    .rp-cgm__title{font-size:1.2rem;font-weight:800;color:var(--text-primary,#111);margin-bottom:.3rem;}
    .rp-cgm__sub{color:var(--text-secondary,#6b7280);font-size:.82rem;margin-bottom:.9rem;}
    .rp-cgm__details{background:var(--secondary-bg,#f9fafb);border-radius:10px;padding:.7rem .9rem;margin-bottom:1rem;text-align:left;border:1px solid var(--border-color,#e5e7eb);}
    [data-theme="dark"] .rp-cgm__details{background:rgba(255,255,255,.04);border-color:rgba(167,139,250,.2);}
    .rp-cgm__detail-item{display:flex;align-items:flex-start;gap:.6rem;padding:.35rem 0;color:var(--text-primary,#111);font-weight:600;font-size:.82rem;border-bottom:1px solid var(--border-color,#f0f0f0);}
    .rp-cgm__detail-item:last-child{border-bottom:none;}
    .rp-cgm__detail-item i{color:#6b46c1;font-size:.9rem;margin-top:2px;flex-shrink:0;}
    .rp-cgm__actions{display:flex;gap:.75rem;}
    .rp-cgm__btn{flex:1;display:flex;align-items:center;justify-content:center;gap:.5rem;padding:.65rem 1rem;border-radius:10px;font-size:.85rem;font-weight:700;cursor:pointer;text-decoration:none;border:none;transition:all .3s;}
    .rp-cgm__btn--primary{background:linear-gradient(135deg,#6b46c1,#a855f7);color:#fff;}
    .rp-cgm__btn--primary:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(107,70,193,.4);}
    .rp-cgm__btn--sec{background:var(--secondary-bg,#f3f4f6);color:var(--text-primary,#111);}
    .rp-cgm__btn--sec:hover{background:var(--border-color,#e5e7eb);transform:translateY(-2px);}
    .rp-csm{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem;opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s;}
    .rp-csm--open{opacity:1;visibility:visible;}
    .rp-csm__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);}
    .rp-csm__box{position:relative;z-index:1;background:var(--primary-bg,#fff);border-radius:18px;padding:2rem;width:100%;max-width:360px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.25);}
    [data-theme="dark"] .rp-csm__box{background:#1a0f2e;border:1.5px solid rgba(167,139,250,.3);}
    .rp-csm__icon{font-size:3rem;color:#6b46c1;margin-bottom:1rem;}
    .rp-csm__box h3{font-size:1.3rem;font-weight:800;margin-bottom:.5rem;color:var(--text-primary,#111);}
    .rp-csm__box p{color:var(--text-secondary,#6b7280);margin-bottom:1.5rem;font-size:.9rem;}
    .rp-csm__actions{display:flex;gap:.75rem;}
    .rp-csm__btn{flex:1;padding:.75rem 1rem;border:none;border-radius:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.5rem;transition:all .3s;font-size:.9rem;}
    .rp-csm__btn--view{background:linear-gradient(135deg,#6b46c1,#a855f7);color:#fff;}
    .rp-csm__btn--view:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(107,70,193,.4);}
    .rp-csm__btn--cont{background:var(--secondary-bg,#f3f4f6);color:var(--text-primary,#111);}
    .rp-csm__btn--cont:hover{background:var(--border-color,#e5e7eb);}
    .rp-notification{position:fixed;top:100px;right:20px;color:white;padding:1rem 1.5rem;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);display:flex;align-items:center;gap:10px;font-weight:600;z-index:10001;}
  `;
  document.head.appendChild(style);
}

window.loadRollPressServices = loadRollPressServices;
console.log("✨ Roll Press JS fully loaded!");
