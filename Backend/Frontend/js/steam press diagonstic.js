// ============================================
// STEAM PRESS JAVASCRIPT - FULLY DEBUGGED VERSION
// ✅ Complete rewrite with extensive logging
// ============================================

console.log("🌪️ ========================================");
console.log("🌪️ STEAM PRESS PAGE LOADING");
console.log("🌪️ ========================================");

// ============================================
// GLOBAL VARIABLES
// ============================================
let steamPressServices = [];
let selectedService = null;
let currentUser = null;

// API Configuration
const API_BASE_URL = window.location.origin;
const STEAM_PRESS_CATEGORY_ID = 4;

console.log("📌 Global Variables Initialized");
console.log("📌 API Base URL:", API_BASE_URL);
console.log("📌 Category ID:", STEAM_PRESS_CATEGORY_ID);

// ============================================
// WAIT FOR DOM TO BE READY
// ============================================
console.log("⏳ Waiting for DOM to be ready...");

if (document.readyState === "loading") {
  console.log("📄 Document still loading, adding event listener...");
  document.addEventListener("DOMContentLoaded", initSteamPress);
} else {
  console.log("📄 Document already loaded, initializing immediately...");
  initSteamPress();
}

// ============================================
// INITIALIZE STEAM PRESS PAGE
// ============================================
function initSteamPress() {
  console.log("\n🎯 ========================================");
  console.log("🎯 INITIALIZING STEAM PRESS PAGE");
  console.log("🎯 ========================================");

  // Log DOM state
  console.log("📋 Checking critical DOM elements...");
  const serviceSelect = document.getElementById("serviceSelect");
  const quantityInput = document.getElementById("quantityInput");
  const decreaseBtn = document.getElementById("decreaseQty");
  const increaseBtn = document.getElementById("increaseQty");
  const bookingForm = document.getElementById("steamPressBookingForm");

  console.log("✓ serviceSelect:", serviceSelect ? "FOUND ✅" : "NOT FOUND ❌");
  console.log("✓ quantityInput:", quantityInput ? "FOUND ✅" : "NOT FOUND ❌");
  console.log("✓ decreaseBtn:", decreaseBtn ? "FOUND ✅" : "NOT FOUND ❌");
  console.log("✓ increaseBtn:", increaseBtn ? "FOUND ✅" : "NOT FOUND ❌");
  console.log("✓ bookingForm:", bookingForm ? "FOUND ✅" : "NOT FOUND ❌");

  // Check if user is logged in
  checkUserAuth();

  // Load services - THIS IS CRITICAL
  console.log("\n🔄 About to load services...");
  loadSteamPressServices();

  // Initialize event listeners
  initializeEventListeners();

  // Initialize FAQ accordions
  initializeFAQ();

  // Set minimum pickup date to tomorrow
  setMinimumPickupDate();

  console.log("\n✅ ========================================");
  console.log("✅ STEAM PRESS PAGE INITIALIZED");
  console.log("✅ ========================================\n");
}

// ============================================
// CHECK USER AUTHENTICATION
// ============================================
function checkUserAuth() {
  console.log("\n🔐 Checking user authentication...");

  const token =
    localStorage.getItem("authToken") || localStorage.getItem("jwtToken");
  const userData = localStorage.getItem("userData");
  const userName = localStorage.getItem("userName");
  const userEmail = localStorage.getItem("userEmail");

  console.log("🔍 Auth data found:");
  console.log("  - authToken:", token ? "✅ Present" : "❌ Missing");
  console.log("  - userData:", userData ? "✅ Present" : "❌ Missing");
  console.log("  - userName:", userName ? "✅ Present" : "❌ Missing");

  if (token && (userData || userName)) {
    try {
      if (userData) {
        currentUser = JSON.parse(userData);
      } else {
        currentUser = {
          name: userName,
          email: userEmail,
        };
      }
      console.log("✅ User is logged in:", currentUser.name);
    } catch (error) {
      console.error("❌ Error parsing user data:", error);
      currentUser = null;
    }
  } else {
    console.log("ℹ️ User is not logged in");
    currentUser = null;
  }
}

// ============================================
// LOAD STEAM PRESS SERVICES FROM DATABASE
// ============================================
async function loadSteamPressServices() {
  console.log("\n📡 ========================================");
  console.log("📡 LOADING STEAM PRESS SERVICES");
  console.log("📡 ========================================");

  const apiUrl = `${API_BASE_URL}/api/services/category/${STEAM_PRESS_CATEGORY_ID}`;
  console.log("🌐 Fetching from:", apiUrl);

  try {
    console.log("⏳ Making fetch request...");
    const response = await fetch(apiUrl);

    console.log("📥 Response received!");
    console.log("  - Status:", response.status);
    console.log("  - Status Text:", response.statusText);
    console.log("  - OK:", response.ok);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("⏳ Parsing JSON response...");
    const data = await response.json();

    console.log("📦 ========================================");
    console.log("📦 API RESPONSE DATA");
    console.log("📦 ========================================");
    console.log(JSON.stringify(data, null, 2));
    console.log("📦 ========================================");

    if (data.success && data.data && data.data.services) {
      const rawServices = data.data.services;
      console.log(`\n✅ API returned ${rawServices.length} services`);

      // Process and clean services
      console.log("\n🧹 Processing services...");
      steamPressServices = rawServices.map((service, index) => {
        const originalName = service.name || "";
        const cleanName = originalName.trim();
        const hasWhitespace = originalName !== cleanName;

        console.log(`\n📋 Service #${index + 1}:`);
        console.log(`  - ID: ${service.id}`);
        console.log(
          `  - Original Name: "${originalName}" (length: ${originalName.length})`
        );
        console.log(
          `  - Clean Name: "${cleanName}" (length: ${cleanName.length})`
        );
        console.log(
          `  - Has Whitespace: ${hasWhitespace ? "⚠️ YES" : "✅ NO"}`
        );
        console.log(`  - Price: ₹${service.price}`);
        console.log(`  - Unit: ${service.unit || "per piece"}`);

        return {
          id: service.id,
          name: cleanName,
          price: parseFloat(service.price) || 0,
          unit: service.unit || "per piece",
          description: service.description || "",
          is_featured: service.is_featured || false,
        };
      });

      console.log(
        `\n✅ Processed ${steamPressServices.length} services successfully`
      );
      console.log("\n📋 Final services array:");
      console.log(JSON.stringify(steamPressServices, null, 2));

      // Now populate the dropdown
      console.log("\n🎨 Populating service dropdown...");
      populateServiceDropdown();
    } else {
      console.error("❌ API response missing expected data structure");
      console.error("Response data:", data);
      showNotification(
        "Failed to load services. Please refresh the page.",
        "error"
      );
    }
  } catch (error) {
    console.error("\n❌ ========================================");
    console.error("❌ ERROR LOADING SERVICES");
    console.error("❌ ========================================");
    console.error("Error type:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("❌ ========================================");

    showNotification(
      "Error connecting to server. Please try again later.",
      "error"
    );

    // Load fallback services for testing
    console.log("\n🔄 Loading fallback demo services...");
    loadFallbackServices();
  }
}

// ============================================
// FALLBACK SERVICES (FOR TESTING)
// ============================================
function loadFallbackServices() {
  console.log("\n⚠️ Using fallback demo services");

  steamPressServices = [
    {
      id: 401,
      name: "T-Shirt Steam Press",
      price: 25,
      unit: "per piece",
      description: "Professional steam pressing for t-shirts",
    },
    {
      id: 402,
      name: "Shirt Steam Press",
      price: 30,
      unit: "per piece",
      description: "Professional steam pressing for shirts",
    },
    {
      id: 403,
      name: "Trouser Steam Press",
      price: 35,
      unit: "per piece",
      description: "Professional steam pressing for trousers",
    },
    {
      id: 404,
      name: "Suit Steam Press",
      price: 80,
      unit: "per piece",
      description: "Professional steam pressing for suits",
    },
  ];

  console.log("✅ Fallback services loaded:", steamPressServices.length);
  console.log(JSON.stringify(steamPressServices, null, 2));

  populateServiceDropdown();
}

// ============================================
// POPULATE SERVICE DROPDOWN
// ============================================
function populateServiceDropdown() {
  console.log("\n🎨 ========================================");
  console.log("🎨 POPULATING SERVICE DROPDOWN");
  console.log("🎨 ========================================");

  const serviceSelect = document.getElementById("serviceSelect");

  if (!serviceSelect) {
    console.error("❌ CRITICAL ERROR: serviceSelect element not found!");
    console.error("❌ Cannot populate dropdown!");
    return;
  }

  console.log("✅ serviceSelect element found:", serviceSelect);
  console.log("📊 Current dropdown state:");
  console.log("  - Current options count:", serviceSelect.options.length);
  console.log(
    "  - Current innerHTML:",
    serviceSelect.innerHTML.substring(0, 100) + "..."
  );

  // Clear existing options
  console.log("\n🧹 Clearing existing options...");
  serviceSelect.innerHTML = "";

  // Add placeholder option
  console.log("➕ Adding placeholder option...");
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "-- Choose a Service --";
  placeholderOption.selected = true;
  placeholderOption.disabled = false; // Make sure it's not disabled
  serviceSelect.appendChild(placeholderOption);
  console.log("✅ Placeholder added");

  // Add services
  console.log(`\n➕ Adding ${steamPressServices.length} service options...`);

  steamPressServices.forEach((service, index) => {
    console.log(`\n📝 Creating option #${index + 1}:`);

    const option = document.createElement("option");
    option.value = service.id;

    const serviceName = service.name || "Unnamed Service";
    const price = parseFloat(service.price || 0).toFixed(2);
    const unit = service.unit || "per piece";

    option.textContent = `${serviceName} - ₹${price} ${unit}`;
    option.dataset.price = service.price;
    option.dataset.unit = unit;
    option.dataset.name = serviceName;

    console.log(`  - Option value: ${option.value}`);
    console.log(`  - Option text: ${option.textContent}`);
    console.log(`  - Option dataset:`, option.dataset);

    serviceSelect.appendChild(option);
    console.log(`  ✅ Option #${index + 1} added to dropdown`);
  });

  console.log("\n✅ ========================================");
  console.log(`✅ DROPDOWN POPULATED SUCCESSFULLY`);
  console.log(`✅ Total options: ${serviceSelect.options.length}`);
  console.log(`✅ Services: ${steamPressServices.length}`);
  console.log("✅ ========================================");

  // Log final dropdown HTML for verification
  console.log("\n📄 Final dropdown HTML:");
  console.log(serviceSelect.outerHTML.substring(0, 500) + "...");

  // Verify options are accessible
  console.log("\n🔍 Verifying dropdown options:");
  for (let i = 0; i < serviceSelect.options.length; i++) {
    console.log(
      `  Option ${i}: value="${serviceSelect.options[i].value}", text="${serviceSelect.options[i].textContent}"`
    );
  }
}

// ============================================
// EVENT LISTENERS
// ============================================
function initializeEventListeners() {
  console.log("\n🔧 ========================================");
  console.log("🔧 INITIALIZING EVENT LISTENERS");
  console.log("🔧 ========================================");

  // Service selection change
  const serviceSelect = document.getElementById("serviceSelect");
  if (serviceSelect) {
    console.log("✅ Attaching change listener to serviceSelect");
    serviceSelect.addEventListener("change", function (e) {
      console.log("\n🔄 Service selection changed!");
      console.log("  - Selected index:", this.selectedIndex);
      console.log("  - Selected value:", this.value);
      console.log("  - Selected option:", this.options[this.selectedIndex]);
      handleServiceChange(e);
    });

    // Also log on click
    serviceSelect.addEventListener("click", function () {
      console.log("🖱️ Service dropdown clicked");
      console.log("  - Options count:", this.options.length);
    });
  } else {
    console.error("❌ Service select not found - cannot attach listener!");
  }

  // Quantity controls
  const decreaseBtn = document.getElementById("decreaseQty");
  const increaseBtn = document.getElementById("increaseQty");
  const quantityInput = document.getElementById("quantityInput");

  if (decreaseBtn && quantityInput) {
    console.log("✅ Attaching click listener to decrease button");
    decreaseBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      console.log("➖ Decrease button clicked");
      const currentQty = parseInt(quantityInput.value) || 1;
      console.log("  - Current quantity:", currentQty);

      if (currentQty > 1) {
        quantityInput.value = currentQty - 1;
        console.log("  - New quantity:", quantityInput.value);
        updateTotalPrice();
      } else {
        console.log("  ⚠️ Cannot decrease below 1");
      }
    });
  } else {
    console.error("❌ Decrease button or quantity input not found!");
  }

  if (increaseBtn && quantityInput) {
    console.log("✅ Attaching click listener to increase button");
    increaseBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      console.log("➕ Increase button clicked");
      const currentQty = parseInt(quantityInput.value) || 1;
      console.log("  - Current quantity:", currentQty);

      if (currentQty < 100) {
        quantityInput.value = currentQty + 1;
        console.log("  - New quantity:", quantityInput.value);
        updateTotalPrice();
      } else {
        console.log("  ⚠️ Cannot increase above 100");
      }
    });
  } else {
    console.error("❌ Increase button or quantity input not found!");
  }

  if (quantityInput) {
    console.log("✅ Attaching input/change listeners to quantity input");
    quantityInput.addEventListener("input", function () {
      console.log("📝 Quantity input changed:", this.value);
      updateTotalPrice();
    });

    quantityInput.addEventListener("change", function () {
      let val = parseInt(this.value) || 1;
      if (val < 1) val = 1;
      if (val > 100) val = 100;
      this.value = val;
      console.log("✅ Quantity validated:", val);
      updateTotalPrice();
    });
  }

  // Form submission
  const bookingForm = document.getElementById("steamPressBookingForm");
  if (bookingForm) {
    console.log("✅ Attaching submit listener to booking form");
    bookingForm.addEventListener("submit", handleFormSubmit);
  } else {
    console.error("❌ Booking form not found!");
  }

  // Order modal close buttons
  const orderModalClose = document.getElementById("orderModalClose");
  if (orderModalClose) {
    orderModalClose.addEventListener("click", closeOrderModal);
  }

  const btnTrackOrder = document.getElementById("btnTrackOrder");
  if (btnTrackOrder) {
    btnTrackOrder.addEventListener("click", () => {
      window.location.href = "orders.html";
    });
  }

  const btnContinueShopping = document.getElementById("btnContinueShopping");
  if (btnContinueShopping) {
    btnContinueShopping.addEventListener("click", () => {
      closeOrderModal();
      window.location.reload();
    });
  }

  console.log("✅ Event listeners initialized");
}

// ============================================
// HANDLE SERVICE SELECTION CHANGE
// ============================================
function handleServiceChange(event) {
  console.log("\n🎯 ========================================");
  console.log("🎯 HANDLING SERVICE SELECTION CHANGE");
  console.log("🎯 ========================================");

  const selectedOption = event.target.options[event.target.selectedIndex];
  console.log("📋 Selected option:", selectedOption);
  console.log("  - Value:", selectedOption.value);
  console.log("  - Text:", selectedOption.textContent);
  console.log("  - Dataset:", selectedOption.dataset);

  if (!selectedOption.value) {
    console.log("❌ No service selected (empty value)");
    selectedService = null;
    document.getElementById("unitPrice").textContent = "₹0.00";
    document.getElementById("unitType").textContent = "-";
    document.getElementById("totalAmount").textContent = "₹0.00";
    return;
  }

  // Get service details from option dataset
  const serviceId = parseInt(selectedOption.value);
  const serviceName = selectedOption.dataset.name;
  const price = parseFloat(selectedOption.dataset.price);
  const unit = selectedOption.dataset.unit;

  selectedService = {
    id: serviceId,
    name: serviceName,
    price: price,
    unit: unit,
  };

  console.log("✅ Service selected:");
  console.log(JSON.stringify(selectedService, null, 2));

  // Update price display
  document.getElementById("unitPrice").textContent = `₹${price.toFixed(2)}`;
  document.getElementById("unitType").textContent = unit;

  // Update total
  updateTotalPrice();

  console.log("✅ Price display updated");
}

// ============================================
// UPDATE TOTAL PRICE
// ============================================
function updateTotalPrice() {
  if (!selectedService) {
    document.getElementById("totalAmount").textContent = "₹0.00";
    return;
  }

  const quantityInput = document.getElementById("quantityInput");
  const quantity = parseInt(quantityInput.value) || 1;

  const total = selectedService.price * quantity;
  document.getElementById("totalAmount").textContent = `₹${total.toFixed(2)}`;

  console.log(
    `💰 Total updated: ${quantity} × ₹${
      selectedService.price
    } = ₹${total.toFixed(2)}`
  );
}

// ============================================
// HANDLE FORM SUBMISSION
// ============================================
async function handleFormSubmit(event) {
  event.preventDefault();
  console.log("\n📋 ========================================");
  console.log("📋 FORM SUBMITTED");
  console.log("📋 ========================================");

  // Check if user is logged in
  if (!currentUser) {
    console.log("❌ User not logged in");
    showNotification("Please login first to place an order", "error");

    if (typeof window.openAuthModal === "function") {
      setTimeout(() => {
        window.openAuthModal("login");
      }, 1000);
    }
    return;
  }

  // Validate service selection
  if (!selectedService) {
    console.log("❌ No service selected");
    showNotification("Please select a service", "error");
    document.getElementById("serviceSelect").focus();
    return;
  }

  console.log("✅ Validation passed, preparing order data...");

  // Get form data
  const quantityInput = document.getElementById("quantityInput");
  const pickupDate = document.getElementById("pickupDate").value;
  const pickupTime = document.getElementById("pickupTime").value;
  const pickupAddress = document.getElementById("pickupAddress").value;
  const specialInstructions = document.getElementById(
    "specialInstructions"
  ).value;

  // Validate required fields
  if (!pickupDate) {
    showNotification("Please select a pickup date", "error");
    document.getElementById("pickupDate").focus();
    return;
  }

  if (!pickupTime) {
    showNotification("Please select a pickup time", "error");
    document.getElementById("pickupTime").focus();
    return;
  }

  if (!pickupAddress.trim()) {
    showNotification("Please enter pickup address", "error");
    document.getElementById("pickupAddress").focus();
    return;
  }

  const quantity = parseInt(quantityInput.value) || 1;
  const totalAmount = selectedService.price * quantity;

  // Prepare order data
  const orderData = {
    serviceId: selectedService.id,
    serviceName: selectedService.name,
    quantity: quantity,
    unitPrice: selectedService.price,
    totalAmount: totalAmount,
    unit: selectedService.unit,
    pickupDate: pickupDate,
    pickupTime: pickupTime,
    pickupAddress: pickupAddress.trim(),
    specialInstructions: specialInstructions.trim() || null,
    categoryId: STEAM_PRESS_CATEGORY_ID,
  };

  console.log("📤 Order data prepared:");
  console.log(JSON.stringify(orderData, null, 2));

  // Show loading state
  const submitBtn = document.getElementById("submitBookingBtn");
  const btnText = submitBtn.querySelector(".btn-text");
  const btnLoader = submitBtn.querySelector(".btn-loader");

  submitBtn.disabled = true;
  btnText.style.display = "none";
  btnLoader.style.display = "inline-block";

  try {
    // Get JWT token
    const token =
      localStorage.getItem("authToken") || localStorage.getItem("jwtToken");

    console.log("📡 Sending order to API...");
    const response = await fetch(`${API_BASE_URL}/api/cart/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderData),
    });

    const data = await response.json();
    console.log("📥 Order response:", data);

    if (data.success) {
      console.log("✅ Order placed successfully!");
      showOrderSuccessModal(orderData);
      showNotification("Order placed successfully!", "success");

      // Reset form
      setTimeout(() => {
        document.getElementById("steamPressBookingForm").reset();
        selectedService = null;
        document.getElementById("unitPrice").textContent = "₹0.00";
        document.getElementById("unitType").textContent = "-";
        document.getElementById("totalAmount").textContent = "₹0.00";
        setMinimumPickupDate();
      }, 500);
    } else {
      console.error("❌ Order failed:", data.message);
      showNotification(
        data.message || "Failed to place order. Please try again.",
        "error"
      );
    }
  } catch (error) {
    console.error("❌ Error placing order:", error);
    showNotification(
      "Error connecting to server. Please try again later.",
      "error"
    );
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    btnText.style.display = "flex";
    btnLoader.style.display = "none";
  }
}

// ============================================
// SHOW ORDER SUCCESS MODAL
// ============================================
function showOrderSuccessModal(orderData) {
  const modal = document.getElementById("orderSuccessModal");
  const total = orderData.quantity * orderData.unitPrice;

  document.getElementById("summaryService").textContent = orderData.serviceName;
  document.getElementById(
    "summaryQuantity"
  ).textContent = `${orderData.quantity} ${orderData.unit}`;
  document.getElementById(
    "summaryUnitPrice"
  ).textContent = `₹${orderData.unitPrice.toFixed(2)}`;
  document.getElementById("summaryTotal").textContent = `₹${total.toFixed(2)}`;
  document.getElementById("summaryPickupDate").textContent = formatDate(
    orderData.pickupDate
  );
  document.getElementById("summaryPickupTime").textContent =
    orderData.pickupTime;
  document.getElementById("summaryAddress").textContent =
    orderData.pickupAddress;

  modal.classList.add("active");
  playSuccessSound();
}

function closeOrderModal() {
  const modal = document.getElementById("orderSuccessModal");
  modal.classList.remove("active");
}

// ============================================
// FAQ ACCORDION
// ============================================
function initializeFAQ() {
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach((item) => {
    const question = item.querySelector(".faq-question");
    question.addEventListener("click", () => {
      faqItems.forEach((otherItem) => {
        if (otherItem !== item) {
          otherItem.classList.remove("active");
        }
      });
      item.classList.toggle("active");
    });
  });

  console.log("✅ FAQ accordion initialized");
}

// ============================================
// SET MINIMUM PICKUP DATE
// ============================================
function setMinimumPickupDate() {
  const pickupDateInput = document.getElementById("pickupDate");
  if (!pickupDateInput) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");

  const minDate = `${year}-${month}-${day}`;
  pickupDateInput.setAttribute("min", minDate);

  console.log("✅ Minimum pickup date set to:", minDate);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: "numeric", month: "long", day: "numeric" };
  return date.toLocaleDateString("en-IN", options);
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `steam-notification steam-notification-${type}`;

  const icon =
    type === "success"
      ? "fa-check-circle"
      : type === "error"
      ? "fa-exclamation-circle"
      : type === "warning"
      ? "fa-exclamation-triangle"
      : "fa-info-circle";

  notification.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${message}</span>
  `;

  notification.style.cssText = `
    position: fixed;
    bottom: 100px;
    right: 30px;
    background: ${
      type === "success"
        ? "#10b981"
        : type === "error"
        ? "#ef4444"
        : type === "warning"
        ? "#f59e0b"
        : "#3b82f6"
    };
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-weight: 600;
    z-index: 10000;
    animation: slideInRight 0.3s ease;
    font-family: inherit;
    max-width: 400px;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

function playSuccessSound() {
  // Optional: Add success sound
}

// ============================================
// ANIMATION STYLES
// ============================================
if (!document.getElementById("steam-notification-styles")) {
  const style = document.createElement("style");
  style.id = "steam-notification-styles";
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
    @media (max-width: 768px) {
      .steam-notification {
        right: 20px !important;
        bottom: 80px !important;
        left: 20px !important;
        max-width: calc(100% - 40px) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// LISTEN FOR AUTH CHANGES
// ============================================
window.addEventListener("storage", (e) => {
  if (e.key === "authToken" || e.key === "userData" || e.key === "jwtToken") {
    console.log("🔄 Auth state changed, rechecking...");
    checkUserAuth();
  }
});

window.addEventListener("authStateChanged", (e) => {
  console.log("🔄 Auth state changed event received");
  checkUserAuth();
});

console.log("\n✨ ========================================");
console.log("✨ STEAM PRESS JAVASCRIPT LOADED");
console.log("✨ ========================================\n");
