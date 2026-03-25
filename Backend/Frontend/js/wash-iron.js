// ============================================
// WASH & IRON - COMPLETE UPDATED VERSION
// ✅ Preserved: loadWashIronServices, fallback, all existing logic
// ✅ NEW: Auto-fetch profile address, Place Order modal, Confirm Order, Congrats
// ============================================

console.log("🧺 Wash & Iron JavaScript Loading...");

const API_BASE_URL = window.location.origin;

// State
let selectedService = null;
let services = [];
let currentPrice = 0;
let currentUnit = "";
let userProfile = null; // ✅ NEW: stores fetched user profile

// ============================================
// INITIALIZE ON DOM LOAD
// ============================================
document.addEventListener("DOMContentLoaded", async function () {
  console.log("✅ DOM loaded, initializing wash-iron page...");

  loadWashIronServices();
  initializeEventListeners();
  setMinimumPickupDate();
  checkLoginStatus();

  // ✅ NEW: fetch profile to pre-fill address
  await fetchUserProfile();
});

// ============================================
// ✅ NEW: FETCH USER PROFILE → PRE-FILL ADDRESS
// ============================================
async function fetchUserProfile() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/profile/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return;

    const result = await response.json();
    if (result.success && result.data && result.data.user) {
      userProfile = result.data.user;
      console.log("✅ Profile fetched:", userProfile.full_name);
      preFillPickupAddress();
    }
  } catch (e) {
    console.warn("⚠️ Could not fetch profile:", e);
  }
}

function preFillPickupAddress() {
  if (!userProfile) return;
  const field = document.getElementById("pickupAddress");
  if (!field || field.value.trim() !== "") return; // don't overwrite user input

  const parts = [
    userProfile.address,
    userProfile.city,
    userProfile.pincode,
  ].filter(Boolean);

  if (parts.length > 0) {
    field.value = parts.join(", ");
    // Show autofill hint (matches iron page)
    const hint = document.getElementById("addressAutofillHint");
    if (hint) hint.style.display = "inline-flex";
    console.log("✅ Address pre-filled from profile");
  }
}

// ============================================
// LOAD SERVICES FROM BACKEND (UNCHANGED)
// ============================================
async function loadWashIronServices() {
  try {
    console.log("📡 Loading wash+iron services...");
    const response = await fetch(`${API_BASE_URL}/api/services?category=3`);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    if (data.success && data.data && data.data.services) {
      services = data.data.services;
      console.log(`✅ Loaded ${services.length} wash+iron services`);
      populateServiceDropdown();
    } else {
      throw new Error("Invalid response format");
    }
  } catch (error) {
    console.error("❌ Error loading services:", error);
    showNotification(
      "Failed to load services. Please refresh the page.",
      "error"
    );
    useFallbackServices();
  }
}

// ============================================
// FALLBACK SERVICES (UNCHANGED)
// ============================================
function useFallbackServices() {
  console.log("⚠️ Using fallback service data");
  services = [
    { id: 1, name: "Shirt", price: 30, unit: "piece" },
    { id: 2, name: "T-Shirt", price: 25, unit: "piece" },
    { id: 3, name: "Pants", price: 40, unit: "piece" },
    { id: 4, name: "Jeans", price: 50, unit: "piece" },
    { id: 5, name: "Saree", price: 80, unit: "piece" },
    { id: 6, name: "Kurta", price: 35, unit: "piece" },
    { id: 7, name: "Suit (2 piece)", price: 150, unit: "piece" },
    { id: 8, name: "Coat/Blazer", price: 100, unit: "piece" },
    { id: 9, name: "Dress", price: 60, unit: "piece" },
    { id: 10, name: "Bedsheet", price: 70, unit: "piece" },
  ];
  populateServiceDropdown();
}

// ============================================
// POPULATE SERVICE DROPDOWN (UNCHANGED)
// ============================================
function populateServiceDropdown() {
  const serviceSelect = document.getElementById("serviceSelect");
  if (!serviceSelect) {
    console.error("❌ Service select element not found");
    return;
  }
  serviceSelect.innerHTML = '<option value="">-- Choose Item --</option>';
  services.forEach((service) => {
    const option = document.createElement("option");
    option.value = service.id;
    option.textContent = service.name;
    option.dataset.price = service.price;
    option.dataset.unit = service.unit || service.price_unit || "piece";
    serviceSelect.appendChild(option);
  });
  console.log(`✅ Populated dropdown with ${services.length} services`);
}

// ============================================
// INITIALIZE EVENT LISTENERS — UPDATED
// ============================================
function initializeEventListeners() {
  const serviceSelect = document.getElementById("serviceSelect");
  const decreaseBtn = document.getElementById("decreaseQty");
  const increaseBtn = document.getElementById("increaseQty");
  const quantityInput = document.getElementById("quantity");
  const deliveryOptions = document.querySelectorAll(
    'input[name="deliveryType"]'
  );
  const addToCartBtn = document.getElementById("addToCartBtn"); // ✅ NEW
  const placeOrderBtn = document.getElementById("placeOrderBtn"); // ✅ UPDATED
  const orderForm = document.getElementById("orderForm");

  if (serviceSelect)
    serviceSelect.addEventListener("change", handleServiceChange);
  if (decreaseBtn)
    decreaseBtn.addEventListener("click", () => changeQuantity(-1));
  if (increaseBtn)
    increaseBtn.addEventListener("click", () => changeQuantity(1));
  if (quantityInput)
    quantityInput.addEventListener("change", () => {
      updateTotalPrice();
      updateOrderSummary();
    });
  deliveryOptions.forEach((opt) =>
    opt.addEventListener("change", () => {
      updateTotalPrice();
      updateOrderSummary();
    })
  );

  // ✅ NEW: Add to Cart button
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", handleAddToCart);
  }

  // ✅ UPDATED: Place Order button (was form submit → now opens summary modal)
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener("click", handlePlaceOrder);
  }

  // Prevent default form submit
  if (orderForm) {
    orderForm.addEventListener("submit", (e) => e.preventDefault());
  }

  console.log("✅ Event listeners initialized");
}

// ============================================
// HANDLE SERVICE CHANGE (UNCHANGED)
// ============================================
function handleServiceChange(event) {
  const selectedOption = event.target.options[event.target.selectedIndex];
  if (!selectedOption.value) {
    currentPrice = 0;
    currentUnit = "";
    selectedService = null;
    updatePriceDisplay();
    updateTotalPrice();
    return;
  }
  const serviceId = parseInt(selectedOption.value);
  currentPrice = parseFloat(selectedOption.dataset.price);
  currentUnit = selectedOption.dataset.unit;
  selectedService = services.find((s) => s.id === serviceId);
  console.log("📦 Service selected:", {
    id: serviceId,
    name: selectedOption.text,
    price: currentPrice,
    unit: currentUnit,
  });
  updatePriceDisplay();
  updateTotalPrice();
  updateOrderSummary();
}

// ============================================
// UPDATE PRICE DISPLAY (UNCHANGED)
// ============================================
function updatePriceDisplay() {
  const priceDisplay = document.getElementById("priceDisplay");
  const priceUnit = document.getElementById("priceUnit");
  if (priceDisplay)
    priceDisplay.value =
      currentPrice > 0 ? `₹${currentPrice.toFixed(2)}` : "₹0.00";
  if (priceUnit)
    priceUnit.textContent = currentUnit ? `/ ${currentUnit}` : "/ piece";
}

// ============================================
// QUANTITY CONTROLS (UNCHANGED)
// ============================================
function changeQuantity(delta) {
  const quantityInput = document.getElementById("quantity");
  if (!quantityInput) return;
  let newQty = (parseInt(quantityInput.value) || 1) + delta;
  const min = parseInt(quantityInput.min) || 1;
  const max = parseInt(quantityInput.max) || 100;
  newQty = Math.max(min, Math.min(max, newQty));
  quantityInput.value = newQty;
  updateTotalPrice();
  updateOrderSummary();
}

// ============================================
// UPDATE TOTAL PRICE (UNCHANGED)
// ============================================
function updateTotalPrice() {
  const quantityInput = document.getElementById("quantity");
  const totalAmountDisplay = document.getElementById("totalAmount");
  if (!quantityInput || !totalAmountDisplay) return;
  const quantity = parseInt(quantityInput.value) || 1;
  const deliveryCharge = getDeliveryCharge();
  const total = currentPrice * quantity + deliveryCharge;
  totalAmountDisplay.textContent = `₹${total.toFixed(2)}`;
}

// ============================================
// GET DELIVERY CHARGE (UNCHANGED)
// ============================================
function getDeliveryCharge() {
  const deliveryType = document.querySelector(
    'input[name="deliveryType"]:checked'
  );
  if (!deliveryType) return 0;
  return deliveryType.value === "express" ? 50 : 0;
}

// ============================================
// LIVE ORDER SUMMARY (matches iron page UI)
// ============================================
function updateOrderSummary() {
  const serviceSelect = document.getElementById("serviceSelect");
  const quantityInput = document.getElementById("quantity");
  const summaryServiceType = document.getElementById("summaryServiceType");
  const summaryQuantity = document.getElementById("summaryQuantity");
  const summaryPricePerPiece = document.getElementById("summaryPricePerPiece");
  const summaryDelivery = document.getElementById("summaryDelivery");
  const summaryTotal = document.getElementById("summaryTotal");

  if (!serviceSelect || !summaryServiceType) return;

  const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
  const quantity = parseInt(quantityInput?.value) || 0;
  const deliveryCharge = getDeliveryCharge();

  if (selectedOption?.value && selectedOption?.dataset?.price) {
    const unitPrice = parseFloat(selectedOption.dataset.price);
    const total = unitPrice * quantity + deliveryCharge;

    if (summaryServiceType)
      summaryServiceType.textContent = selectedOption.textContent.trim();
    if (summaryQuantity)
      summaryQuantity.textContent = `${quantity} piece${
        quantity !== 1 ? "s" : ""
      }`;
    if (summaryPricePerPiece)
      summaryPricePerPiece.textContent = `₹${unitPrice}/piece`;
    if (summaryDelivery)
      summaryDelivery.textContent =
        deliveryCharge > 0 ? `₹${deliveryCharge} (Express)` : "Free";
    if (summaryTotal) summaryTotal.textContent = `₹${total.toFixed(2)}`;
  } else {
    if (summaryServiceType) summaryServiceType.textContent = "-";
    if (summaryQuantity) summaryQuantity.textContent = "-";
    if (summaryPricePerPiece) summaryPricePerPiece.textContent = "-";
    if (summaryDelivery) summaryDelivery.textContent = "Free";
    if (summaryTotal) summaryTotal.textContent = "₹0";
  }
}

// ============================================
// SET PICKUP DATE — 5-DAY BOOKING WINDOW
// Min: tomorrow  |  Max: today + 5 days
// ============================================
function setMinimumPickupDate() {
  const pickupDateInput = document.getElementById("pickupDate");
  if (!pickupDateInput) return;

  const today = new Date();
  const tomorrow = new Date(today);
  const maxDate = new Date(today);

  tomorrow.setDate(today.getDate() + 1);
  maxDate.setDate(today.getDate() + 5);

  const toISO = (d) => d.toISOString().split("T")[0];

  pickupDateInput.min = toISO(tomorrow);
  pickupDateInput.max = toISO(maxDate);

  console.log(`📅 Pickup window: ${toISO(tomorrow)} → ${toISO(maxDate)}`);

  // Live validation when user picks a date
  pickupDateInput.addEventListener("change", function () {
    validatePickupDate(this);
  });
}

// ============================================
// VALIDATE SELECTED PICKUP DATE
// Shows inline error if outside 1–5 day window
// ============================================
function validatePickupDate(input) {
  if (!input || !input.value) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selected = new Date(input.value + "T00:00:00");
  const diffDays = Math.round((selected - today) / (1000 * 60 * 60 * 24));

  // Remove any existing error
  const existingErr = document.getElementById("pickupDateError");
  if (existingErr) existingErr.remove();

  if (diffDays < 1) {
    showDateError(input, "⚠️ Pickup date must be tomorrow or later.");
    input.value = "";
    return false;
  }

  if (diffDays > 5) {
    showDateError(
      input,
      "⚠️ Pickup can only be scheduled up to 5 days in advance."
    );
    input.value = "";
    return false;
  }

  return true;
}

function showDateError(input, message) {
  const err = document.createElement("p");
  err.id = "pickupDateError";
  err.style.cssText =
    "margin:.4rem 0 0;font-size:.8rem;color:#ef4444;font-weight:600;display:flex;align-items:center;gap:.35rem;";
  err.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
  input.parentNode.insertBefore(err, input.nextSibling);
}

// ============================================
// CHECK LOGIN STATUS (UNCHANGED)
// ============================================
function checkLoginStatus() {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const token = getAuthToken();
  console.log("🔐 Login status:", isLoggedIn ? "Logged in" : "Not logged in");
  if (!isLoggedIn || !token) {
    console.log("⚠️ User not logged in");
  }
}

// ============================================
// GET AUTH TOKEN (UNCHANGED)
// ============================================
function getAuthToken() {
  return localStorage.getItem("jwtToken");
}

// ============================================
// GET FORM DATA (UNCHANGED + delivery/payment)
// ============================================
function getFormData() {
  const serviceSelect = document.getElementById("serviceSelect");
  const quantity = document.getElementById("quantity");
  const pickupDate = document.getElementById("pickupDate");
  const pickupTime = document.getElementById("pickupTime");
  const pickupAddress = document.getElementById("pickupAddress");
  const specialInstructions = document.getElementById("specialInstructions");

  if (
    !serviceSelect.value ||
    !quantity.value ||
    !pickupDate.value ||
    !pickupTime.value ||
    !pickupAddress.value
  ) {
    return null;
  }

  // ✅ 5-day window enforcement at submit time
  if (!validatePickupDate(pickupDate)) {
    showNotification(
      "Please select a pickup date within the next 5 days.",
      "error"
    );
    return null;
  }

  const deliveryType =
    document.querySelector('input[name="deliveryType"]:checked')?.value ||
    "standard";
  const paymentMethod =
    document.querySelector('input[name="paymentMethod"]:checked')?.value ||
    "cod";
  const deliveryCharge = getDeliveryCharge();

  return {
    serviceId: parseInt(serviceSelect.value),
    serviceName: serviceSelect.options[serviceSelect.selectedIndex].text,
    quantity: parseInt(quantity.value),
    unitPrice: currentPrice,
    unit: currentUnit,
    totalPrice: currentPrice * parseInt(quantity.value) + deliveryCharge,
    pickupDate: pickupDate.value,
    pickupTime: pickupTime.value,
    pickupAddress: pickupAddress.value.trim(),
    specialInstructions: specialInstructions?.value?.trim() || "",
    deliveryType,
    deliveryCharge,
    paymentMethod,
  };
}

// ============================================
// VALIDATE BEFORE ACTION
// ============================================
function validateForm() {
  const serviceSelect = document.getElementById("serviceSelect");
  const quantity = document.getElementById("quantity");
  const pickupDate = document.getElementById("pickupDate");
  const pickupTime = document.getElementById("pickupTime");
  const pickupAddress = document.getElementById("pickupAddress");

  if (!serviceSelect?.value) {
    showNotification("Please select an item type", "error");
    return false;
  }
  if (!quantity?.value || parseInt(quantity.value) < 1) {
    showNotification("Please enter a valid quantity", "error");
    return false;
  }
  if (!pickupDate?.value) {
    showNotification("Please select a pickup date", "error");
    return false;
  }
  if (!pickupTime?.value) {
    showNotification("Please select a pickup time", "error");
    return false;
  }
  if (!pickupAddress?.value?.trim()) {
    showNotification("Please enter a pickup address", "error");
    return false;
  }
  return true;
}

function requireLogin() {
  const token = getAuthToken();
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  if (!token || !isLoggedIn) {
    showNotification("Please login to continue", "error");
    setTimeout(() => {
      if (typeof window.openAuthModal === "function")
        window.openAuthModal("login");
      else {
        const overlay = document.getElementById("authModalOverlay");
        if (overlay) {
          overlay.classList.add("active");
          const ifr = document.getElementById("authIframe");
          if (ifr) ifr.src = "login.html";
        } else window.location.href = "home-content.html";
      }
    }, 500);
    return false;
  }
  return true;
}

// ============================================
// ✅ HANDLE ADD TO CART (calls /api/cart/add)
// ============================================
async function handleAddToCart() {
  if (!requireLogin()) return;
  if (!validateForm()) return;

  const token = getAuthToken();
  const formData = getFormData();
  if (!formData) {
    showNotification("Please fill all required fields", "error");
    return;
  }

  const cartData = {
    serviceId: formData.serviceId,
    serviceName: formData.serviceName,
    quantity: formData.quantity,
    unitPrice: formData.unitPrice,
    unit: formData.unit,
    totalPrice: formData.totalPrice,
    pickupDate: formData.pickupDate,
    pickupTime: formData.pickupTime,
    pickupAddress: formData.pickupAddress,
    specialInstructions: formData.specialInstructions,
    deliveryType: formData.deliveryType,
    deliveryCharge: formData.deliveryCharge,
    paymentMethod: formData.paymentMethod,
  };

  const btn = document.getElementById("addToCartBtn");
  const origHTML = btn?.innerHTML || "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/cart/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cartData),
    });

    const result = await response.json();

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHTML;
    }

    if (response.status === 401) {
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("isLoggedIn");
      showNotification("Session expired. Please login again.", "error");
      setTimeout(() => {
        if (typeof window.openAuthModal === "function")
          window.openAuthModal("login");
        else window.location.href = "home-content.html";
      }, 1500);
      return;
    }

    if (result.success) {
      showNotification("Item added to cart successfully! 🎉", "success");
      updateCartCount();
      showCartConfirmation(cartData);
      resetForm();
    } else {
      throw new Error(result.message || "Failed to add item to cart");
    }
  } catch (error) {
    console.error("❌ Add to cart error:", error);
    showNotification(
      error.message || "Failed to add item to cart. Please try again.",
      "error"
    );
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHTML;
    }
  }
}

// ============================================
// ✅ HANDLE PLACE ORDER → OPENS SUMMARY MODAL
// ============================================
function handlePlaceOrder() {
  if (!requireLogin()) return;
  if (!validateForm()) return;
  const formData = getFormData();
  if (!formData) {
    showNotification("Please fill all required fields", "error");
    return;
  }
  showOrderSummaryModal(formData);
}

// ============================================
// ✅ ORDER SUMMARY MODAL (editable before confirm)
// ============================================
function showOrderSummaryModal(data) {
  document.getElementById("orderSummaryModal")?.remove();

  const userName = userProfile?.full_name || "";
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
      ? "Economy (72h)"
      : "Standard (48h)";

  const paymentLabel =
    data.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment";

  const modal = document.createElement("div");
  modal.id = "orderSummaryModal";
  modal.className = "osm";
  modal.innerHTML = `
    <div class="osm__backdrop" id="osmBackdrop"></div>
    <div class="osm__box">

      <!-- Header -->
      <div class="osm__head">
        <div class="osm__head-left">
          <span class="osm__head-icon"><i class="fas fa-receipt"></i></span>
          <div>
            <h2>Order Summary</h2>
            <p>Review and confirm your order details</p>
          </div>
        </div>
        <button class="osm__close" id="osmClose"><i class="fas fa-times"></i></button>
      </div>

      <!-- Body -->
      <div class="osm__body">

        <!-- Service Details (read-only) -->
        <div class="osm__section">
          <div class="osm__sec-title"><i class="fas fa-tshirt"></i> Service Details</div>
          <div class="osm__info-card">
            <div class="osm__row"><span>Item</span><strong>${
              data.serviceName
            }</strong></div>
            <div class="osm__row"><span>Quantity</span><strong>${
              data.quantity
            } ${data.unit}(s)</strong></div>
            <div class="osm__row"><span>Price / item</span><strong>₹${data.unitPrice.toFixed(
              2
            )}</strong></div>
            <div class="osm__row"><span>Delivery</span><strong>${
              data.deliveryCharge > 0
                ? "₹" + data.deliveryCharge + " (Express)"
                : "Free"
            }</strong></div>
            <div class="osm__row osm__row--total"><span>Total</span><strong class="osm__total-val">₹${data.totalPrice.toFixed(
              2
            )}</strong></div>
          </div>
        </div>

        <!-- Contact Details (editable, pre-filled from DB) -->
        <div class="osm__section">
          <div class="osm__sec-title">
            <i class="fas fa-user"></i> Contact Details
            <span class="osm__edit-tag">Editable</span>
          </div>
          <div class="osm__form-row">
            <div class="osm__field">
              <label>Full Name</label>
              <input id="osm_name"  class="osm__input" type="text" value="${userName}"  placeholder="Your full name" />
            </div>
            <div class="osm__field">
              <label>Phone Number</label>
              <input id="osm_phone" class="osm__input" type="text" value="${userPhone}" placeholder="Your phone" />
            </div>
          </div>
        </div>

        <!-- Pickup Details (editable) -->
        <div class="osm__section">
          <div class="osm__sec-title">
            <i class="fas fa-map-marker-alt"></i> Pickup Details
            <span class="osm__edit-tag">Editable</span>
          </div>
          <div class="osm__form-row">
            <div class="osm__field">
              <label>Pickup Date</label>
              <input id="osm_date" class="osm__input" type="date" value="${
                data.pickupDate
              }" min="${document.getElementById("pickupDate").min}" />
            </div>
            <div class="osm__field">
              <label>Time Slot</label>
              <select id="osm_time" class="osm__input">${timeSelectHTML}</select>
            </div>
          </div>
          <div class="osm__field" style="margin-top:1rem">
            <label>Pickup Address</label>
            <textarea id="osm_address" class="osm__input osm__textarea" rows="3">${
              data.pickupAddress
            }</textarea>
          </div>
        </div>

        <!-- Preferences (read-only) -->
        <div class="osm__section">
          <div class="osm__sec-title"><i class="fas fa-sliders-h"></i> Preferences</div>
          <div class="osm__prefs">
            <div class="osm__pref"><i class="fas fa-truck"></i><span>${deliveryLabel}</span></div>
            <div class="osm__pref"><i class="fas fa-wallet"></i><span>${paymentLabel}</span></div>
          </div>
          ${
            data.specialInstructions
              ? `<div class="osm__note"><i class="fas fa-comment-alt"></i>${data.specialInstructions}</div>`
              : ""
          }
        </div>

      </div>

      <!-- Footer -->
      <div class="osm__foot">
        <button class="osm__btn osm__btn--back"    id="osmBack">   <i class="fas fa-arrow-left"></i> Go Back</button>
        <button class="osm__btn osm__btn--confirm" id="osmConfirm"><i class="fas fa-check-circle"></i> Confirm Order</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("osm--open"));

  document.getElementById("osmClose").onclick = closeOrderSummaryModal;
  document.getElementById("osmBack").onclick = closeOrderSummaryModal;
  document.getElementById("osmBackdrop").onclick = closeOrderSummaryModal;
  document.getElementById("osmConfirm").onclick = () => confirmOrder(data);
}

// ============================================
// QR PAYMENT MODAL
// ============================================
function showQRPaymentModal(finalData) {
  document.getElementById("qrPaymentModal")?.remove();

  const amount = finalData.totalPrice?.toFixed(2) || "0.00";

  // Placeholder QR code using qr-server API (demo only)
  const upiId = "9173576732@ybl"; // 🔁 Replace with your real UPI ID
  const upiLink = `upi://pay?pa=${upiId}&pn=QuickLaundry&am=${amount}&cu=INR&tn=LaundryOrder`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    upiLink
  )}`;

  const modal = document.createElement("div");
  modal.id = "qrPaymentModal";
  modal.className = "qpm";
  modal.innerHTML = `
    <div class="qpm__backdrop"></div>
    <div class="qpm__box">

      <!-- Header -->
      <div class="qpm__header">
        <div class="qpm__header-icon"><i class="fas fa-qrcode"></i></div>
        <div>
          <h2>Scan & Pay</h2>
          <p>Complete your payment to confirm order</p>
        </div>
        <button class="qpm__close" id="qpmClose"><i class="fas fa-times"></i></button>
      </div>

      <!-- Amount -->
      <div class="qpm__amount">
        <span class="qpm__amount-label">Amount to Pay</span>
        <span class="qpm__amount-value">₹${amount}</span>
      </div>

      <!-- QR Code -->
      <div class="qpm__qr-wrapper">
        <img 
          src="${qrImgUrl}"
          alt="UPI QR Code"
          class="qpm__qr-img"
          onerror="this.src='https://placehold.co/200x200/6b46c1/white?text=QR+Code'"
        />
        <div class="qpm__qr-hint">
          <i class="fas fa-mobile-alt"></i>
          Scan with PhonePe, GPay, Paytm or any UPI app
        </div>
      </div>

      <!-- UPI ID -->
      <div class="qpm__upi-row">
        <span class="qpm__upi-label">UPI ID:</span>
        <span class="qpm__upi-id">${upiId}</span>
        <button class="qpm__copy-btn" onclick="navigator.clipboard.writeText('${upiId}').then(()=>{ this.innerHTML='<i class=\"fas fa-check\"></i> Copied!'; setTimeout(()=>{ this.innerHTML='<i class=\"fas fa-copy\"></i> Copy'; },2000); })">
          <i class="fas fa-copy"></i> Copy
        </button>
      </div>

      <!-- Steps -->
      <div class="qpm__steps">
        <div class="qpm__step"><span class="qpm__step-num">1</span><span>Open your UPI app</span></div>
        <div class="qpm__step"><span class="qpm__step-num">2</span><span>Scan the QR code above</span></div>
        <div class="qpm__step"><span class="qpm__step-num">3</span><span>Pay ₹${amount} & click below</span></div>
      </div>

      <!-- Error msg -->
      <div id="qpmError" class="qpm__error" style="display:none;"></div>

      <!-- Footer -->
      <div class="qpm__footer">
        <button class="qpm__btn qpm__btn--back" id="qpmBack">
          <i class="fas fa-arrow-left"></i> Go Back
        </button>
        <button class="qpm__btn qpm__btn--paid" id="qpmPaid">
          <i class="fas fa-check-circle"></i> I've Paid ₹${amount}
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("qpm--open"));

  const closeModal = () => {
    modal.classList.remove("qpm--open");
    setTimeout(() => modal.remove(), 300);
  };

  document.getElementById("qpmClose").onclick = closeModal;
  document.getElementById("qpmBack").onclick = closeModal;
  modal.querySelector(".qpm__backdrop").onclick = closeModal;

  document.getElementById("qpmPaid").onclick = () =>
    placeOrderAfterPayment(finalData);
}

// ============================================
// PLACE ORDER AFTER QR PAYMENT
// ============================================
async function placeOrderAfterPayment(finalData) {
  const token = getAuthToken();
  const btn = document.getElementById("qpmPaid");
  const errEl = document.getElementById("qpmError");

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming...';
  }
  if (errEl) errEl.style.display = "none";

  // Mark payment as pending verification (backend will verify manually or via webhook)
  const orderData = {
    ...finalData,
    paymentMethod: "online",
    paymentStatus: "pending_verification",
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/orders/place`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderData),
    });

    const result = await response.json();

    if (result.success) {
      // Close QR modal
      const qModal = document.getElementById("qrPaymentModal");
      if (qModal) {
        qModal.classList.remove("qpm--open");
        setTimeout(() => qModal.remove(), 300);
      }

      showCongratulationsModal({
        orderId:
          result.data?.order_id ||
          result.data?.orderId ||
          result.data?.orderNumber ||
          "ORD" + Date.now(),
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
        errEl.textContent =
          result.message || "Failed to place order. Please try again.";
        errEl.style.display = "block";
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
          '<i class="fas fa-check-circle"></i> I\'ve Paid ₹' +
          (finalData.totalPrice?.toFixed(2) || "0");
      }
    }
  } catch (err) {
    console.error("❌ Payment confirmation error:", err);
    if (errEl) {
      errEl.textContent = "Network error. Please try again.";
      errEl.style.display = "block";
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fas fa-check-circle"></i> I\'ve Paid ₹' +
        (finalData.totalPrice?.toFixed(2) || "0");
    }
  }
}

function closeOrderSummaryModal() {
  const m = document.getElementById("orderSummaryModal");
  if (!m) return;
  m.classList.remove("osm--open");
  setTimeout(() => m.remove(), 300);
}

// ============================================
// ✅ CONFIRM ORDER → POST /api/orders/place
// ============================================
async function confirmOrder(originalData) {
  const token = getAuthToken();

  // Merge any edits made inside the modal
  const finalData = {
    ...originalData,
    customerName:
      document.getElementById("osm_name")?.value?.trim() ||
      userProfile?.full_name ||
      "",
    customerPhone:
      document.getElementById("osm_phone")?.value?.trim() ||
      userProfile?.phone ||
      "",
    pickupDate:
      document.getElementById("osm_date")?.value || originalData.pickupDate,
    pickupTime:
      document.getElementById("osm_time")?.value || originalData.pickupTime,
    pickupAddress:
      document.getElementById("osm_address")?.value?.trim() ||
      originalData.pickupAddress,
  };

  if (!finalData.customerName) {
    showNotification("Please enter your name", "error");
    return;
  }
  if (!finalData.pickupAddress) {
    showNotification("Please enter pickup address", "error");
    return;
  }

  // ── If online payment → show QR modal first ──
  if (finalData.paymentMethod === "online") {
    closeOrderSummaryModal();
    showQRPaymentModal(finalData);
    return;
  }

  const btn = document.getElementById("osmConfirm");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/orders/place`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(finalData),
    });

    const result = await response.json();

    if (result.success) {
      closeOrderSummaryModal();
      showCongratulationsModal({
        orderId:
          result.data?.order_id ||
          result.data?.orderId ||
          result.data?.orderNumber ||
          "ORD" + Date.now(),
        pickupDate: finalData.pickupDate,
        pickupTime: finalData.pickupTime,
        quantity: finalData.quantity,
        unit: finalData.unit || "piece",
        totalPrice: result.data?.totalAmount || finalData.totalPrice,
        pickupAddress: finalData.pickupAddress,
        serviceName: finalData.serviceName,
      });
      resetForm();
    } else {
      showNotification(result.message || "Failed to place order", "error");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Order';
      }
    }
  } catch (error) {
    console.error("❌ Confirm order error:", error);
    showNotification("Network error. Please try again.", "error");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Order';
    }
  }
}

// ============================================
// ✅ CONGRATULATIONS MODAL (matches iron page style)
// ============================================
function showCongratulationsModal(data) {
  document.getElementById("congratsModal")?.remove();

  const orderId = data.orderId || "";
  const pickupDate = data.pickupDate || "";
  const pickupTime = data.pickupTime || "";
  const quantity = data.quantity || 0;
  const unit = data.unit || "piece";
  const totalPrice = data.totalPrice || 0;
  const pickupAddress = data.pickupAddress || "";

  const modal = document.createElement("div");
  modal.id = "congratsModal";
  modal.className = "cgm";
  modal.innerHTML = `
    <div class="cgm__backdrop"></div>
    <div class="cgm__box">
      <div class="cgm__check"><i class="fas fa-check"></i></div>
      <h2 class="cgm__title">Order Placed Successfully! 🎉</h2>
      <p class="cgm__sub">Your wash &amp; iron order has been confirmed.</p>

      <div class="cgm__details">
        ${
          orderId
            ? `
        <div class="cgm__detail-item">
          <i class="fas fa-hashtag"></i>
          <span>Order #: ${orderId}</span>
        </div>`
            : ""
        }
        ${
          pickupDate
            ? `
        <div class="cgm__detail-item">
          <i class="fas fa-calendar"></i>
          <span>Pickup Date: ${pickupDate}</span>
        </div>`
            : ""
        }
        ${
          pickupTime
            ? `
        <div class="cgm__detail-item">
          <i class="fas fa-clock"></i>
          <span>Pickup Time: ${pickupTime}</span>
        </div>`
            : ""
        }
        <div class="cgm__detail-item">
          <i class="fas fa-tshirt"></i>
          <span>Quantity: ${quantity} ${unit}${quantity !== 1 ? "s" : ""}</span>
        </div>
        ${
          totalPrice
            ? `
        <div class="cgm__detail-item">
          <i class="fas fa-rupee-sign"></i>
          <span>Total: ₹${totalPrice}</span>
        </div>`
            : ""
        }
        ${
          pickupAddress
            ? `
        <div class="cgm__detail-item">
          <i class="fas fa-map-marker-alt"></i>
          <span>${pickupAddress}</span>
        </div>`
            : ""
        }
        <div class="cgm__detail-item">
          <i class="fas fa-credit-card"></i>
          <span>Payment: ${
            data.paymentMethod === "online"
              ? "Online (Pending Verification)"
              : "Cash on Delivery"
          }</span>
        </div>
      </div>

      <div class="cgm__actions">
        <button id="cgmClose" class="cgm__btn cgm__btn--sec"><i class="fas fa-soap"></i> Order More</button>
        <a href="orders.html" class="cgm__btn cgm__btn--primary"><i class="fas fa-list-alt"></i> View My Orders</a>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("cgm--open"));

  const closeIt = () => {
    modal.classList.remove("cgm--open");
    setTimeout(() => modal.remove(), 300);
  };
  document.getElementById("cgmClose").onclick = closeIt;
  modal.querySelector(".cgm__backdrop").onclick = closeIt;
}

// ============================================
// SHOW CART CONFIRMATION MODAL (UNCHANGED)
// ============================================
function showCartConfirmation(itemData) {
  const modal = document.createElement("div");
  modal.id = "cartConfirmationModal";
  modal.style.cssText = `
    position:fixed;top:0;left:0;right:0;bottom:0;
    background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);
    z-index:10000;display:flex;align-items:center;justify-content:center;
    padding:1rem;animation:fadeIn 0.3s ease;
  `;
  modal.innerHTML = `
    <div class="cart-confirmation-content">
      <div class="cart-confirmation-icon"><i class="fas fa-check-circle"></i></div>
      <h3>Added to Cart!</h3>
      <p>Your ${itemData.serviceName} (${itemData.quantity} ${itemData.unit}) has been added to cart.</p>
      <div class="cart-confirmation-buttons">
        <button class="btn-view-cart" onclick="window.location.href='cart.html'">
          <i class="fas fa-shopping-cart"></i> View Cart
        </button>
        <button class="btn-continue-shopping" onclick="closeCartConfirmation()">
          <i class="fas fa-plus"></i> Continue Shopping
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => closeCartConfirmation(), 5000);
}

function closeCartConfirmation() {
  const modal = document.getElementById("cartConfirmationModal");
  if (modal) {
    modal.style.animation = "fadeOut 0.3s ease";
    setTimeout(() => modal.remove(), 300);
  }
}
window.closeCartConfirmation = closeCartConfirmation;

// ============================================
// UPDATE CART COUNT (UNCHANGED)
// ============================================
async function updateCartCount() {
  try {
    const token = getAuthToken();
    if (!token) return;
    const response = await fetch(`${API_BASE_URL}/api/cart`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        const cartCount = result.data.items?.length || 0;
        if (typeof window.updateOrderBadge === "function")
          window.updateOrderBadge(cartCount);
        if (typeof window.updateCartBadge === "function")
          window.updateCartBadge(cartCount);
        console.log(`✅ Cart count updated: ${cartCount}`);
      }
    }
  } catch (error) {
    console.error("❌ Error updating cart count:", error);
  }
}

// ============================================
// RESET FORM (UNCHANGED + re-prefill address)
// ============================================
function resetForm() {
  const orderForm = document.getElementById("orderForm");
  if (orderForm) {
    orderForm.reset();
    selectedService = null;
    currentPrice = 0;
    currentUnit = "";
    updatePriceDisplay();
    updateTotalPrice();
    updateOrderSummary();
    console.log("✅ Form reset");
  }
  // Re-prefill address from profile after reset
  setTimeout(() => preFillPickupAddress(), 100);
}

// ============================================
// SHOW NOTIFICATION (UNCHANGED)
// ============================================
function showNotification(message, type = "info") {
  console.log(`🔔 Notification (${type}):`, message);
  if (
    typeof window.showNotification === "function" &&
    window.showNotification !== showNotification
  ) {
    window.showNotification(message, type);
    return;
  }
  const notification = document.createElement("div");
  notification.className = `custom-notification notification-${type}`;
  notification.style.cssText = `
    position:fixed;top:100px;right:20px;
    background:${
      type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"
    };
    color:white;padding:1rem 1.5rem;border-radius:12px;
    box-shadow:0 10px 30px rgba(0,0,0,0.2);
    display:flex;align-items:center;gap:10px;font-weight:600;
    z-index:10001;animation:slideInRight 0.3s ease;
  `;
  notification.innerHTML = `<i class="fas fa-${
    type === "success"
      ? "check-circle"
      : type === "error"
      ? "exclamation-circle"
      : "info-circle"
  }"></i><span>${message}</span>`;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ============================================
// ADD REQUIRED CSS (UNCHANGED + new modal styles)
// ============================================
if (!document.getElementById("wash-iron-styles")) {
  const style = document.createElement("style");
  style.id = "wash-iron-styles";
  style.textContent = `
    @keyframes slideInRight  { from{transform:translateX(400px);opacity:0} to{transform:translateX(0);opacity:1} }
    @keyframes slideOutRight { from{transform:translateX(0);opacity:1} to{transform:translateX(400px);opacity:0} }
    @keyframes fadeIn        { from{opacity:0} to{opacity:1} }
    @keyframes fadeOut       { from{opacity:1} to{opacity:0} }
    @keyframes confettiFall  { 0%{transform:translateY(-10px) rotate(0deg);opacity:1} 100%{transform:translateY(110vh) rotate(720deg);opacity:0} }
    @keyframes popIn         { from{transform:scale(0)} to{transform:scale(1)} }

    /* ── Live Order Summary Box (matches iron page) ── */
    .order-summary {
      background: var(--secondary-bg, #f9fafb);
      border: 2px solid var(--border-color, #e5e7eb);
      border-radius: 14px;
      padding: 1.25rem 1.5rem;
      margin: 1.5rem 0 1rem;
    }
    .order-summary h3 {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary, #111);
      margin: 0 0 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .order-summary h3 i { color: #6b46c1; }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.45rem 0;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
      font-size: 0.92rem;
      color: var(--text-secondary, #6b7280);
    }
    .summary-row:last-child { border-bottom: none; }
    .summary-row span:last-child { font-weight: 600; color: var(--text-primary, #111); }
    .summary-row.total {
      margin-top: 0.5rem;
      padding-top: 0.75rem;
      font-weight: 700;
      font-size: 1.05rem;
    }
    .summary-row.total span:first-child { color: var(--text-primary, #111); font-weight: 700; }
    .summary-row.total span:last-child  { color: #6b46c1; font-size: 1.2rem; }
    [data-theme="dark"] .order-summary { background: rgba(255,255,255,0.04); border-color: rgba(167,139,250,0.25); }

    /* ── Hint text below buttons ── */
    .btn-hint-text {
      text-align: center;
      font-size: 0.82rem;
      color: var(--text-secondary, #6b7280);
      margin-top: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
    }
    .btn-hint-text i { color: #6b46c1; }

    /* ── Address autofill hint ── */
    .address-autofill-hint {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.78rem;
      font-weight: 500;
      color: #6b46c1;
      background: rgba(107,70,193,0.1);
      padding: 0.15rem 0.55rem;
      border-radius: 20px;
      margin-left: 0.5rem;
    }

    .cart-confirmation-content {
      background:white;padding:2rem;border-radius:20px;text-align:center;
      max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.3);
    }
    .cart-confirmation-icon { font-size:4rem;color:#10b981;margin-bottom:1rem; }
    .cart-confirmation-content h3 { font-size:1.5rem;margin-bottom:0.5rem;color:#1f2937; }
    .cart-confirmation-content p  { color:#6b7280;margin-bottom:1.5rem; }
    .cart-confirmation-buttons { display:flex;gap:1rem;flex-direction:column; }
    .btn-view-cart,.btn-continue-shopping {
      padding:0.75rem 1.5rem;border:none;border-radius:12px;font-weight:600;
      cursor:pointer;display:flex;align-items:center;justify-content:center;
      gap:0.5rem;transition:all 0.3s ease;
    }
    .btn-view-cart { background:linear-gradient(135deg,#6b46c1,#9333ea);color:white; }
    .btn-view-cart:hover { transform:translateY(-2px);box-shadow:0 8px 20px rgba(107,70,193,0.4); }
    .btn-continue-shopping { background:#f3f4f6;color:#374151; }
    .btn-continue-shopping:hover { background:#e5e7eb; }

    /* ── Order Summary Modal ── */
    .osm {
      position:fixed;inset:0;z-index:9998;
      display:flex;align-items:center;justify-content:center;padding:1.5rem;
      opacity:0;visibility:hidden;transition:opacity .3s ease,visibility .3s ease;
    }
    .osm--open { opacity:1;visibility:visible; }
    .osm__backdrop {
      position:absolute;inset:0;
      background:rgba(0,0,0,.65);backdrop-filter:blur(6px);
    }
    .osm__box {
      position:relative;z-index:1;
      background:var(--primary-bg,#fff);border-radius:20px;
      width:100%;max-width:680px;max-height:90vh;overflow-y:auto;
      box-shadow:0 24px 60px rgba(0,0,0,.3);
      transform:scale(.92);transition:transform .3s ease;
    }
    .osm--open .osm__box { transform:scale(1); }
    [data-theme="dark"] .osm__box { background:#1a0f2e;border:2px solid rgba(167,139,250,.3); }

    .osm__head {
      display:flex;align-items:center;justify-content:space-between;
      padding:1.5rem 2rem;
      background:linear-gradient(135deg,var(--gradient-start,#6b46c1),var(--gradient-end,#a855f7));
      border-radius:18px 18px 0 0;color:#fff;
    }
    .osm__head h2 { font-size:1.4rem;font-weight:800;margin:0; }
    .osm__head p  { font-size:.85rem;opacity:.85;margin:0; }
    .osm__head-left { display:flex;align-items:center;gap:1rem; }
    .osm__head-icon { font-size:1.8rem; }
    .osm__close {
      width:36px;height:36px;border-radius:50%;
      background:rgba(255,255,255,.2);border:none;color:#fff;
      cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;
      transition:background .2s,transform .2s;
    }
    .osm__close:hover { background:rgba(255,255,255,.35);transform:rotate(90deg); }

    .osm__body { padding:1.5rem 2rem;display:flex;flex-direction:column;gap:1.5rem; }
    .osm__sec-title {
      display:flex;align-items:center;gap:.5rem;
      font-weight:700;color:var(--text-primary,#111);margin-bottom:1rem;font-size:.95rem;
    }
    .osm__edit-tag {
      margin-left:auto;background:rgba(107,70,193,.15);color:#6b46c1;
      padding:.2rem .6rem;border-radius:20px;font-size:.75rem;font-weight:600;
    }
    .osm__info-card {
      background:var(--secondary-bg,#f9fafb);border-radius:12px;
      padding:1rem 1.25rem;border:1.5px solid var(--border-color,#e5e7eb);
    }
    [data-theme="dark"] .osm__info-card { background:rgba(255,255,255,.04); }
    .osm__row {
      display:flex;justify-content:space-between;padding:.5rem 0;
      border-bottom:1px solid var(--border-color,#e5e7eb);font-size:.95rem;
    }
    .osm__row:last-child { border-bottom:none; }
    .osm__row span     { color:var(--text-secondary,#6b7280); }
    .osm__row strong   { color:var(--text-primary,#111); }
    .osm__row--total   { padding-top:.75rem; }
    .osm__total-val    { font-size:1.25rem;color:#6b46c1;font-weight:800; }

    .osm__form-row { display:grid;grid-template-columns:1fr 1fr;gap:1rem; }
    .osm__field    { display:flex;flex-direction:column;gap:.4rem; }
    .osm__field label {
      font-size:.82rem;font-weight:600;color:var(--text-secondary,#6b7280);
      text-transform:uppercase;letter-spacing:.4px;
    }
    .osm__input {
      padding:.7rem 1rem;border-radius:10px;
      border:1.5px solid var(--border-color,#e5e7eb);
      background:var(--primary-bg,#fff);color:var(--text-primary,#111);
      font-size:.95rem;width:100%;transition:border-color .2s,box-shadow .2s;
    }
    .osm__input:focus { outline:none;border-color:#6b46c1;box-shadow:0 0 0 3px rgba(107,70,193,.15); }
    [data-theme="dark"] .osm__input { background:#0d0720;border-color:rgba(167,139,250,.3);color:#fff; }
    .osm__textarea { resize:vertical;min-height:70px;font-family:inherit; }

    .osm__prefs { display:flex;gap:.75rem;flex-wrap:wrap; }
    .osm__pref  {
      display:flex;align-items:center;gap:.5rem;padding:.5rem 1rem;
      border-radius:20px;background:var(--secondary-bg,#f3f0ff);
      color:var(--text-primary,#111);font-size:.9rem;font-weight:600;
    }
    .osm__pref i { color:#6b46c1; }
    .osm__note {
      margin-top:.75rem;padding:.75rem 1rem;
      background:rgba(107,70,193,.08);border-radius:10px;
      display:flex;align-items:flex-start;gap:.6rem;
      font-size:.9rem;color:var(--text-secondary,#6b7280);
    }
    .osm__note i { color:#6b46c1;margin-top:.1rem;flex-shrink:0; }

    .osm__foot {
      display:flex;justify-content:space-between;align-items:center;
      padding:1.25rem 2rem;border-top:2px solid var(--border-color,#e5e7eb);gap:1rem;
    }
    .osm__btn {
      display:flex;align-items:center;gap:.6rem;padding:.85rem 1.5rem;
      border-radius:12px;font-size:.95rem;font-weight:700;cursor:pointer;
      border:none;transition:all .3s ease;
    }
    .osm__btn--back {
      background:var(--secondary-bg,#f3f4f6);color:var(--text-primary,#111);
      border:2px solid var(--border-color,#e5e7eb);
    }
    .osm__btn--back:hover { border-color:#6b46c1;transform:translateY(-2px); }
    .osm__btn--confirm {
      background:linear-gradient(135deg,#6b46c1,#a855f7);color:#fff;flex:1;justify-content:center;
    }
    .osm__btn--confirm:hover { transform:translateY(-2px);box-shadow:0 8px 20px rgba(107,70,193,.4); }

    @media(max-width:560px) {
      .osm__body,.osm__foot { padding:1.25rem; }
      .osm__form-row { grid-template-columns:1fr; }
      .osm__foot { flex-direction:column-reverse; }
      .osm__btn  { width:100%;justify-content:center; }
    }

    /* ── Congratulations Modal (matches iron page) ── */
    .cgm {
      position:fixed;inset:0;z-index:9999;
      display:flex;align-items:center;justify-content:center;padding:1.5rem;
      opacity:0;visibility:hidden;transition:opacity .3s ease,visibility .3s ease;
    }
    .cgm--open { opacity:1;visibility:visible; }
    .cgm__backdrop {
      position:absolute;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(5px);
    }
    .cgm__box {
      position:relative;z-index:1;
      background:var(--primary-bg,#fff);border-radius:18px;
      padding:1.5rem 1.5rem 1.25rem;
      width:100%;max-width:360px;
      text-align:center;
      box-shadow:0 12px 40px rgba(0,0,0,.25);
      transform:scale(.9);transition:transform .4s ease;
    }
    .cgm--open .cgm__box { transform:scale(1); }
    [data-theme="dark"] .cgm__box { background:#1a0f2e;border:1.5px solid rgba(167,139,250,.3); }

    .cgm__check {
      width:58px;height:58px;border-radius:50%;
      background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:1.9rem;
      display:flex;align-items:center;justify-content:center;
      margin:0 auto 0.9rem;
      box-shadow:0 6px 18px rgba(16,185,129,.35);
      animation:popIn .5s cubic-bezier(.34,1.56,.64,1) .1s both;
    }
    .cgm__title {
      font-size:1.2rem;font-weight:800;
      color:var(--text-primary,#111);margin-bottom:.3rem;
    }
    .cgm__sub {
      color:var(--text-secondary,#6b7280);font-size:.82rem;margin-bottom:.9rem;
    }

    /* Detail rows (like iron page confirmation) */
    .cgm__details {
      background:var(--secondary-bg,#f9fafb);
      border-radius:10px;padding:.7rem .9rem;
      margin-bottom:1rem;text-align:left;
      border:1px solid var(--border-color,#e5e7eb);
    }
    [data-theme="dark"] .cgm__details { background:rgba(255,255,255,.04);border-color:rgba(167,139,250,.2); }

    .cgm__detail-item {
      display:flex;align-items:flex-start;gap:.6rem;
      padding:.35rem 0;
      color:var(--text-primary,#111);font-weight:600;font-size:.82rem;
      border-bottom:1px solid var(--border-color,#f0f0f0);
    }
    .cgm__detail-item:last-child { border-bottom:none; }
    .cgm__detail-item i {
      color:var(--accent-color,#6b46c1);font-size:.9rem;
      margin-top:2px;flex-shrink:0;
    }

    .cgm__actions {
      display:flex;gap:.75rem;margin-top:.25rem;
    }
    .cgm__btn {
      flex:1;display:flex;align-items:center;justify-content:center;gap:.5rem;
      padding:.65rem 1rem;border-radius:10px;
      font-size:.85rem;font-weight:700;cursor:pointer;
      text-decoration:none;border:none;transition:all .3s ease;
    }
    .cgm__btn--primary {
      background:linear-gradient(135deg,#6b46c1,#a855f7);color:#fff;
      box-shadow:0 4px 12px rgba(107,70,193,.3);
    }
    .cgm__btn--primary:hover { transform:translateY(-2px);box-shadow:0 8px 20px rgba(107,70,193,.4); }
    .cgm__btn--sec {
      background:var(--secondary-bg,#f3f4f6);color:var(--text-primary,#111);
      border:none;box-shadow:none;
    }
    .cgm__btn--sec:hover { background:var(--border-color,#e5e7eb);transform:translateY(-2px); }
    @media(max-width:400px) { .cgm__actions{flex-direction:column-reverse} }

    /* ── QR Payment Modal ── */
    .qpm {
      position:fixed;inset:0;z-index:10000;
      display:flex;align-items:center;justify-content:center;padding:1.5rem;
      opacity:0;visibility:hidden;transition:opacity .3s ease,visibility .3s ease;
    }
    .qpm--open { opacity:1;visibility:visible; }
    .qpm__backdrop {
      position:absolute;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);
    }
    .qpm__box {
      position:relative;z-index:1;
      background:var(--primary-bg,#fff);border-radius:20px;
      width:100%;max-width:420px;max-height:90vh;overflow-y:auto;
      box-shadow:0 24px 60px rgba(0,0,0,.35);
      transform:scale(.92);transition:transform .3s ease;
    }
    .qpm--open .qpm__box { transform:scale(1); }
    [data-theme="dark"] .qpm__box { background:#1a0f2e;border:2px solid rgba(167,139,250,.3); }

    .qpm__header {
      display:flex;align-items:center;gap:1rem;
      padding:1.25rem 1.5rem;
      background:linear-gradient(135deg,#6b46c1,#a855f7);
      border-radius:18px 18px 0 0;color:#fff;
    }
    .qpm__header h2 { font-size:1.2rem;font-weight:800;margin:0; }
    .qpm__header p  { font-size:.8rem;opacity:.85;margin:0; }
    .qpm__header-icon { font-size:1.8rem;flex-shrink:0; }
    .qpm__close {
      margin-left:auto;width:32px;height:32px;border-radius:50%;
      background:rgba(255,255,255,.2);border:none;color:#fff;
      cursor:pointer;font-size:.9rem;display:flex;align-items:center;justify-content:center;
      transition:background .2s,transform .2s;flex-shrink:0;
    }
    .qpm__close:hover { background:rgba(255,255,255,.35);transform:rotate(90deg); }

    .qpm__amount {
      display:flex;flex-direction:column;align-items:center;
      padding:1.25rem 1.5rem .75rem;gap:.25rem;
    }
    .qpm__amount-label { font-size:.8rem;color:var(--text-secondary,#6b7280);text-transform:uppercase;letter-spacing:.5px;font-weight:600; }
    .qpm__amount-value { font-size:2rem;font-weight:800;color:#6b46c1; }

    .qpm__qr-wrapper {
      display:flex;flex-direction:column;align-items:center;
      padding:.5rem 1.5rem 1rem;gap:.75rem;
    }
    .qpm__qr-img {
      width:200px;height:200px;border-radius:12px;
      border:3px solid #6b46c1;padding:6px;background:#fff;
      box-shadow:0 4px 20px rgba(107,70,193,.25);
    }
    .qpm__qr-hint {
      font-size:.82rem;color:var(--text-secondary,#6b7280);
      display:flex;align-items:center;gap:.4rem;text-align:center;
    }
    .qpm__qr-hint i { color:#6b46c1; }

    .qpm__upi-row {
      display:flex;align-items:center;gap:.6rem;
      margin:0 1.5rem .75rem;
      background:var(--secondary-bg,#f9fafb);
      border:1.5px solid var(--border-color,#e5e7eb);
      border-radius:10px;padding:.65rem 1rem;
    }
    [data-theme="dark"] .qpm__upi-row { background:rgba(255,255,255,.04); }
    .qpm__upi-label { font-size:.8rem;font-weight:600;color:var(--text-secondary,#6b7280);flex-shrink:0; }
    .qpm__upi-id    { font-size:.88rem;font-weight:700;color:#6b46c1;flex:1; }
    .qpm__copy-btn  {
      font-size:.75rem;padding:.3rem .7rem;border-radius:8px;
      background:rgba(107,70,193,.1);color:#6b46c1;border:1px solid rgba(107,70,193,.3);
      cursor:pointer;font-weight:600;transition:all .2s;white-space:nowrap;
    }
    .qpm__copy-btn:hover { background:#6b46c1;color:#fff; }

    .qpm__steps {
      display:flex;flex-direction:column;gap:.5rem;
      margin:0 1.5rem .75rem;
    }
    .qpm__step {
      display:flex;align-items:center;gap:.75rem;
      font-size:.85rem;color:var(--text-secondary,#6b7280);font-weight:500;
    }
    .qpm__step-num {
      width:22px;height:22px;border-radius:50%;flex-shrink:0;
      background:linear-gradient(135deg,#6b46c1,#a855f7);color:#fff;
      font-size:.75rem;font-weight:800;
      display:flex;align-items:center;justify-content:center;
    }

    .qpm__error {
      margin:.25rem 1.5rem;padding:.7rem 1rem;
      background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);
      border-radius:8px;color:#ef4444;font-size:.85rem;font-weight:600;
    }

    .qpm__footer {
      display:flex;gap:.75rem;padding:1rem 1.5rem 1.25rem;
      border-top:2px solid var(--border-color,#e5e7eb);
    }
    [data-theme="dark"] .qpm__footer { border-color:rgba(167,139,250,.2); }
    .qpm__btn {
      display:flex;align-items:center;justify-content:center;gap:.5rem;
      padding:.8rem 1rem;border-radius:12px;
      font-size:.92rem;font-weight:700;cursor:pointer;border:none;
      transition:all .3s ease;
    }
    .qpm__btn--back {
      background:var(--secondary-bg,#f3f4f6);color:var(--text-primary,#111);
      border:2px solid var(--border-color,#e5e7eb);flex-shrink:0;
    }
    .qpm__btn--back:hover { border-color:#6b46c1;transform:translateY(-2px); }
    .qpm__btn--paid {
      flex:1;
      background:linear-gradient(135deg,#10b981,#059669);color:#fff;
      box-shadow:0 4px 14px rgba(16,185,129,.35);
    }
    .qpm__btn--paid:hover  { transform:translateY(-2px);box-shadow:0 8px 20px rgba(16,185,129,.45); }
    .qpm__btn--paid:disabled { opacity:.6;cursor:not-allowed;transform:none; }
    @media(max-width:400px) {
      .qpm__footer { flex-direction:column-reverse; }
      .qpm__btn--back { width:100%; }
    }

  `;
  document.head.appendChild(style);
}

// ============================================
// EXPORT FOR DEBUGGING (UNCHANGED)
// ============================================
window.washIronDebug = {
  services,
  selectedService,
  currentPrice,
  currentUnit,
  userProfile,
  reloadServices: loadWashIronServices,
  getFormData,
  updateCartCount,
  getAuthToken,
};

console.log("✨ Wash & Iron JavaScript fully loaded!");
