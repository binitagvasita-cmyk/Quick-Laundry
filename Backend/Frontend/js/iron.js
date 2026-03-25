// ============================================
// IRON SERVICE PAGE JAVASCRIPT - FIXED
// Uses global window.safeStorage directly (no redeclaration)
// ============================================

console.log("🚀 Iron Service JavaScript Loading...");

// ============================================
// USE GLOBAL STORAGE - NO LOCAL DECLARATION ✅
// ============================================

// Ensure safeStorage is available globally (created by storage-utils.js)
if (!window.safeStorage) {
  console.warn("⚠️ window.safeStorage not found, creating fallback");
  window.safeStorage = {
    getItem: (key) => {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn("localStorage not available:", e);
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn("localStorage not available:", e);
      }
    },
    removeItem: (key) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn("localStorage not available:", e);
      }
    },
  };
}

// ============================================
// IMAGE SLIDER FUNCTIONALITY
// ============================================

class HeroSlider {
  constructor() {
    this.currentSlide = 0;
    this.slides = document.querySelectorAll(".slide");
    this.dots = document.querySelectorAll(".dot");
    this.prevBtn = document.getElementById("prevSlide");
    this.nextBtn = document.getElementById("nextSlide");
    this.autoPlayInterval = null;

    this.init();
  }

  init() {
    if (!this.slides.length) {
      console.warn("No slides found");
      return;
    }

    // Event listeners
    if (this.prevBtn) {
      this.prevBtn.addEventListener("click", () => this.prevSlide());
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener("click", () => this.nextSlide());
    }

    // Dots click
    this.dots.forEach((dot, index) => {
      dot.addEventListener("click", () => this.goToSlide(index));
    });

    // Keyboard navigation
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") this.prevSlide();
      if (e.key === "ArrowRight") this.nextSlide();
    });

    // Start autoplay
    this.startAutoPlay();

    // Pause on hover
    const slider = document.querySelector(".hero-slider");
    if (slider) {
      slider.addEventListener("mouseenter", () => this.stopAutoPlay());
      slider.addEventListener("mouseleave", () => this.startAutoPlay());
    }

    console.log("✅ Hero slider initialized");
  }

  showSlide(index) {
    // Remove active from all slides
    this.slides.forEach((slide) => slide.classList.remove("active"));
    this.dots.forEach((dot) => dot.classList.remove("active"));

    // Wrap around
    if (index >= this.slides.length) {
      this.currentSlide = 0;
    } else if (index < 0) {
      this.currentSlide = this.slides.length - 1;
    } else {
      this.currentSlide = index;
    }

    // Add active to current slide
    this.slides[this.currentSlide].classList.add("active");
    this.dots[this.currentSlide].classList.add("active");
  }

  nextSlide() {
    this.showSlide(this.currentSlide + 1);
  }

  prevSlide() {
    this.showSlide(this.currentSlide - 1);
  }

  goToSlide(index) {
    this.showSlide(index);
  }

  startAutoPlay() {
    this.stopAutoPlay(); // Clear any existing interval
    this.autoPlayInterval = setInterval(() => {
      this.nextSlide();
    }, 5000); // Change slide every 5 seconds
  }

  stopAutoPlay() {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
      this.autoPlayInterval = null;
    }
  }
}

// ============================================
// ORDER FORM FUNCTIONALITY
// ============================================

class IronOrderForm {
  constructor() {
    this.form = document.getElementById("ironOrderForm");
    this.serviceTypeSelect = document.getElementById("serviceType");
    this.quantityInput = document.getElementById("quantity");
    this.pickupDateInput = document.getElementById("pickupDate");
    this.pickupTimeSelect = document.getElementById("pickupTime");
    this.pickupAddressTextarea = document.getElementById("pickupAddress");
    this.specialInstructionsTextarea = document.getElementById(
      "specialInstructions"
    );

    // Summary elements
    this.summaryServiceType = document.getElementById("summaryServiceType");
    this.summaryQuantity = document.getElementById("summaryQuantity");
    this.summaryPricePerPiece = document.getElementById("summaryPricePerPiece");
    this.summaryTotal = document.getElementById("summaryTotal");

    this.selectedService = null;
    this.unitPrice = 0;

    this.init();
  }

  init() {
    if (!this.form) {
      console.warn("Order form not found");
      return;
    }

    // Set minimum date to today
    this.setMinDate();

    // Event listeners for live summary
    this.serviceTypeSelect.addEventListener("change", () =>
      this.updateSummary()
    );
    this.quantityInput.addEventListener("input", () => this.updateSummary());

    // ── Wire the two buttons defined in HTML ──
    const addToCartBtn = document.getElementById("addToCartBtn");
    const placeOrderBtn = document.getElementById("placeOrderBtn");

    if (addToCartBtn)
      addToCartBtn.addEventListener("click", () => this.handleAddToCart());
    if (placeOrderBtn)
      placeOrderBtn.addEventListener("click", () => this.openOrderPreview());

    // Auto-fill address + name + phone from profile
    this.loadUserProfile();

    // Inject order preview modal into DOM
    this.injectOrderPreviewModal();

    // Initialize live summary
    this.updateSummary();

    console.log("✅ Order form initialized");
  }

  // ─────────────────────────────────────────
  // AUTO-FILL NAME / PHONE / ADDRESS FROM PROFILE
  // ─────────────────────────────────────────
  async loadUserProfile() {
    const isLoggedIn = window.safeStorage?.getItem("isLoggedIn") === "true";
    const jwtToken = window.safeStorage?.getItem("jwtToken");
    if (!isLoggedIn || !jwtToken) return;

    try {
      const response = await fetch(window.location.origin + "/api/profile/", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
      });

      if (!response.ok) {
        console.warn("⚠️ Profile fetch failed:", response.status);
        return;
      }

      const result = await response.json();
      const user = result?.data?.user || result?.data || {};

      // Store for use in the preview modal
      this._profileName = user.full_name || "";
      this._profilePhone = user.phone || "";

      // Build address string
      const parts = [];
      if (user.address) parts.push(user.address);
      if (user.city) parts.push(user.city);
      if (user.pincode) parts.push(user.pincode);
      this._profileAddress = parts.join(", ");

      // Pre-fill address in the main form
      if (this.pickupAddressTextarea && this._profileAddress) {
        this.pickupAddressTextarea.value = this._profileAddress;
        const hint = document.getElementById("addressAutofillHint");
        if (hint) hint.style.display = "flex";
        console.log("✅ Address auto-filled:", this._profileAddress);
      }
    } catch (err) {
      console.warn("⚠️ Could not load profile:", err.message);
    }
  }

  // ─────────────────────────────────────────
  // ADD TO CART HANDLER
  // ─────────────────────────────────────────
  async handleAddToCart() {
    const isLoggedIn = window.safeStorage?.getItem("isLoggedIn") === "true";
    const jwtToken = window.safeStorage?.getItem("jwtToken");
    if (!isLoggedIn || !jwtToken) {
      this.showNotification("Please login to add items to cart", "error");
      if (typeof openAuthModal === "function")
        setTimeout(() => openAuthModal("login"), 800);
      return;
    }

    if (!this.validateForm()) return;

    const addBtn = document.getElementById("addToCartBtn");
    const origHTML = addBtn ? addBtn.innerHTML : "";
    if (addBtn) {
      addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
      addBtn.disabled = true;
    }

    const selectedOption =
      this.serviceTypeSelect.options[this.serviceTypeSelect.selectedIndex];
    const quantity = parseInt(this.quantityInput.value);

    const cartData = {
      serviceId: this.serviceTypeSelect.value === "urgent" ? 1 : 1,
      serviceName: "Iron Per Cloth",
      serviceType: this.serviceTypeSelect.value,
      quantity: quantity,
      unitPrice: this.unitPrice,
      unit: "piece",
      pickupDate: this.pickupDateInput.value,
      pickupTime: this.pickupTimeSelect.value,
      pickupAddress: this.pickupAddressTextarea.value.trim(),
      specialInstructions: this.specialInstructionsTextarea.value.trim() || "",
    };

    try {
      const response = await fetch(window.location.origin + "/api/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(cartData),
      });

      const result = await response.json();

      if (response.status === 401) {
        window.safeStorage.removeItem("jwtToken");
        window.safeStorage.removeItem("isLoggedIn");
        this.showNotification("Session expired. Please login again.", "error");
        setTimeout(() => {
          if (typeof openAuthModal === "function") openAuthModal("login");
        }, 800);
        return;
      }

      if (result.success) {
        this.showNotification("✅ Added to cart successfully!", "success");
        // Update cart badge if available
        if (typeof updateCartBadge === "function")
          setTimeout(updateCartBadge, 500);
        // Reset form
        this.form.reset();
        this.updateSummary();
        setTimeout(() => this.loadUserProfile(), 400);
      } else {
        this.showNotification(
          result.message || "Failed to add to cart",
          "error"
        );
      }
    } catch (err) {
      console.error("❌ Add to cart error:", err);
      this.showNotification("Network error. Please try again.", "error");
    } finally {
      if (addBtn) {
        addBtn.innerHTML = origHTML;
        addBtn.disabled = false;
      }
    }
  }

  // ─────────────────────────────────────────
  // INJECT ORDER PREVIEW MODAL (enhanced with name/phone)
  // ─────────────────────────────────────────
  injectOrderPreviewModal() {
    if (document.getElementById("orderPreviewOverlay")) return;

    const html = `
      <div id="orderPreviewOverlay" class="iron-preview-overlay">
        <div class="iron-preview-modal">

          <!-- Header -->
          <div class="iron-preview-header">
            <div class="iron-preview-header-icon"><i class="fas fa-receipt"></i></div>
            <div>
              <h2>Order Summary</h2>
              <p>Review and confirm your order details</p>
            </div>
            <button class="iron-preview-close" onclick="document.getElementById('orderPreviewOverlay').classList.remove('active')" aria-label="Close">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <!-- Service Summary (read-only) -->
          <div class="iron-preview-section">
            <div class="iron-preview-section-title">
              <i class="fas fa-th-list"></i> Service Details
            </div>
            <div id="previewServiceSummary" class="iron-preview-service-box"></div>
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
                <input type="text" id="previewCustomerName" placeholder="Your full name" />
              </div>
              <div class="iron-preview-form-group">
                <label><i class="fas fa-phone"></i> Phone Number *</label>
                <input type="tel" id="previewCustomerPhone" placeholder="10-digit mobile number" maxlength="10" />
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
              <textarea id="previewPickupAddress" rows="2" placeholder="Enter pickup address"></textarea>
            </div>
            <div class="iron-preview-form-row">
              <div class="iron-preview-form-group">
                <label><i class="fas fa-calendar"></i> Pickup Date *</label>
                <input type="date" id="previewPickupDate" />
              </div>
              <div class="iron-preview-form-group">
                <label><i class="fas fa-clock"></i> Pickup Time *</label>
                <select id="previewPickupTime">
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
              <textarea id="previewSpecialInstructions" rows="2" placeholder="e.g., starch, fold vs hang, delicate fabric…"></textarea>
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
                <select id="previewFoldPref">
                  <option value="folded">Folded</option>
                  <option value="hanged">On Hanger</option>
                  <option value="any">No Preference</option>
                </select>
              </div>
              <div class="iron-preview-form-group">
                <label><i class="fas fa-spray-can"></i> Starch</label>
                <select id="previewStarchPref">
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
              <label class="iron-payment-option active" id="payLabelCod">
                <input type="radio" name="previewPayment" value="cod" checked />
                <i class="fas fa-money-bill-wave"></i>
                <span>Cash on Delivery</span>
              </label>
              <label class="iron-payment-option" id="payLabelOnline">
                <input type="radio" name="previewPayment" value="online" />
                <i class="fas fa-globe"></i>
                <span>Online Payment</span>
              </label>
            </div>
          </div>

          <!-- Error message -->
          <div id="previewError" class="iron-preview-error" style="display:none;"></div>

          <!-- Footer Buttons -->
          <div class="iron-preview-footer">
            <button class="iron-preview-back-btn" onclick="document.getElementById('orderPreviewOverlay').classList.remove('active')">
              <i class="fas fa-arrow-left"></i> Go Back
            </button>
            <button id="confirmOrderBtn" class="iron-preview-confirm-btn">
              <i class="fas fa-check-circle"></i> Confirm Order
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);

    // Payment option toggle active style
    document
      .querySelectorAll('input[name="previewPayment"]')
      .forEach((radio) => {
        radio.addEventListener("change", () => {
          document
            .querySelectorAll(".iron-payment-option")
            .forEach((l) => l.classList.remove("active"));
          radio.closest(".iron-payment-option")?.classList.add("active");
        });
      });

    // Confirm button
    document
      .getElementById("confirmOrderBtn")
      .addEventListener("click", () => this.confirmOrder());
  }
  // ─────────────────────────────────────────
  // OPEN ORDER PREVIEW MODAL
  // ─────────────────────────────────────────
  openOrderPreview() {
    const isLoggedIn = window.safeStorage?.getItem("isLoggedIn") === "true";
    const jwtToken = window.safeStorage?.getItem("jwtToken");
    if (!isLoggedIn || !jwtToken) {
      this.showNotification("Please login to place an order", "error");
      if (typeof openAuthModal === "function")
        setTimeout(() => openAuthModal("login"), 800);
      return;
    }

    if (!this.validateForm()) return;

    const selectedOption =
      this.serviceTypeSelect.options[this.serviceTypeSelect.selectedIndex];
    const quantity = parseInt(this.quantityInput.value);
    const totalPrice = (this.unitPrice * quantity).toFixed(2);

    // ── Populate read-only service summary ──
    document.getElementById("previewServiceSummary").innerHTML = `
      <div class="iron-preview-summary-row">
        <span><i class="fas fa-tshirt" style="color:#7c3aed;margin-right:6px;"></i>
          <b>Service:</b> ${selectedOption.textContent.trim()}</span>
        <span class="iron-preview-price">₹${this.unitPrice}/piece</span>
      </div>
      <div class="iron-preview-summary-row iron-preview-summary-total">
        <span><i class="fas fa-layer-group" style="color:#7c3aed;margin-right:6px;"></i>
          <b>Quantity:</b> ${quantity} piece${quantity !== 1 ? "s" : ""}</span>
        <span class="iron-preview-total-amt">Total: ₹${totalPrice}</span>
      </div>
    `;

    // ── Pre-fill customer details from profile ──
    const nameEl = document.getElementById("previewCustomerName");
    const phoneEl = document.getElementById("previewCustomerPhone");
    if (nameEl)
      nameEl.value =
        this._profileName || window.safeStorage?.getItem("userName") || "";
    if (phoneEl) phoneEl.value = this._profilePhone || "";

    // ── Pre-fill pickup details from main form ──
    document.getElementById("previewPickupDate").value =
      this.pickupDateInput.value;
    document.getElementById("previewPickupDate").min = this.pickupDateInput.min;
    document.getElementById("previewPickupDate").max = this.pickupDateInput.max; // ✅ enforce 5-day limit
    document.getElementById("previewPickupTime").value =
      this.pickupTimeSelect.value;
    document.getElementById("previewPickupAddress").value =
      this.pickupAddressTextarea.value;
    document.getElementById("previewSpecialInstructions").value =
      this.specialInstructionsTextarea.value;

    // Reset error
    const errEl = document.getElementById("previewError");
    if (errEl) errEl.style.display = "none";

    // Show modal
    const overlay = document.getElementById("orderPreviewOverlay");
    if (overlay) overlay.classList.add("active");
  }

  async confirmOrder() {
    const jwtToken = window.safeStorage?.getItem("jwtToken");
    if (!jwtToken) return;

    const name =
      document.getElementById("previewCustomerName")?.value.trim() || "";
    const phone =
      document.getElementById("previewCustomerPhone")?.value.trim() || "";
    const address = document
      .getElementById("previewPickupAddress")
      .value.trim();
    const date = document.getElementById("previewPickupDate").value;
    const time = document.getElementById("previewPickupTime").value;
    const payment =
      document.querySelector('input[name="previewPayment"]:checked')?.value ||
      "cod";
    const foldPref = document.getElementById("previewFoldPref")?.value || "any";
    const starchPref =
      document.getElementById("previewStarchPref")?.value || "none";
    const baseInstructions = document
      .getElementById("previewSpecialInstructions")
      .value.trim();

    // Combine preferences into special instructions
    const prefParts = [];
    if (foldPref !== "any") prefParts.push(`Folding: ${foldPref}`);
    if (starchPref !== "none") prefParts.push(`Starch: ${starchPref}`);
    if (baseInstructions) prefParts.push(baseInstructions);
    const specialInstructions = prefParts.join(" | ");

    const showErr = (msg) => {
      const el = document.getElementById("previewError");
      if (el) {
        el.textContent = msg;
        el.style.display = "block";
      }
    };

    if (!name || name.length < 2)
      return showErr("Please enter your full name.");
    if (!phone || phone.length < 10)
      return showErr("Please enter a valid 10-digit phone number.");
    if (!address || address.length < 5)
      return showErr("Please enter a complete pickup address.");
    if (!date) return showErr("Please select a pickup date.");
    if (!time) return showErr("Please select a pickup time.");

    const selectedOption =
      this.serviceTypeSelect.options[this.serviceTypeSelect.selectedIndex];
    const serviceType = this.serviceTypeSelect.value;
    const quantity = parseInt(this.quantityInput.value);

    // ── If online payment → show QR modal first ──
    if (payment === "online") {
      const overlay = document.getElementById("orderPreviewOverlay");
      if (overlay) overlay.classList.remove("active");
      this.showQRPaymentModal({
        name,
        phone,
        address,
        date,
        time,
        payment,
        serviceType,
        quantity,
        unitPrice: this.unitPrice,
        specialInstructions,
        totalAmount: this.unitPrice * quantity,
      });
      const confirmBtn = document.getElementById("confirmOrderBtn");
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML =
          '<i class="fas fa-check-circle"></i> Confirm Order';
      }
      return;
    }

    const orderData = {
      serviceId: 1,
      serviceName: "Iron Per Cloth",
      serviceType: serviceType,
      quantity: quantity,
      unitPrice: this.unitPrice,
      unit: "piece",
      pickupDate: date,
      pickupTime: time,
      pickupAddress: address,
      specialInstructions: specialInstructions,
      paymentMethod: payment,
    };

    const confirmBtn = document.getElementById("confirmOrderBtn");
    const origText = confirmBtn ? confirmBtn.innerHTML : "";
    if (confirmBtn) {
      confirmBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Placing Order...';
      confirmBtn.disabled = true;
    }

    try {
      const response = await fetch(
        window.location.origin + "/api/orders/place",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwtToken}`,
          },
          body: JSON.stringify(orderData),
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        window.safeStorage.removeItem("jwtToken");
        window.safeStorage.removeItem("isLoggedIn");
        const overlay = document.getElementById("orderPreviewOverlay");
        if (overlay) overlay.classList.remove("active");
        this.showNotification("Session expired. Please login again.", "error");
        setTimeout(() => {
          if (typeof openAuthModal === "function") openAuthModal("login");
        }, 800);
        return;
      }

      if (result.success) {
        const overlay = document.getElementById("orderPreviewOverlay");
        if (overlay) overlay.classList.remove("active");

        this.showOrderConfirmation({
          orderNumber: result.data?.orderNumber,
          pickup_date: date,
          pickup_time: time,
          quantity: quantity,
          totalAmount: result.data?.totalAmount,
          pickup_address: address,
        });

        this.form.reset();
        this.updateSummary();
        setTimeout(() => this.loadUserProfile(), 400);
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

  setMinDate() {
    const today = new Date();

    // Min date: tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Max date: 5 days from today
    // (helps admin manage schedule — orders too far ahead are hard to plan)
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 5);

    const minDateStr = tomorrow.toISOString().split("T")[0];
    const maxDateStr = maxDate.toISOString().split("T")[0];

    this.pickupDateInput.setAttribute("min", minDateStr);
    this.pickupDateInput.setAttribute("max", maxDateStr);

    console.log(
      `📅 Pickup date window: ${minDateStr} → ${maxDateStr} (5-day limit)`
    );
  }

  updateSummary() {
    const selectedOption =
      this.serviceTypeSelect.options[this.serviceTypeSelect.selectedIndex];
    const serviceType = this.serviceTypeSelect.value;
    const quantity = parseInt(this.quantityInput.value) || 0;

    if (serviceType && selectedOption.dataset.price) {
      this.unitPrice = parseFloat(selectedOption.dataset.price);
      const serviceLabel = selectedOption.textContent;

      this.summaryServiceType.textContent = serviceLabel;
      this.summaryQuantity.textContent = `${quantity} piece${
        quantity !== 1 ? "s" : ""
      }`;
      this.summaryPricePerPiece.textContent = `₹${this.unitPrice}/piece`;

      const total = this.unitPrice * quantity;
      this.summaryTotal.textContent = `₹${total.toFixed(2)}`;
    } else {
      this.summaryServiceType.textContent = "-";
      this.summaryQuantity.textContent = "-";
      this.summaryPricePerPiece.textContent = "-";
      this.summaryTotal.textContent = "₹0";
    }
  }

  // ─────────────────────────────────────────
  // LEGACY handleSubmit — kept for safety but not wired to form submit
  // (buttons use handleAddToCart and openOrderPreview instead)
  // ─────────────────────────────────────────
  async handleSubmit(e) {
    if (e) e.preventDefault();
    // Redirect to Add to Cart behavior
    await this.handleAddToCart();
  }

  validateForm() {
    const serviceType = this.serviceTypeSelect.value;
    const quantity = parseInt(this.quantityInput.value);
    const pickupDate = this.pickupDateInput.value;
    const pickupTime = this.pickupTimeSelect.value;
    const pickupAddress = this.pickupAddressTextarea.value.trim();

    if (!serviceType) {
      this.showNotification("Please select a service type", "error");
      this.serviceTypeSelect.focus();
      return false;
    }

    if (!quantity || quantity < 1) {
      this.showNotification("Please enter a valid quantity", "error");
      this.quantityInput.focus();
      return false;
    }

    if (!pickupDate) {
      this.showNotification("Please select a pickup date", "error");
      this.pickupDateInput.focus();
      return false;
    }

    // Validate date is not in the past
    const selectedDate = new Date(pickupDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      this.showNotification("Pickup date cannot be in the past", "error");
      this.pickupDateInput.focus();
      return false;
    }

    // ── Validate date is within 5-day booking window ──
    const maxAllowed = new Date(today);
    maxAllowed.setDate(maxAllowed.getDate() + 5);
    if (selectedDate > maxAllowed) {
      this.showNotification(
        "⚠️ Pickup date must be within 5 days. Please choose an earlier date.",
        "error"
      );
      this.pickupDateInput.focus();
      return false;
    }

    if (!pickupTime) {
      this.showNotification("Please select a pickup time", "error");
      this.pickupTimeSelect.focus();
      return false;
    }

    if (!pickupAddress) {
      this.showNotification("Please enter your pickup address", "error");
      this.pickupAddressTextarea.focus();
      return false;
    }

    if (pickupAddress.length < 10) {
      this.showNotification("Please enter a complete pickup address", "error");
      this.pickupAddressTextarea.focus();
      return false;
    }

    return true;
  }

  // ─────────────────────────────────────────
  // QR PAYMENT MODAL
  // ─────────────────────────────────────────
  showQRPaymentModal(data) {
    document.getElementById("ironQRPaymentModal")?.remove();

    const amount = (data.totalAmount || 0).toFixed(2);
    const upiId = "9173576732@ybl"; // 🔁 Replace with your real UPI ID
    const upiLink = `upi://pay?pa=${upiId}&pn=QuickLaundry&am=${amount}&cu=INR&tn=IronOrder`;
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      upiLink
    )}`;

    const modal = document.createElement("div");
    modal.id = "ironQRPaymentModal";
    modal.className = "iqm";
    modal.innerHTML = `
      <div class="iqm__backdrop"></div>
      <div class="iqm__box">

        <div class="iqm__header">
          <div class="iqm__header-icon"><i class="fas fa-qrcode"></i></div>
          <div>
            <h2>Scan &amp; Pay</h2>
            <p>Complete payment to confirm order</p>
          </div>
          <button class="iqm__close" id="iqmClose"><i class="fas fa-times"></i></button>
        </div>

        <div class="iqm__amount">
          <span class="iqm__amount-label">Amount to Pay</span>
          <span class="iqm__amount-value">₹${amount}</span>
        </div>

        <div class="iqm__qr-wrapper">
          <img
            src="${qrImgUrl}"
            alt="UPI QR Code"
            class="iqm__qr-img"
            onerror="this.src='https://placehold.co/200x200/6b46c1/white?text=QR+Code'"
          />
          <div class="iqm__qr-hint">
            <i class="fas fa-mobile-alt"></i>
            Scan with PhonePe, GPay, Paytm or any UPI app
          </div>
        </div>

        <div class="iqm__upi-row">
          <span class="iqm__upi-label">UPI ID:</span>
          <span class="iqm__upi-id">${upiId}</span>
          <button class="iqm__copy-btn" onclick="navigator.clipboard.writeText('${upiId}').then(()=>{ this.innerHTML='<i class=\"fas fa-check\"></i> Copied!'; setTimeout(()=>{ this.innerHTML='<i class=\"fas fa-copy\"></i> Copy'; },2000); })">
            <i class="fas fa-copy"></i> Copy
          </button>
        </div>

        <div class="iqm__steps">
          <div class="iqm__step"><span class="iqm__step-num">1</span><span>Open your UPI app</span></div>
          <div class="iqm__step"><span class="iqm__step-num">2</span><span>Scan the QR code above</span></div>
          <div class="iqm__step"><span class="iqm__step-num">3</span><span>Pay ₹${amount} &amp; click below</span></div>
        </div>

        <div id="iqmError" class="iqm__error" style="display:none;"></div>

        <div class="iqm__footer">
          <button class="iqm__btn iqm__btn--back" id="iqmBack">
            <i class="fas fa-arrow-left"></i> Go Back
          </button>
          <button class="iqm__btn iqm__btn--paid" id="iqmPaid">
            <i class="fas fa-check-circle"></i> I've Paid ₹${amount}
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add("iqm--open"));

    // Inject CSS once
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
        [data-theme="dark"] .iqm__upi-row{background:rgba(255,255,255,.04);}
        .iqm__upi-label{font-size:.8rem;font-weight:600;color:var(--text-secondary,#6b7280);flex-shrink:0;}
        .iqm__upi-id{font-size:.88rem;font-weight:700;color:#6b46c1;flex:1;}
        .iqm__copy-btn{font-size:.75rem;padding:.3rem .7rem;border-radius:8px;background:rgba(107,70,193,.1);color:#6b46c1;border:1px solid rgba(107,70,193,.3);cursor:pointer;font-weight:600;transition:all .2s;white-space:nowrap;}
        .iqm__copy-btn:hover{background:#6b46c1;color:#fff;}
        .iqm__steps{display:flex;flex-direction:column;gap:.5rem;margin:0 1.5rem .75rem;}
        .iqm__step{display:flex;align-items:center;gap:.75rem;font-size:.85rem;color:var(--text-secondary,#6b7280);font-weight:500;}
        .iqm__step-num{width:22px;height:22px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#6b46c1,#a855f7);color:#fff;font-size:.75rem;font-weight:800;display:flex;align-items:center;justify-content:center;}
        .iqm__error{margin:.25rem 1.5rem;padding:.7rem 1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:#ef4444;font-size:.85rem;font-weight:600;}
        .iqm__footer{display:flex;gap:.75rem;padding:1rem 1.5rem 1.25rem;border-top:2px solid var(--border-color,#e5e7eb);}
        [data-theme="dark"] .iqm__footer{border-color:rgba(167,139,250,.2);}
        .iqm__btn{display:flex;align-items:center;justify-content:center;gap:.5rem;padding:.8rem 1rem;border-radius:12px;font-size:.92rem;font-weight:700;cursor:pointer;border:none;transition:all .3s ease;}
        .iqm__btn--back{background:var(--secondary-bg,#f3f4f6);color:var(--text-primary,#111);border:2px solid var(--border-color,#e5e7eb);flex-shrink:0;}
        .iqm__btn--back:hover{border-color:#6b46c1;transform:translateY(-2px);}
        .iqm__btn--paid{flex:1;background:linear-gradient(135deg,#10b981,#059669);color:#fff;box-shadow:0 4px 14px rgba(16,185,129,.35);}
        .iqm__btn--paid:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(16,185,129,.45);}
        .iqm__btn--paid:disabled{opacity:.6;cursor:not-allowed;transform:none;}
        @media(max-width:400px){.iqm__footer{flex-direction:column-reverse;}.iqm__btn--back{width:100%;}}
      `;
      document.head.appendChild(style);
    }

    const closeModal = () => {
      modal.classList.remove("iqm--open");
      setTimeout(() => modal.remove(), 300);
    };

    document.getElementById("iqmClose").onclick = closeModal;
    document.getElementById("iqmBack").onclick = closeModal;
    modal.querySelector(".iqm__backdrop").onclick = closeModal;
    document.getElementById("iqmPaid").onclick = () =>
      this.placeIronOrderAfterPayment(data);
  }

  // ─────────────────────────────────────────
  // PLACE IRON ORDER AFTER QR PAYMENT
  // ─────────────────────────────────────────
  async placeIronOrderAfterPayment(data) {
    const jwtToken = window.safeStorage?.getItem("jwtToken");
    if (!jwtToken) return;

    const btn = document.getElementById("iqmPaid");
    const errEl = document.getElementById("iqmError");

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming...';
    }
    if (errEl) errEl.style.display = "none";

    const orderData = {
      serviceId: 1,
      serviceName: "Iron Per Cloth",
      serviceType: data.serviceType,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      unit: "piece",
      pickupDate: data.date,
      pickupTime: data.time,
      pickupAddress: data.address,
      specialInstructions: data.specialInstructions,
      paymentMethod: "online",
      paymentStatus: "pending_verification",
    };

    try {
      const response = await fetch(
        window.location.origin + "/api/orders/place",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwtToken}`,
          },
          body: JSON.stringify(orderData),
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        window.safeStorage.removeItem("jwtToken");
        window.safeStorage.removeItem("isLoggedIn");
        const modal = document.getElementById("ironQRPaymentModal");
        if (modal) {
          modal.classList.remove("iqm--open");
          setTimeout(() => modal.remove(), 300);
        }
        this.showNotification("Session expired. Please login again.", "error");
        setTimeout(() => {
          if (typeof openAuthModal === "function") openAuthModal("login");
        }, 800);
        return;
      }

      if (result.success) {
        const modal = document.getElementById("ironQRPaymentModal");
        if (modal) {
          modal.classList.remove("iqm--open");
          setTimeout(() => modal.remove(), 300);
        }

        this.showOrderConfirmation({
          orderNumber: result.data?.orderNumber,
          pickup_date: data.date,
          pickup_time: data.time,
          quantity: data.quantity,
          totalAmount: result.data?.totalAmount,
          pickup_address: data.address,
          paymentMethod: "online",
        });

        this.form.reset();
        this.updateSummary();
        setTimeout(() => this.loadUserProfile(), 400);
      } else {
        if (errEl) {
          errEl.textContent = result.message || "Failed to place order.";
          errEl.style.display = "block";
        }
        if (btn) {
          btn.disabled = false;
          btn.innerHTML =
            '<i class="fas fa-check-circle"></i> I\'ve Paid ₹' +
            (data.totalAmount?.toFixed(2) || "0");
        }
      }
    } catch (err) {
      console.error("❌ Iron QR payment error:", err);
      if (errEl) {
        errEl.textContent = "Network error. Please try again.";
        errEl.style.display = "block";
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
          '<i class="fas fa-check-circle"></i> I\'ve Paid ₹' +
          (data.totalAmount?.toFixed(2) || "0");
      }
    }
  }

  showOrderConfirmation(orderData) {
    const confirmationHTML = `
      <div class="order-confirmation-modal" id="orderConfirmationModal">
        <div class="confirmation-content">
          <div class="confirmation-icon">
            <i class="fas fa-check-circle"></i>
          </div>
          <h2>Order Placed Successfully! 🎉</h2>
          <p>Your iron service order has been confirmed.</p>
          <div class="confirmation-details">
            ${
              orderData.orderNumber
                ? `
            <div class="detail-item">
              <i class="fas fa-hashtag"></i>
              <span>Order #: ${orderData.orderNumber}</span>
            </div>`
                : ""
            }
            <div class="detail-item">
              <i class="fas fa-calendar"></i>
              <span>Pickup Date: ${orderData.pickup_date || "TBD"}</span>
            </div>
            <div class="detail-item">
              <i class="fas fa-clock"></i>
              <span>Pickup Time: ${orderData.pickup_time || "TBD"}</span>
            </div>
            <div class="detail-item">
              <i class="fas fa-tshirt"></i>
              <span>Quantity: ${orderData.quantity || 0} pieces</span>
            </div>
            ${
              orderData.totalAmount
                ? `
            <div class="detail-item">
              <i class="fas fa-rupee-sign"></i>
              <span>Total: ₹${orderData.totalAmount}</span>
            </div>`
                : ""
            }
            <div class="detail-item">
              <i class="fas fa-map-marker-alt"></i>
              <span>${orderData.pickup_address || ""}</span>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:0;">
            <button class="btn-close-confirmation" onclick="closeOrderConfirmation()"
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
      </div>
    `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = confirmationHTML;
    document.body.appendChild(tempDiv.firstElementChild);

    // Add styles
    if (!document.getElementById("order-confirmation-styles")) {
      const style = document.createElement("style");
      style.id = "order-confirmation-styles";
      style.textContent = `
        .order-confirmation-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.3s ease;
        }

        .confirmation-content {
          background: var(--primary-bg);
          border: 1.5px solid var(--accent-color);
          border-radius: 18px;
          padding: 1.5rem 1.5rem 1.25rem;
          max-width: 360px;
          width: 92%;
          text-align: center;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
          animation: slideInUp 0.4s ease;
        }

        .confirmation-icon {
          width: 58px;
          height: 58px;
          margin: 0 auto 0.9rem;
          background: linear-gradient(135deg, #10b981, #059669);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.9rem;
          color: white;
          box-shadow: 0 6px 18px rgba(16, 185, 129, 0.35);
          animation: scaleIn 0.5s ease 0.2s backwards;
        }

        .confirmation-content h2 {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 0.3rem;
        }

        .confirmation-content p {
          color: var(--text-secondary);
          font-size: 0.82rem;
          margin-bottom: 0.9rem;
        }

        .confirmation-details {
          background: var(--secondary-bg);
          border-radius: 10px;
          padding: 0.7rem 0.9rem;
          margin-bottom: 1rem;
          text-align: left;
        }

        .detail-item {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          padding: 0.35rem 0;
          color: var(--text-primary);
          font-weight: 600;
          font-size: 0.82rem;
          border-bottom: 1px solid var(--border-color, #f0f0f0);
        }

        .detail-item:last-child {
          border-bottom: none;
        }

        .detail-item i {
          color: var(--accent-color);
          font-size: 0.9rem;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .btn-close-confirmation {
          padding: 0.65rem 1rem;
          background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(107, 70, 193, 0.3);
        }

        .btn-close-confirmation:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(107, 70, 193, 0.4);
        }

        @keyframes scaleIn {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  showNotification(message, type = "info") {
    // Use existing notification system if available
    if (typeof showNotification === "function") {
      showNotification(message, type);
      return;
    }

    // Fallback notification
    const notification = document.createElement("div");
    notification.className = `iron-notification iron-notification-${type}`;
    notification.innerHTML = `
      <i class="fas fa-${
        type === "success"
          ? "check-circle"
          : type === "error"
          ? "exclamation-circle"
          : "info-circle"
      }"></i>
      <span>${message}</span>
    `;

    notification.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      background: ${
        type === "success"
          ? "#10b981"
          : type === "error"
          ? "#ef4444"
          : "#3b82f6"
      };
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// ============================================
// SERVICE SELECTION FUNCTION
// ============================================

function selectService(serviceType, price) {
  console.log(`📋 Service selected: ${serviceType} - ₹${price}`);

  const serviceTypeSelect = document.getElementById("serviceType");
  const orderFormSection = document.getElementById("orderFormSection");

  if (serviceTypeSelect) {
    serviceTypeSelect.value = serviceType;

    // Trigger change event to update summary
    const event = new Event("change", { bubbles: true });
    serviceTypeSelect.dispatchEvent(event);
  }

  if (orderFormSection) {
    // Scroll to order form
    orderFormSection.scrollIntoView({ behavior: "smooth", block: "start" });

    // Highlight the form briefly
    const formWrapper = document.querySelector(".order-form-wrapper");
    if (formWrapper) {
      formWrapper.style.boxShadow = "0 0 40px rgba(107, 70, 193, 0.5)";
      setTimeout(() => {
        formWrapper.style.boxShadow = "";
      }, 2000);
    }
  }
}

// Make selectService available globally
window.selectService = selectService;

// ============================================
// CLOSE ORDER CONFIRMATION
// ============================================

function closeOrderConfirmation() {
  const modal = document.getElementById("orderConfirmationModal");
  if (modal) {
    modal.style.animation = "fadeOut 0.3s ease";
    setTimeout(() => modal.remove(), 300);
  }
}

window.closeOrderConfirmation = closeOrderConfirmation;

// ============================================
// FAQ ACCORDION
// ============================================

function initFAQ() {
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach((item) => {
    const question = item.querySelector(".faq-question");

    question.addEventListener("click", () => {
      // Close other items
      faqItems.forEach((otherItem) => {
        if (otherItem !== item) {
          otherItem.classList.remove("active");
        }
      });

      // Toggle current item
      item.classList.toggle("active");
    });
  });

  console.log("✅ FAQ accordion initialized");
}

// ============================================
// INITIALIZE ON DOM READY
// ============================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initIronPage);
} else {
  initIronPage();
}

function initIronPage() {
  console.log("🎯 Initializing Iron Service Page...");

  // Initialize components
  const slider = new HeroSlider();
  const orderForm = new IronOrderForm();
  initFAQ();

  // Smooth scroll for all internal links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");

      if (href && href !== "#" && href !== "#login") {
        e.preventDefault();

        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }
    });
  });

  console.log("🎉 Iron Service Page fully initialized!");
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Add animation styles if not present
if (!document.getElementById("iron-animation-styles")) {
  const style = document.createElement("style");
  style.id = "iron-animation-styles";
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }

    @keyframes slideInUp {
      from { transform: translateY(50px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

console.log(
  "✨ Iron Service JavaScript Loaded Successfully with FIXED authentication!"
);
