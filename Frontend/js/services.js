// ============================================
// SERVICES.JS - ENHANCED WITH NEW FEATURES
// ✅ Auto-fetch user address
// ✅ Add to Cart + Place Order buttons
// ✅ Payment mode: Online (QR) / Cash on Delivery
// ✅ Order summary with edit
// ✅ QR code payment flow
// ✅ Success message + Email notification
// ============================================

console.log("🎯 Services Page JavaScript Loaded!");

const API_CONFIG = {
  BASE_URL: window.location.origin,
  ENDPOINTS: {
    GET_SERVICES: "/api/services",
    GET_SERVICE_DETAIL: "/api/services",
    GET_FEATURED: "/api/services/featured",
    GET_CATEGORIES: "/api/categories",
    ADD_TO_CART: "/api/cart/add",
    PLACE_ORDER: "/api/orders/place",
    GET_PROFILE: "/api/profile",
  },
};

const state = {
  services: [],
  categories: [],
  selectedCategory: "all",
  selectedService: null,
  isLoggedIn: false,
  userProfile: null,
  pendingOrderData: null,
  qrPaymentInterval: null,
};

// ============================================
// CUSTOM CONFIRMATION MODAL
// ============================================

function showConfirmModal(message, onConfirm, onCancel) {
  const existingModal = document.querySelector(".confirm-modal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.className = "confirm-modal";
  modal.innerHTML = `
    <div class="confirm-modal-content">
      <div class="confirm-modal-icon">
        <i class="fas fa-shopping-cart"></i>
      </div>
      <h3 class="confirm-modal-title">Success!</h3>
      <p class="confirm-modal-message">${message}</p>
      <div class="confirm-modal-buttons">
        <button class="confirm-modal-btn confirm-modal-btn-yes" id="confirmYes">
          <i class="fas fa-shopping-cart"></i>
          <span>View Cart</span>
        </button>
        <button class="confirm-modal-btn confirm-modal-btn-no" id="confirmNo">
          <i class="fas fa-times"></i>
          <span>Continue Shopping</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("confirmYes").addEventListener("click", () => {
    modal.classList.remove("active");
    setTimeout(() => modal.remove(), 300);
    document.body.style.overflow = "";
    if (onConfirm) onConfirm();
  });

  document.getElementById("confirmNo").addEventListener("click", () => {
    modal.classList.remove("active");
    setTimeout(() => modal.remove(), 300);
    document.body.style.overflow = "";
    if (onCancel) onCancel();
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
      setTimeout(() => modal.remove(), 300);
      document.body.style.overflow = "";
      if (onCancel) onCancel();
    }
  });

  setTimeout(() => modal.classList.add("active"), 10);
  document.body.style.overflow = "hidden";

  const handleEscape = (e) => {
    if (e.key === "Escape") {
      modal.classList.remove("active");
      setTimeout(() => modal.remove(), 300);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
      if (onCancel) onCancel();
    }
  };
  document.addEventListener("keydown", handleEscape);
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Initializing Services Page...");
  waitForComponents().then(() => {
    validateAndSetAuthStatus();
    loadCategories();
    loadServices();
    setupEventListeners();
    updateActiveNavigation();
  });
});

function waitForComponents() {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (
        document.getElementById("header-container")?.innerHTML &&
        document.getElementById("sidebar-container")?.innerHTML
      ) {
        clearInterval(check);
        resolve();
      }
    }, 100);
    setTimeout(() => {
      clearInterval(check);
      resolve();
    }, 5000);
  });
}

// ============================================
// AUTH VALIDATION
// ============================================

async function validateAndSetAuthStatus() {
  const token = localStorage.getItem("jwtToken");
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  if (!isLoggedIn || !token) {
    state.isLoggedIn = false;
    return;
  }

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/cart`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) {
      clearSession();
      state.isLoggedIn = false;
      window.dispatchEvent(new Event("authStateChanged"));
      return;
    }

    state.isLoggedIn = response.ok;
    if (state.isLoggedIn) loadUserProfile();
  } catch (error) {
    state.isLoggedIn = true;
    loadUserProfile();
  }
}

// ============================================
// FETCH USER PROFILE / ADDRESS
// ============================================

async function loadUserProfile() {
  const token = localStorage.getItem("jwtToken");
  if (!token) return;

  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_PROFILE}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        state.userProfile = data.data.user || data.data.profile || data.data;
        console.log("✅ User profile loaded:", state.userProfile);
      }
    }
  } catch (err) {
    console.warn("⚠️ Could not load user profile:", err);
  }
}

function getUserAddress() {
  if (!state.userProfile) return "";
  const p = state.userProfile;
  // Try different possible field names from your users table
  return (
    p.address ||
    p.full_address ||
    p.pickup_address ||
    [p.street, p.city, p.state, p.pincode].filter(Boolean).join(", ") ||
    ""
  );
}

function clearSession() {
  localStorage.removeItem("jwtToken");
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("userName");
  localStorage.removeItem("userEmail");
  state.isLoggedIn = false;
}

// ============================================
// LOAD CATEGORIES
// ============================================

async function loadCategories() {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_CATEGORIES}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    const data = await response.json();
    if (data.success && data.data?.categories) {
      state.categories = data.data.categories;
      renderCategoryFilters();
    }
  } catch (error) {
    console.error("❌ Categories Error:", error);
  }
}

function renderCategoryFilters() {
  const container = document.getElementById("categoryFilters");
  if (!container) return;

  let html = `<button class="category-filter-btn active" data-category="all">
      <i class="fas fa-th-large"></i><span>All Services</span></button>`;

  state.categories.forEach((cat) => {
    html += `<button class="category-filter-btn" data-category="${cat.id}">
        <i class="${cat.icon || "fas fa-tag"}"></i>
        <span>${cat.name}</span>
    </button>`;
  });

  container.innerHTML = html;

  container.querySelectorAll(".category-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      container
        .querySelectorAll(".category-filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterServices(btn.dataset.category);
    });
  });
}

async function filterServices(categoryId) {
  state.selectedCategory = categoryId;
  if (categoryId === "all") {
    renderServices(state.services);
  } else {
    const filtered = state.services.filter((s) => s.category_id == categoryId);
    renderServices(filtered);
  }
}

// ============================================
// LOAD SERVICES
// ============================================

async function loadServices(categoryId = null) {
  const loading = document.getElementById("loadingContainer");
  const error = document.getElementById("errorContainer");
  const grid = document.getElementById("servicesGrid");

  if (loading) loading.style.display = "block";
  if (error) error.style.display = "none";
  if (grid) grid.innerHTML = "";

  try {
    let url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_SERVICES}`;
    if (categoryId && categoryId !== "all") url += `?category=${categoryId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();

    if (data.success && data.data?.services) {
      state.services = data.data.services;
      renderServices(state.services);
    } else {
      throw new Error(data.message || "Failed to load services");
    }
  } catch (err) {
    console.error("❌ Error loading services:", err);
    if (error) {
      error.style.display = "block";
      const errorMsg = document.getElementById("errorMessage");
      if (errorMsg)
        errorMsg.textContent =
          err.message || "Could not connect to the server.";
    }
  } finally {
    if (loading) loading.style.display = "none";
  }
}

window.loadServices = loadServices;

// ============================================
// RENDER SERVICES
// ============================================

function renderServices(services) {
  const grid = document.getElementById("servicesGrid");
  const empty = document.getElementById("emptyState");

  if (!grid) return;

  if (!services || services.length === 0) {
    grid.style.display = "none";
    if (empty) empty.style.display = "block";
    return;
  }

  grid.style.display = "grid";
  if (empty) empty.style.display = "none";
  grid.innerHTML = services
    .map((service) => createServiceCard(service))
    .join("");
  attachServiceCardListeners();
}

function attachServiceCardListeners() {
  const grid = document.getElementById("servicesGrid");
  if (!grid) return;

  grid.querySelectorAll(".service-card").forEach((card) => {
    card.addEventListener("click", function (e) {
      if (e.target.closest(".service-btn")) return;
      const serviceId = parseInt(this.dataset.serviceId);
      if (serviceId) window.openServiceDetails(serviceId);
    });
  });
}

function createServiceCard(s) {
  let imageSrc = null;
  if (s.image_path) {
    let path = s.image_path;
    if (path.includes("Frontend/Frontend/"))
      path = path.replace("Frontend/Frontend/", "");
    imageSrc = path.startsWith("http")
      ? path
      : path.includes("images/")
      ? path
      : `images/${path}`;
  }

  let features = [];
  if (s.features) {
    if (typeof s.features === "string") {
      try {
        features = JSON.parse(s.features);
      } catch (e) {
        features = s.features.split("|||").filter((f) => f.trim());
      }
    } else if (Array.isArray(s.features)) {
      features = s.features;
    }
  }

  return `
    <div class="service-card ${s.is_featured ? "featured" : ""}" 
         data-service-id="${s.id}" style="cursor: pointer;">

        ${
          s.is_featured
            ? '<div class="featured-badge"><i class="fas fa-star"></i> Most Popular</div>'
            : ""
        }

        ${
          imageSrc
            ? `<div class="service-image">
               <img src="${imageSrc}" alt="${s.name}"
                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'service-icon\\'><i class=\\'${
                   s.icon || "fas fa-tshirt"
                 }\\'></i></div>';">
             </div>`
            : `<div class="service-icon"><i class="${
                s.icon || "fas fa-tshirt"
              }"></i></div>`
        }

        <div class="service-content">

            <!-- Info block (title, desc, features) -->
            <div class="service-info-block">
                <h3 class="service-title">${s.name}</h3>
                <p class="service-description">${
                  s.description || "Quality laundry service"
                }</p>
                ${
                  features.length > 0
                    ? `
                <ul class="service-features">
                    ${features
                      .slice(0, 3)
                      .map(
                        (f) =>
                          `<li><i class="fas fa-check-circle"></i><span>${f}</span></li>`
                      )
                      .join("")}
                </ul>`
                    : ""
                }
            </div>

            <!-- Action block (price + button) -->
            <div class="service-action-block">
                <div class="service-price">₹${s.price}<small>/${
    s.unit || "piece"
  }</small></div>
                <button class="service-btn" onclick="event.stopPropagation(); window.openServiceDetails(${
                  s.id
                })">
                    <span>Select Service</span>
                    <i class="fas fa-arrow-right"></i>
                </button>
            </div>

        </div>
    </div>
  `;
}

// ============================================
// SERVICE DETAILS MODAL
// ============================================

async function openServiceDetails(id) {
  await validateAndSetAuthStatus();

  let service = state.services.find((s) => s.id === id);
  if (!service) {
    showNotification("Service not found", "error");
    return;
  }

  state.selectedService = service;
  const modal = document.getElementById("serviceModal");
  const content = document.getElementById("modalContent");
  if (!modal || !content) return;

  let features = [];
  if (service.features) {
    if (typeof service.features === "string") {
      try {
        features = JSON.parse(service.features);
      } catch (e) {
        features = service.features.split("|||").filter((f) => f.trim());
      }
    } else if (Array.isArray(service.features)) {
      features = service.features;
    }
  }

  let imageSrc = null;
  if (service.image_path) {
    let path = service.image_path;
    if (path.includes("Frontend/Frontend/"))
      path = path.replace("Frontend/Frontend/", "");
    imageSrc = path.startsWith("http")
      ? path
      : path.includes("images/")
      ? path
      : `images/${path}`;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  // Auto-fill address from profile
  const savedAddress = getUserAddress();

  content.innerHTML = `
    <button class="modal-close-btn" onclick="window.closeServiceModal()">
        <i class="fas fa-times"></i>
    </button>
    
    <div style="text-align:center;margin-bottom:2rem">
    ${
      imageSrc
        ? `<div class="service-image">
            <img src="${imageSrc}" alt="${service.name}"
                 onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'service-icon\\' style=\\'margin:0 auto 1.5rem\\'><i class=\\'${
                   service.icon || "fas fa-tshirt"
                 }\\'></i></div>';">
        </div>`
        : `<div class="service-icon" style="margin:0 auto 1.5rem">
            <i class="${service.icon || "fas fa-tshirt"}"></i>
        </div>`
    }
        
        <h2 style="font-size:2rem;color:var(--text-primary);margin-bottom:0.5rem">${
          service.name
        }</h2>
        <p style="color:var(--text-secondary);font-size:1.1rem">${
          service.description
        }</p>
    </div>
    
    <div style="text-align:center;padding:1.5rem;background:var(--secondary-bg);border-radius:12px;margin-bottom:2rem">
        <h3 style="color:var(--text-secondary);font-size:1rem;margin-bottom:0.5rem">Price</h3>
        <div style="font-size:2.5rem;font-weight:700;color:var(--accent-color)">
            ₹${service.price}
            <span style="font-size:1.2rem;color:var(--text-secondary)">/${
              service.unit || "piece"
            }</span>
        </div>
    </div>
    
    ${
      features.length > 0
        ? `
        <div style="margin-bottom:2rem">
            <h3 style="color:var(--text-primary);margin-bottom:1rem;font-size:1.3rem">
                <i class="fas fa-star" style="color:var(--accent-color)"></i> What's Included
            </h3>
            <ul class="service-features" style="display:grid;gap:0.75rem">
                ${features
                  .map(
                    (f) => `
                    <li style="padding:0.75rem;background:var(--secondary-bg);border-radius:8px;display:flex;align-items:center;gap:0.75rem">
                        <i class="fas fa-check-circle" style="color:#10b981;font-size:1.2rem"></i>
                        <span style="color:var(--text-primary)">${f}</span>
                    </li>
                `
                  )
                  .join("")}
            </ul>
        </div>
    `
        : ""
    }
    
    <form id="addToCartForm" style="display:flex;flex-direction:column;gap:1.5rem">
        <!-- Quantity -->
        <div>
            <label style="display:block;color:var(--text-primary);font-weight:600;margin-bottom:0.5rem">
                <i class="fas fa-shopping-cart"></i> Select Quantity
            </label>
            <div style="display:flex;align-items:center;gap:1rem;justify-content:center;background:var(--secondary-bg);padding:1.5rem;border-radius:12px">
                <button type="button" onclick="window.decreaseQuantity()" 
                    style="width:50px;height:50px;border-radius:50%;border:2px solid var(--accent-color);background:transparent;color:var(--accent-color);cursor:pointer;font-size:1.2rem">
                    <i class="fas fa-minus"></i>
                </button>
                <input type="number" id="serviceQuantity" value="1" min="1" max="100" 
                    onchange="window.updateQuantityDisplay()"
                    style="width:80px;padding:0.75rem;font-size:1.5rem;font-weight:700;text-align:center;border:2px solid var(--border-color);border-radius:12px;background:var(--primary-bg);color:var(--text-primary)">
                <button type="button" onclick="window.increaseQuantity()" 
                    style="width:50px;height:50px;border-radius:50%;border:2px solid var(--accent-color);background:transparent;color:var(--accent-color);cursor:pointer;font-size:1.2rem">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div style="text-align:center;margin-top:1rem;font-size:1.2rem;color:var(--text-primary)">
                Total: <span id="totalPrice" style="font-weight:700;color:var(--accent-color)">₹${
                  service.price
                }</span>
            </div>
        </div>
        
        <!-- Date & Time -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
            <div>
                <label style="display:block;color:var(--text-primary);font-weight:600;margin-bottom:0.5rem">
                    <i class="fas fa-calendar"></i> Pickup Date *
                </label>
                <input type="date" id="pickupDate" required min="${minDate}"
                    style="width:100%;padding:0.75rem;border:2px solid var(--border-color);border-radius:12px;background:var(--primary-bg);color:var(--text-primary)">
            </div>
            <div>
                <label style="display:block;color:var(--text-primary);font-weight:600;margin-bottom:0.5rem">
                    <i class="fas fa-clock"></i> Pickup Time *
                </label>
                <select id="pickupTime" required 
                    style="width:100%;padding:0.75rem;border:2px solid var(--border-color);border-radius:12px;background:var(--primary-bg);color:var(--text-primary)">
                    <option value="">Select Time</option>
                    <option value="09:00-11:00">9:00 AM - 11:00 AM</option>
                    <option value="11:00-13:00">11:00 AM - 1:00 PM</option>
                    <option value="13:00-15:00">1:00 PM - 3:00 PM</option>
                    <option value="15:00-17:00">3:00 PM - 5:00 PM</option>
                    <option value="17:00-19:00">5:00 PM - 7:00 PM</option>
                </select>
            </div>
        </div>
        
        <!-- Address (auto-filled) -->
        <div>
            <label style="display:block;color:var(--text-primary);font-weight:600;margin-bottom:0.5rem">
                <i class="fas fa-map-marker-alt"></i> Pickup Address *
                ${
                  savedAddress
                    ? '<span style="font-size:0.8rem;color:#10b981;font-weight:400;margin-left:6px"><i class="fas fa-check-circle"></i> Auto-filled from your profile</span>'
                    : ""
                }
            </label>
            <textarea id="pickupAddress" required placeholder="Enter your full address with landmark"
                style="width:100%;padding:0.75rem;border:2px solid var(--border-color);border-radius:12px;background:var(--primary-bg);color:var(--text-primary);min-height:80px;font-family:inherit">${savedAddress}</textarea>
        </div>
        
        <!-- Special Instructions -->
        <div>
            <label style="display:block;color:var(--text-primary);font-weight:600;margin-bottom:0.5rem">
                <i class="fas fa-comment"></i> Special Instructions (Optional)
            </label>
            <textarea id="specialInstructions" placeholder="Any special care instructions..."
                style="width:100%;padding:0.75rem;border:2px solid var(--border-color);border-radius:12px;background:var(--primary-bg);color:var(--text-primary);min-height:60px;font-family:inherit"></textarea>
        </div>
        
        <!-- Payment Mode -->
        <div>
            <label style="display:block;color:var(--text-primary);font-weight:600;margin-bottom:0.75rem">
                <i class="fas fa-credit-card"></i> Payment Mode *
            </label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
                <label id="payOnlineLbl" onclick="window.selectPayment('online')" style="display:flex;align-items:center;gap:0.75rem;padding:1rem;border:2px solid var(--accent-color);border-radius:12px;cursor:pointer;background:rgba(124,58,237,0.07);transition:all 0.2s">
                    <input type="radio" name="paymentMode" value="online" id="payOnline" checked style="accent-color:var(--accent-color)">
                    <div>
                        <div style="font-weight:700;color:var(--text-primary)"><i class="fas fa-qrcode" style="color:var(--accent-color)"></i> Online / UPI</div>
                        <div style="font-size:0.8rem;color:var(--text-secondary)">Pay via QR code</div>
                    </div>
                </label>
                <label id="payCODLbl" onclick="window.selectPayment('cod')" style="display:flex;align-items:center;gap:0.75rem;padding:1rem;border:2px solid var(--border-color);border-radius:12px;cursor:pointer;background:var(--secondary-bg);transition:all 0.2s">
                    <input type="radio" name="paymentMode" value="cod" id="payCOD" style="accent-color:var(--accent-color)">
                    <div>
                        <div style="font-weight:700;color:var(--text-primary)"><i class="fas fa-money-bill-wave" style="color:#10b981"></i> Cash on Delivery</div>
                        <div style="font-size:0.8rem;color:var(--text-secondary)">Pay when we arrive</div>
                    </div>
                </label>
            </div>
        </div>
        
        <!-- Action Buttons -->
        <div style="display:flex;gap:1rem;flex-wrap:wrap">
            <button type="button" id="addToCartBtn" onclick="window.handleAddToCartClick(event)"
                style="flex:1;min-width:140px;padding:0.9rem 1.5rem;background:var(--secondary-bg);color:var(--accent-color);border:2px solid var(--accent-color);border-radius:12px;font-weight:700;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all 0.2s">
                <i class="fas fa-cart-plus"></i>
                <span>Add to Cart</span>
            </button>
            
            <button type="button" id="placeOrderBtn" onclick="window.handlePlaceOrderClick(event)"
                style="flex:1;min-width:140px;padding:0.9rem 1.5rem;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all 0.2s;box-shadow:0 4px 15px rgba(124,58,237,0.35)">
                <i class="fas fa-bolt"></i>
                <span>Place Order</span>
            </button>
            
            <button type="button" onclick="window.closeServiceModal()" 
                style="padding:0.9rem 1.2rem;background:var(--secondary-bg);color:var(--text-primary);border:2px solid var(--border-color);border-radius:12px;font-weight:600;cursor:pointer">
                <i class="fas fa-times"></i>
            </button>
        </div>
    </form>
  `;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

window.openServiceDetails = openServiceDetails;

// ============================================
// PAYMENT MODE SELECTION
// ============================================

window.selectPayment = (mode) => {
  const onlineLbl = document.getElementById("payOnlineLbl");
  const codLbl = document.getElementById("payCODLbl");
  const onlineRadio = document.getElementById("payOnline");
  const codRadio = document.getElementById("payCOD");

  if (mode === "online") {
    onlineRadio.checked = true;
    if (onlineLbl) {
      onlineLbl.style.border = "2px solid var(--accent-color)";
      onlineLbl.style.background = "rgba(124,58,237,0.07)";
    }
    if (codLbl) {
      codLbl.style.border = "2px solid var(--border-color)";
      codLbl.style.background = "var(--secondary-bg)";
    }
  } else {
    codRadio.checked = true;
    if (codLbl) {
      codLbl.style.border = "2px solid #10b981";
      codLbl.style.background = "rgba(16,185,129,0.07)";
    }
    if (onlineLbl) {
      onlineLbl.style.border = "2px solid var(--border-color)";
      onlineLbl.style.background = "var(--secondary-bg)";
    }
  }
};

function closeServiceModal() {
  const modal = document.getElementById("serviceModal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
    state.selectedService = null;
  }
}

window.closeServiceModal = closeServiceModal;

// ============================================
// QUANTITY CONTROLS
// ============================================

window.increaseQuantity = () => {
  const input = document.getElementById("serviceQuantity");
  if (input) {
    input.value = parseInt(input.value) + 1;
    updateQuantityDisplay();
  }
};

window.decreaseQuantity = () => {
  const input = document.getElementById("serviceQuantity");
  if (input && parseInt(input.value) > 1) {
    input.value = parseInt(input.value) - 1;
    updateQuantityDisplay();
  }
};

window.updateQuantityDisplay = () => {
  const input = document.getElementById("serviceQuantity");
  const total = document.getElementById("totalPrice");
  if (input && total && state.selectedService) {
    const quantity = parseInt(input.value) || 1;
    total.textContent = `₹${state.selectedService.price * quantity}`;
  }
};

// ============================================
// COLLECT FORM DATA
// ============================================

function collectFormData() {
  const service = state.selectedService;
  if (!service) return null;

  const quantity =
    parseInt(document.getElementById("serviceQuantity").value) || 1;
  const pickupDate = document.getElementById("pickupDate").value;
  const pickupTime = document.getElementById("pickupTime").value;
  const pickupAddress = document.getElementById("pickupAddress").value.trim();
  const specialInstructions = document
    .getElementById("specialInstructions")
    .value.trim();
  const paymentMode =
    document.querySelector('input[name="paymentMode"]:checked')?.value ||
    "online";

  // Validate
  if (!pickupDate) {
    showNotification("Please select a pickup date", "error");
    return null;
  }
  if (!pickupTime) {
    showNotification("Please select a pickup time", "error");
    return null;
  }
  if (!pickupAddress) {
    showNotification("Please enter your pickup address", "error");
    return null;
  }

  return {
    serviceId: service.id,
    serviceName: service.name,
    quantity,
    unitPrice: service.price,
    totalPrice: service.price * quantity,
    unit: service.unit || "piece",
    pickupDate,
    pickupTime,
    pickupAddress,
    specialInstructions,
    paymentMode,
  };
}

// ============================================
// ADD TO CART HANDLER
// ============================================

window.handleAddToCartClick = async (e) => {
  e.preventDefault();
  await validateAndSetAuthStatus();

  if (!state.isLoggedIn) {
    closeServiceModal();
    showNotification("Please login to add items to cart", "info");
    setTimeout(() => {
      if (typeof openAuthModal === "function") openAuthModal("login");
    }, 500);
    return;
  }

  const formData = collectFormData();
  if (!formData) return;

  const token = localStorage.getItem("jwtToken");

  try {
    showNotification("Adding to cart...", "info");

    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADD_TO_CART}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      }
    );

    const result = await response.json();

    if (response.status === 401) {
      clearSession();
      closeServiceModal();
      window.dispatchEvent(new Event("authStateChanged"));
      showNotification("Session expired. Please login again", "error");
      setTimeout(() => {
        if (typeof openAuthModal === "function") openAuthModal("login");
      }, 1500);
      return;
    }

    if (result.success) {
      showNotification(`✅ ${formData.serviceName} added to cart!`, "success");
      closeServiceModal();
      setTimeout(() => {
        showConfirmModal(
          "Item added to cart! View your cart now?",
          () => {
            window.location.href = "cart.html";
          },
          () => {}
        );
      }, 500);
    } else {
      throw new Error(result.message || "Failed to add to cart");
    }
  } catch (err) {
    console.error("❌ Add to Cart Error:", err);
    showNotification(err.message || "Failed to add to cart", "error");
  }
};

// ============================================
// PLACE ORDER HANDLER
// ============================================

window.handlePlaceOrderClick = async (e) => {
  e.preventDefault();
  await validateAndSetAuthStatus();

  if (!state.isLoggedIn) {
    closeServiceModal();
    showNotification("Please login to place an order", "info");
    setTimeout(() => {
      if (typeof openAuthModal === "function") openAuthModal("login");
    }, 500);
    return;
  }

  const formData = collectFormData();
  if (!formData) return;

  state.pendingOrderData = formData;
  closeServiceModal();
  showOrderSummaryModal(formData);
};

// ============================================
// ORDER SUMMARY MODAL (with edit)
// ============================================

function showOrderSummaryModal(orderData) {
  const existing = document.getElementById("orderSummaryModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "orderSummaryModal";
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);
    display:flex;align-items:center;justify-content:center;padding:1rem;
    backdrop-filter:blur(4px);
  `;

  modal.innerHTML = `
    <div style="background:var(--primary-bg,#fff);border-radius:16px;max-width:420px;width:100%;
                max-height:85vh;overflow-y:auto;padding:1.5rem;position:relative;
                box-shadow:0 20px 50px rgba(0,0,0,0.3);">
      
      <button onclick="document.getElementById('orderSummaryModal').remove();document.body.style.overflow=''"
        style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;font-size:1.3rem;
               cursor:pointer;color:var(--text-secondary);padding:0.4rem;border-radius:8px">
        <i class="fas fa-times"></i>
      </button>
      
      <div style="text-align:center;margin-bottom:1rem">
        <div style="width:44px;height:44px;background:linear-gradient(135deg,#7c3aed,#a855f7);
                    border-radius:50%;display:flex;align-items:center;justify-content:center;
                    margin:0 auto 0.75rem;font-size:1.1rem;color:#fff">
          <i class="fas fa-receipt"></i>
        </div>
        <h2 style="color:var(--text-primary);font-size:1.4rem;margin-bottom:0.2rem">Order Summary</h2>
        <p style="color:var(--text-secondary);font-size:0.85rem">Review and confirm your order</p>
      </div>
      
      <!-- Editable summary -->
      <div id="summaryContent" style="background:var(--secondary-bg,#f8f9fa);border-radius:10px;padding:1rem;margin-bottom:1rem">
        ${buildSummaryRows(orderData)}
      </div>
      
      <div id="summaryEditArea" style="display:none;margin-bottom:1rem">
        <!-- Edit form injected here -->
      </div>
      
      <div style="display:flex;gap:0.6rem;flex-wrap:wrap">
        <button onclick="window.toggleOrderEdit()" id="editSummaryBtn"
          style="flex:1;padding:0.7rem;background:var(--secondary-bg);color:var(--accent-color);
                 border:2px solid var(--accent-color);border-radius:10px;font-weight:700;cursor:pointer;font-size:0.9rem">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button onclick="window.confirmPlaceOrder()" id="confirmOrderBtn"
          style="flex:2;padding:0.7rem;background:linear-gradient(135deg,#7c3aed,#a855f7);
                 color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;
                 font-size:0.9rem;box-shadow:0 4px 12px rgba(124,58,237,0.35)">
          <i class="fas fa-bolt"></i> ${
            orderData.paymentMode === "online"
              ? "Pay Online"
              : "Place Order (COD)"
          }
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
      document.body.style.overflow = "";
    }
  });
}

function buildSummaryRows(d) {
  const payIcon =
    d.paymentMode === "online"
      ? '<i class="fas fa-qrcode" style="color:var(--accent-color)"></i> Online / UPI'
      : '<i class="fas fa-money-bill-wave" style="color:#10b981"></i> Cash on Delivery';

  return `
    <table style="width:100%;border-collapse:collapse">
      ${summaryRow("Service", d.serviceName)}
      ${summaryRow("Quantity", `${d.quantity} ${d.unit}`)}
      ${summaryRow("Pickup Date", d.pickupDate)}
      ${summaryRow("Pickup Time", d.pickupTime)}
      ${summaryRow("Address", d.pickupAddress)}
      ${
        d.specialInstructions
          ? summaryRow("Instructions", d.specialInstructions)
          : ""
      }
      ${summaryRow("Payment", payIcon)}
      <tr style="border-top:2px solid var(--border-color,#e5e7eb)">
        <td style="padding:0.75rem 0.5rem;font-weight:700;color:var(--text-primary);font-size:1.1rem">Total</td>
        <td style="padding:0.75rem 0.5rem;text-align:right;font-weight:800;color:var(--accent-color);font-size:1.4rem">₹${
          d.totalPrice
        }</td>
      </tr>
    </table>
  `;
}

function summaryRow(label, value) {
  return `
    <tr style="border-bottom:1px solid var(--border-color,#e5e7eb)">
      <td style="padding:0.6rem 0.5rem;color:var(--text-secondary);font-size:0.9rem;white-space:nowrap">${label}</td>
      <td style="padding:0.6rem 0.5rem;text-align:right;color:var(--text-primary);font-weight:600">${value}</td>
    </tr>
  `;
}

window.toggleOrderEdit = () => {
  const editArea = document.getElementById("summaryEditArea");
  const summaryContent = document.getElementById("summaryContent");
  const btn = document.getElementById("editSummaryBtn");
  const d = state.pendingOrderData;

  if (editArea.style.display === "none") {
    // Show edit form
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split("T")[0];

    editArea.innerHTML = `
      <div style="display:grid;gap:1rem">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
          <div>
            <label style="display:block;font-weight:600;color:var(--text-primary);margin-bottom:0.4rem;font-size:0.9rem">Pickup Date</label>
            <input type="date" id="editPickupDate" value="${
              d.pickupDate
            }" min="${minDate}"
              style="width:100%;padding:0.6rem;border:2px solid var(--border-color);border-radius:10px;background:var(--primary-bg);color:var(--text-primary)">
          </div>
          <div>
            <label style="display:block;font-weight:600;color:var(--text-primary);margin-bottom:0.4rem;font-size:0.9rem">Pickup Time</label>
            <select id="editPickupTime" style="width:100%;padding:0.6rem;border:2px solid var(--border-color);border-radius:10px;background:var(--primary-bg);color:var(--text-primary)">
              <option value="09:00-11:00" ${
                d.pickupTime === "09:00-11:00" ? "selected" : ""
              }>9:00 AM - 11:00 AM</option>
              <option value="11:00-13:00" ${
                d.pickupTime === "11:00-13:00" ? "selected" : ""
              }>11:00 AM - 1:00 PM</option>
              <option value="13:00-15:00" ${
                d.pickupTime === "13:00-15:00" ? "selected" : ""
              }>1:00 PM - 3:00 PM</option>
              <option value="15:00-17:00" ${
                d.pickupTime === "15:00-17:00" ? "selected" : ""
              }>3:00 PM - 5:00 PM</option>
              <option value="17:00-19:00" ${
                d.pickupTime === "17:00-19:00" ? "selected" : ""
              }>5:00 PM - 7:00 PM</option>
            </select>
          </div>
        </div>
        <div>
          <label style="display:block;font-weight:600;color:var(--text-primary);margin-bottom:0.4rem;font-size:0.9rem">Address</label>
          <textarea id="editAddress" style="width:100%;padding:0.6rem;border:2px solid var(--border-color);border-radius:10px;background:var(--primary-bg);color:var(--text-primary);min-height:70px;font-family:inherit">${
            d.pickupAddress
          }</textarea>
        </div>
        <div>
          <label style="display:block;font-weight:600;color:var(--text-primary);margin-bottom:0.4rem;font-size:0.9rem">Special Instructions</label>
          <textarea id="editInstructions" style="width:100%;padding:0.6rem;border:2px solid var(--border-color);border-radius:10px;background:var(--primary-bg);color:var(--text-primary);min-height:50px;font-family:inherit">${
            d.specialInstructions || ""
          }</textarea>
        </div>
        <button onclick="window.saveOrderEdit()" style="padding:0.75rem;background:var(--accent-color);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer">
          <i class="fas fa-save"></i> Save Changes
        </button>
      </div>
    `;
    editArea.style.display = "block";
    summaryContent.style.display = "none";
    btn.innerHTML = '<i class="fas fa-times"></i> Cancel Edit';
  } else {
    editArea.style.display = "none";
    summaryContent.style.display = "block";
    btn.innerHTML = '<i class="fas fa-edit"></i> Edit Order';
  }
};

window.saveOrderEdit = () => {
  const d = state.pendingOrderData;
  d.pickupDate =
    document.getElementById("editPickupDate").value || d.pickupDate;
  d.pickupTime =
    document.getElementById("editPickupTime").value || d.pickupTime;
  d.pickupAddress =
    document.getElementById("editAddress").value.trim() || d.pickupAddress;
  d.specialInstructions = document
    .getElementById("editInstructions")
    .value.trim();

  document.getElementById("summaryContent").innerHTML = buildSummaryRows(d);
  document.getElementById("summaryEditArea").style.display = "none";
  document.getElementById("summaryContent").style.display = "block";
  document.getElementById("editSummaryBtn").innerHTML =
    '<i class="fas fa-edit"></i> Edit Order';

  showNotification("Order details updated!", "success");
};

// ============================================
// CONFIRM PLACE ORDER
// ============================================

window.confirmPlaceOrder = async () => {
  const d = state.pendingOrderData;
  if (!d) return;

  if (d.paymentMode === "online") {
    // Show QR payment modal first
    document.getElementById("orderSummaryModal")?.remove();
    document.body.style.overflow = "";
    showQRPaymentModal(d);
  } else {
    // COD - directly place order
    await submitOrder(d, "cod", null);
  }
};

// ============================================
// QR CODE PAYMENT MODAL
// ============================================

// UPI ID for payment - CHANGE TO YOUR ACTUAL UPI ID
const UPI_ID = "9173576732@ybl";
const UPI_NAME = "Quick Laundry";

function showQRPaymentModal(orderData) {
  const existing = document.getElementById("qrPaymentModal");
  if (existing) existing.remove();

  const amount = orderData.totalPrice;
  const upiNote = `Order-QL-${Date.now()}`;
  const upiLink = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(
    UPI_NAME
  )}&am=${amount}&cu=INR&tn=${encodeURIComponent(upiNote)}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    upiLink
  )}`;

  const modal = document.createElement("div");
  modal.id = "qrPaymentModal";
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.7);
    display:flex;align-items:center;justify-content:center;padding:1rem;
    backdrop-filter:blur(4px);
  `;

  modal.innerHTML = `
    <div style="background:var(--primary-bg,#fff);border-radius:16px;max-width:320px;width:100%;
                position:relative;box-shadow:0 20px 50px rgba(0,0,0,0.3);text-align:center;overflow:hidden">
      
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:1rem 1.25rem;position:relative">
        <div style="display:flex;align-items:center;gap:0.5rem;justify-content:center;color:#fff">
          <i class="fas fa-qrcode" style="font-size:1.1rem"></i>
          <div>
            <div style="font-weight:800;font-size:1rem">Scan & Pay</div>
            <div style="opacity:0.85;font-size:0.75rem">Complete payment to confirm order</div>
          </div>
        </div>
        <button onclick="window.cancelQRPayment()" style="position:absolute;top:0.6rem;right:0.6rem;
          background:rgba(255,255,255,0.2);border:none;color:#fff;width:26px;height:26px;
          border-radius:50%;cursor:pointer;font-size:0.85rem;line-height:26px">✕</button>
      </div>

      <!-- Body -->
      <div style="padding:1rem 1.25rem">
        <div style="color:var(--text-secondary);font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Amount to Pay</div>
        <div style="font-size:2rem;font-weight:800;color:var(--accent-color);margin-bottom:0.75rem">₹${amount}.00</div>
        
        <!-- QR Code -->
        <div style="border:2px solid var(--accent-color);border-radius:12px;padding:8px;display:inline-block;margin-bottom:0.6rem;background:#fff">
          <img src="${qrApiUrl}" alt="UPI QR Code" style="width:148px;height:148px;display:block"
            onerror="this.src='https://chart.googleapis.com/chart?chs=148x148&cht=qr&chl=${encodeURIComponent(
              upiLink
            )}'">
        </div>
        
        <p style="color:var(--text-secondary);font-size:0.78rem;margin-bottom:0.75rem">
          <i class="fas fa-mobile-alt" style="color:var(--accent-color)"></i>
          Scan with PhonePe, GPay, Paytm or any UPI app
        </p>
        
        <!-- UPI ID Copy -->
        <div style="background:var(--secondary-bg,#f8f9fa);border-radius:10px;padding:0.6rem 0.9rem;margin-bottom:0.75rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem">
          <div style="text-align:left">
            <div style="font-size:0.68rem;color:var(--text-secondary)">UPI ID</div>
            <div style="font-weight:700;color:var(--text-primary);font-size:0.85rem">${UPI_ID}</div>
          </div>
          <button onclick="window.copyUPI()" id="copyUpiBtn"
            style="padding:0.35rem 0.75rem;background:var(--accent-color);color:#fff;border:none;
                   border-radius:7px;cursor:pointer;font-size:0.78rem;font-weight:600;white-space:nowrap">
            <i class="fas fa-copy"></i> Copy
          </button>
        </div>
        
        <!-- Steps -->
        <div style="text-align:left;margin-bottom:0.75rem">
          ${[
            `Open your UPI app`,
            `Scan the QR code above`,
            `Pay ₹${amount}.00 & click below`,
          ]
            .map(
              (s, i) => `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.25rem 0">
              <div style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);
                          color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0">${
                            i + 1
                          }</div>
              <span style="color:var(--text-secondary);font-size:0.8rem">${s}</span>
            </div>
          `
            )
            .join("")}
        </div>
        
        <!-- Action buttons -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem">
          <button onclick="window.cancelQRPayment()" 
            style="padding:0.65rem;background:var(--secondary-bg);color:var(--text-primary);
                   border:2px solid var(--border-color);border-radius:10px;font-weight:600;cursor:pointer;font-size:0.85rem">
            Cancel
          </button>
          <button onclick="window.confirmQRPayment()" id="qrDoneBtn"
            style="padding:0.65rem;background:linear-gradient(135deg,#10b981,#059669);color:#fff;
                   border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:0.85rem;
                   box-shadow:0 3px 10px rgba(16,185,129,0.35)">
            <i class="fas fa-check"></i> I've Paid
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";
}

window.copyUPI = () => {
  navigator.clipboard
    .writeText(UPI_ID)
    .then(() => {
      const btn = document.getElementById("copyUpiBtn");
      if (btn) {
        btn.innerHTML = "<i class='fas fa-check'></i> Copied!";
        btn.style.background = "#10b981";
        setTimeout(() => {
          btn.innerHTML = "<i class='fas fa-copy'></i> Copy";
          btn.style.background = "var(--accent-color)";
        }, 2000);
      }
    })
    .catch(() => {
      showNotification("UPI ID: " + UPI_ID, "info");
    });
};

window.cancelQRPayment = () => {
  document.getElementById("qrPaymentModal")?.remove();
  document.body.style.overflow = "";
  showNotification("Payment cancelled. Your order was not placed.", "info");
};

window.confirmQRPayment = async () => {
  const btn = document.getElementById("qrDoneBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming...';
  }

  document.getElementById("qrPaymentModal")?.remove();
  document.body.style.overflow = "";

  await submitOrder(state.pendingOrderData, "online", "pending_verification");
};

// ============================================
// SUBMIT ORDER TO BACKEND
// ============================================

async function submitOrder(orderData, paymentMode, paymentStatus) {
  const token = localStorage.getItem("jwtToken");
  if (!token) {
    showNotification("Please login to continue", "error");
    return;
  }

  try {
    showNotification("Placing your order...", "info");

    const payload = {
      serviceId: orderData.serviceId,
      serviceName: orderData.serviceName,
      quantity: orderData.quantity,
      unitPrice: orderData.unitPrice,
      totalPrice: orderData.totalPrice,
      unit: orderData.unit,
      pickupDate: orderData.pickupDate,
      pickupTime: orderData.pickupTime,
      pickupAddress: orderData.pickupAddress,
      specialInstructions: orderData.specialInstructions,
      paymentMode: paymentMode,
      payment_method: paymentMode,
      paymentStatus:
        paymentStatus ||
        (paymentMode === "cod" ? "pending" : "pending_verification"),
      payment_status:
        paymentStatus ||
        (paymentMode === "cod" ? "pending" : "pending_verification"),
    };

    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PLACE_ORDER}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (response.status === 401) {
      clearSession();
      showNotification("Session expired. Please login again", "error");
      setTimeout(() => {
        if (typeof openAuthModal === "function") openAuthModal("login");
      }, 1500);
      return;
    }

    if (result.success) {
      const orderNum =
        result.data?.order?.order_number || result.data?.orderId || "N/A";
      showOrderSuccessModal(orderData, orderNum, paymentMode, paymentStatus);
      state.pendingOrderData = null;
    } else {
      throw new Error(result.message || "Failed to place order");
    }
  } catch (err) {
    console.error("❌ Place Order Error:", err);
    showNotification(
      err.message || "Failed to place order. Please try again.",
      "error"
    );
  }
}

// ============================================
// ORDER SUCCESS MODAL
// ============================================

function showOrderSuccessModal(
  orderData,
  orderNumber,
  paymentMode,
  paymentStatus
) {
  const existing = document.getElementById("orderSuccessModal");
  if (existing) existing.remove();

  const payLabel =
    paymentMode === "online"
      ? "Online (Pending Verification)"
      : "Cash on Delivery";

  const modal = document.createElement("div");
  modal.id = "orderSuccessModal";
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.7);
    display:flex;align-items:center;justify-content:center;padding:1rem;
    backdrop-filter:blur(4px);
  `;

  modal.innerHTML = `
    <div style="background:var(--primary-bg,#fff);border-radius:16px;max-width:360px;width:100%;
                padding:1.75rem;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.3)">
      
      <!-- Success Icon -->
      <div style="width:60px;height:60px;background:linear-gradient(135deg,#10b981,#059669);
                  border-radius:50%;display:flex;align-items:center;justify-content:center;
                  margin:0 auto 1rem;font-size:1.5rem;color:#fff;
                  box-shadow:0 6px 20px rgba(16,185,129,0.4);animation:popIn 0.5s ease">
        <i class="fas fa-check"></i>
      </div>
      
      <h2 style="color:var(--text-primary);font-size:1.4rem;margin-bottom:0.4rem">
        Order Placed! 🎉
      </h2>
      <p style="color:var(--text-secondary);margin-bottom:1rem;font-size:0.9rem">
        Your ${orderData.serviceName.toLowerCase()} order is confirmed.
      </p>
      
      <!-- Order Details -->
      <div style="background:var(--secondary-bg,#f8f9fa);border-radius:12px;padding:1rem;margin-bottom:1rem;text-align:left">
        ${successDetailRow("fas fa-hashtag", "Order #", orderNumber)}
        ${successDetailRow(
          "fas fa-calendar",
          "Pickup",
          orderData.pickupDate + " · " + orderData.pickupTime
        )}
        ${successDetailRow(
          "fas fa-tshirt",
          "Qty",
          `${orderData.quantity} ${orderData.unit}`
        )}
        ${successDetailRow(
          "fas fa-rupee-sign",
          "Total",
          `₹${orderData.totalPrice}`
        )}
        ${successDetailRow("fas fa-credit-card", "Payment", payLabel)}
      </div>
      
      <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:0.6rem;margin-bottom:1rem;font-size:0.82rem">
        <i class="fas fa-envelope" style="color:#10b981"></i>
        <span style="color:var(--text-secondary);margin-left:0.4rem">Confirmation email sent to your inbox.</span>
      </div>
      
      <!-- Buttons -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem">
        <button onclick="document.getElementById('orderSuccessModal').remove();document.body.style.overflow=''"
          style="padding:0.7rem;background:var(--secondary-bg);color:var(--text-primary);
                 border:2px solid var(--border-color);border-radius:10px;font-weight:600;cursor:pointer;
                 display:flex;align-items:center;justify-content:center;gap:0.4rem;font-size:0.85rem">
          <i class="fas fa-shopping-bag"></i> Order More
        </button>
        <button onclick="window.location.href='orders.html'"
          style="padding:0.7rem;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;
                 border:none;border-radius:10px;font-weight:700;cursor:pointer;
                 display:flex;align-items:center;justify-content:center;gap:0.4rem;font-size:0.85rem;
                 box-shadow:0 4px 12px rgba(124,58,237,0.35)">
          <i class="fas fa-list-alt"></i> My Orders
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  // Add animation style if not present
  if (!document.getElementById("successAnimStyle")) {
    const style = document.createElement("style");
    style.id = "successAnimStyle";
    style.textContent = `
      @keyframes popIn {
        0% { transform: scale(0.3); opacity: 0; }
        70% { transform: scale(1.1); }
        100% { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
}

function successDetailRow(icon, label, value) {
  return `
    <div style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid var(--border-color,#e5e7eb)">
      <i class="${icon}" style="color:var(--accent-color);margin-top:2px;width:16px;flex-shrink:0"></i>
      <div style="flex:1">
        ${
          label
            ? `<span style="color:var(--text-secondary);font-size:0.85rem">${label} </span>`
            : ""
        }
        <span style="color:var(--text-primary);font-weight:600">${value}</span>
      </div>
    </div>
  `;
}

// ============================================
// HELPER FUNCTIONS (unchanged)
// ============================================

function setupEventListeners() {
  const modal = document.getElementById("serviceModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeServiceModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeServiceModal();
  });
}

function updateActiveNavigation() {
  document.querySelectorAll(".nav-link, .sidebar-link").forEach((link) => {
    const href = link.getAttribute("href") || link.getAttribute("data-section");
    const isActive =
      href === "services" || href === "services.html" || href === "#services";
    link.classList.toggle("active", isActive);
  });
}

function showNotification(msg, type = "info") {
  if (typeof window._globalShowNotification === "function")
    return window._globalShowNotification(msg, type);

  const colors = { success: "#10b981", error: "#ef4444", info: "#3b82f6" };
  const icons = {
    success: "check-circle",
    error: "exclamation-circle",
    info: "info-circle",
  };

  const notif = document.createElement("div");
  notif.style.cssText = `
    position:fixed;top:100px;right:20px;z-index:10000;
    background:${colors[type]};color:white;padding:1rem 1.5rem;
    border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.2);
    display:flex;align-items:center;gap:10px;font-weight:600;
    animation:slideIn 0.3s ease;
  `;
  notif.innerHTML = `<i class="fas fa-${icons[type]}"></i><span>${msg}</span>`;
  document.body.appendChild(notif);

  setTimeout(() => {
    notif.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

console.log("✨ Services Page Ready with Enhanced Features!");
console.log("🔗 API Base URL:", API_CONFIG.BASE_URL);
