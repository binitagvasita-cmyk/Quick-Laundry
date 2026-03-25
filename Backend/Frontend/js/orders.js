// ============================================
// ORDERS PAGE - Complete Order Management
// ============================================

console.log("📦 Orders Page JavaScript Loaded!");

const API_CONFIG = {
  BASE_URL: window.location.origin,
  ENDPOINTS: {
    GET_ORDERS: "/api/orders",
    GET_ORDER_DETAIL: "/api/orders",
    CANCEL_ORDER: "/api/orders",
    CHECK_INVOICE: "/api/invoices",
    DOWNLOAD_INVOICE: "/api/invoices",
  },
};

const state = {
  orders: [],
  filteredOrders: [],
  currentFilter: "all",
  currentView: "grid", // 'grid' (horizontal cards) | 'list' (vertical rows)
  selectedOrder: null,
  isLoggedIn: false,
  componentsLoaded: false,
};

// ============================================
// INITIALIZE
// FIX: orders.js is loaded dynamically via loadScript() in orders.html.
// By the time this script runs, DOMContentLoaded has ALREADY FIRED.
// A DOMContentLoaded listener would never trigger — so we detect the
// readyState and run immediately if the DOM is already loaded.
// ============================================
function initOrdersPage() {
  console.log("✅ Initializing Orders Page...");
  setupEventListeners();
  updateActiveNavigation();

  const isAuth = checkAuthStatus();
  console.log(`🔐 Init auth result: ${isAuth}`);
  if (isAuth) {
    loadOrders();
  }
}

if (document.readyState === "loading") {
  // Still loading — wait for DOMContentLoaded
  document.addEventListener("DOMContentLoaded", initOrdersPage);
} else {
  // DOM is already ready (this is always the case for dynamically loaded scripts)
  initOrdersPage();
}

// ============================================
// CHECK AUTH STATUS
// ============================================

function checkAuthStatus() {
  // Read directly from localStorage — always available, no race condition
  const isLoggedInFlag = localStorage.getItem("isLoggedIn") === "true";
  const token = localStorage.getItem("jwtToken");

  state.isLoggedIn = isLoggedInFlag && !!token;

  console.log(
    `🔐 Auth Status: ${state.isLoggedIn ? "Logged In ✅" : "Not Logged In ❌"}`
  );
  console.log(
    `   isLoggedIn flag: ${isLoggedInFlag}, token exists: ${!!token}`
  );

  if (!state.isLoggedIn) {
    showNotLoggedInMessage();
    return false;
  }

  return true;
}

function showNotLoggedInMessage() {
  const loading = document.getElementById("loadingContainer");
  const grid = document.getElementById("ordersGrid");
  const stats = document.getElementById("statsGrid");
  const filters = document.querySelector(".filter-tabs");

  if (loading) loading.style.display = "none";
  if (grid) grid.style.display = "none";
  if (stats) stats.style.display = "none";
  if (filters) filters.style.display = "none";

  const empty = document.getElementById("emptyState");
  if (empty) {
    empty.style.display = "block";
    empty.innerHTML = `
            <i class="fas fa-lock" style="font-size:4rem;color:var(--text-secondary);margin-bottom:1rem"></i>
            <h3 style="color:var(--text-primary);font-size:1.5rem;margin-bottom:0.75rem">Login Required</h3>
            <p style="color:var(--text-secondary);margin-bottom:1.5rem">Please login to view your orders</p>
            <button class="cta-btn" onclick="redirectToLogin()">
                <i class="fas fa-sign-in-alt"></i>
                <span>Login Now</span>
            </button>
        `;
  }
}

function redirectToLogin() {
  if (typeof openAuthModal === "function") {
    openAuthModal("login");
  } else {
    window.location.href = "home-content.html";
  }
}

window.redirectToLogin = redirectToLogin;

// ============================================
// LOAD ORDERS FROM BACKEND
// ============================================

async function loadOrders() {
  // FIX: Do NOT call checkAuthStatus() again here — it would call
  // showNotLoggedInMessage() and hide the loading spinner prematurely.
  // Auth was already verified before loadOrders() was called.
  const token = localStorage.getItem("jwtToken");
  if (!token) {
    showNotLoggedInMessage();
    return;
  }

  const loading = document.getElementById("loadingContainer");
  const error = document.getElementById("errorContainer");
  const grid = document.getElementById("ordersGrid");
  const empty = document.getElementById("emptyState");

  // Show loading, hide everything else
  if (loading) loading.style.display = "block";
  if (error) error.style.display = "none";
  if (empty) empty.style.display = "none";
  if (grid) grid.innerHTML = "";

  try {
    console.log(
      "📡 Fetching orders from:",
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_ORDERS}`
    );

    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_ORDERS}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("📥 Response status:", response.status, response.statusText);

    if (response.status === 401) {
      console.error("❌ Authentication failed - clearing storage");
      localStorage.clear();
      showNotLoggedInMessage();
      return;
    }

    const data = await response.json();
    console.log("📦 Orders API raw response:", JSON.stringify(data));

    if (data.success && data.data && data.data.orders) {
      state.orders = data.data.orders;
      state.filteredOrders = state.orders;
      console.log(`✅ Loaded ${state.orders.length} orders`);

      updateStats();
      renderOrders(state.filteredOrders);
    } else if (data.success && (!data.data || !data.data.orders)) {
      // Success but no orders key — treat as empty
      console.warn("⚠️ Response success but no orders array:", data);
      state.orders = [];
      state.filteredOrders = [];
      updateStats();
      renderOrders([]);
    } else {
      throw new Error(data.message || "Failed to load orders");
    }
  } catch (err) {
    console.error("❌ Error loading orders:", err);
    console.error("   Error type:", err.name);
    console.error("   Error message:", err.message);

    // "Failed to fetch" = CORS block or server down
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      console.error("   ⚠️ This looks like a CORS or network error!");
      console.error(
        "   ⚠️ Make sure Flask has OPTIONS handler for /api/orders"
      );
    }

    if (error) {
      error.style.display = "block";
      const errorMsg = document.getElementById("errorMessage");
      if (errorMsg) {
        errorMsg.textContent = err.message.includes("fetch")
          ? "Could not connect to server. Is Flask running?"
          : err.message || "Could not connect to the server.";
      }
    }
  } finally {
    if (loading) loading.style.display = "none";
  }
}

window.loadOrders = loadOrders;

// ============================================
// UPDATE STATISTICS
// ============================================

function updateStats() {
  const total = state.orders.length;
  const pending = state.orders.filter(
    (o) => o.status === "pending" || o.status === "confirmed"
  ).length;
  const processing = state.orders.filter(
    (o) =>
      o.status === "processing" ||
      o.status === "picked_up" ||
      o.status === "ready" ||
      o.status === "out_for_delivery"
  ).length;
  const completed = state.orders.filter((o) => o.status === "delivered").length;

  const totalEl = document.getElementById("totalOrders");
  const pendingEl = document.getElementById("pendingOrders");
  const processingEl = document.getElementById("processingOrders");
  const completedEl = document.getElementById("completedOrders");

  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (processingEl) processingEl.textContent = processing;
  if (completedEl) completedEl.textContent = completed;
}

// ============================================
// RENDER ORDERS
// ============================================

function renderOrders(orders) {
  const grid = document.getElementById("ordersGrid");
  const empty = document.getElementById("emptyState");

  if (!grid) return;

  if (!orders || orders.length === 0) {
    grid.style.display = "none";
    if (empty) {
      empty.style.display = "block";
      empty.innerHTML = `
                <i class="fas fa-inbox"></i>
                <h3>No Orders Found</h3>
                <p>You haven't placed any orders yet. Start by browsing our services!</p>
                <a href="services.html" class="cta-btn">
                    <i class="fas fa-shopping-bag"></i>
                    <span>Browse Services</span>
                </a>
            `;
    }
    return;
  }

  if (empty) empty.style.display = "none";

  if (state.currentView === "list") {
    // ── List / Vertical view ──
    grid.style.display = "flex";
    grid.style.flexDirection = "column";
    grid.style.gap = "0.75rem";
    grid.innerHTML = `
            <style>
                .order-list-row {
                    display:flex;align-items:center;gap:1.25rem;
                    background:var(--primary-bg,#fff);
                    border:1px solid var(--border-color,#e5e7eb);
                    border-radius:14px;padding:1rem 1.25rem;
                    cursor:pointer;transition:all 0.2s;
                    position:relative;overflow:hidden;
                }
                .order-list-row::before {
                    content:'';position:absolute;left:0;top:0;bottom:0;
                    width:4px;background:var(--accent-color,#7c3aed);
                    border-radius:4px 0 0 4px;
                    transition:width 0.2s;
                }
                .order-list-row:hover {
                    border-color:var(--accent-color,#7c3aed);
                    box-shadow:0 4px 20px rgba(124,58,237,0.1);
                    transform:translateX(4px);
                }
                .order-list-row:hover::before { width:6px; }
                .olist-num {
                    min-width:140px;
                }
                .olist-num .num { font-weight:700;font-size:0.9rem;color:var(--text-primary,#1a1a2e); }
                .olist-num .date { font-size:0.78rem;color:var(--text-secondary,#888);margin-top:2px; }
                .olist-addr {
                    flex:1;font-size:0.85rem;color:var(--text-secondary,#555);
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                    max-width:220px;
                }
                .olist-meta {
                    display:flex;gap:1.5rem;align-items:center;flex-shrink:0;
                }
                .olist-meta-item {
                    text-align:center;min-width:70px;
                }
                .olist-meta-item .label { font-size:0.72rem;color:var(--text-secondary,#999);text-transform:uppercase;letter-spacing:0.4px; }
                .olist-meta-item .value { font-size:0.85rem;font-weight:600;color:var(--text-primary,#1a1a2e);margin-top:2px; }
                .olist-amount {
                    font-size:1rem;font-weight:700;
                    color:var(--accent-color,#7c3aed);
                    min-width:80px;text-align:right;
                }
                .olist-actions {
                    display:flex;gap:0.5rem;flex-shrink:0;
                }
                .olist-btn {
                    padding:0.4rem 0.75rem;border-radius:8px;border:none;
                    font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.2s;
                }
                .olist-btn-view {
                    background:var(--accent-color,#7c3aed);color:#fff;
                }
                .olist-btn-view:hover { opacity:0.85;transform:translateY(-1px); }
                .olist-btn-cancel {
                    background:#fee2e2;color:#ef4444;
                }
                .olist-btn-cancel:hover { background:#fecaca;transform:translateY(-1px); }
                @media(max-width:768px) {
                    .olist-meta { display:none; }
                    .olist-addr { max-width:120px; }
                }
            </style>
            ${orders
              .map((order) => {
                const canCancel =
                  order.status === "pending" || order.status === "confirmed";
                const statusClass = order.status
                  .toLowerCase()
                  .replace(/_/g, "-");
                const date = new Date(order.createdAt).toLocaleDateString(
                  "en-IN",
                  { day: "numeric", month: "short", year: "numeric" }
                );
                return `
                <div class="order-list-row" onclick="window.openOrderDetails('${
                  order.orderNumber
                }')">
                    <div class="olist-num">
                        <div class="num"><i class="fas fa-receipt" style="color:var(--accent-color,#7c3aed);margin-right:4px"></i>${
                          order.orderNumber
                        }</div>
                        <div class="date">${date}</div>
                    </div>
                    <div class="olist-addr" title="${order.pickupAddress}">
                        <i class="fas fa-map-marker-alt" style="margin-right:4px;color:var(--accent-color,#7c3aed)"></i>${
                          order.pickupAddress
                        }
                    </div>
                    <div class="olist-meta">
                        <div class="olist-meta-item">
                            <div class="label">Pickup</div>
                            <div class="value">${new Date(
                              order.pickupDate
                            ).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}</div>
                        </div>
                        <div class="olist-meta-item">
                            <div class="label">Type</div>
                            <div class="value">${
                              formatDeliveryType(order.deliveryType).split(
                                " "
                              )[0]
                            }</div>
                        </div>
                        <div class="olist-meta-item">
                            <div class="label">Items</div>
                            <div class="value">${order.itemsCount}</div>
                        </div>
                    </div>
                    <div>
                        <div class="order-status ${statusClass}" style="font-size:0.78rem">${formatStatus(
                  order.status
                )}</div>
                    </div>
                    <div class="olist-amount">₹${order.totalAmount.toFixed(
                      2
                    )}</div>
                    <div class="olist-actions" onclick="event.stopPropagation()">
                        <button class="olist-btn olist-btn-view" onclick="window.openOrderDetails('${
                          order.orderNumber
                        }')">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${
                          canCancel
                            ? `
                            <button class="olist-btn olist-btn-cancel" onclick="window.confirmCancelOrder('${order.orderNumber}', ${order.orderId})">
                                <i class="fas fa-ban"></i>
                            </button>
                        `
                            : ""
                        }
                    </div>
                </div>`;
              })
              .join("")}
        `;
  } else {
    // ── Grid / Horizontal card view ──
    grid.style.display = "grid";
    grid.style.flexDirection = "";
    grid.style.gap = "";
    grid.innerHTML = orders.map((order) => createOrderCard(order)).join("");
  }
}

function createOrderCard(order) {
  const statusClass = order.status.toLowerCase().replace(/_/g, "-");
  const statusText = formatStatus(order.status);
  const date = new Date(order.createdAt);
  const formattedDate = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const canCancel = order.status === "pending" || order.status === "confirmed";

  return `
        <div class="order-card" onclick="window.openOrderDetails('${
          order.orderNumber
        }')">
            <div class="order-header">
                <div>
                    <div class="order-number">
                        <i class="fas fa-receipt"></i>
                        ${order.orderNumber}
                    </div>
                    <div class="order-date">
                        <i class="fas fa-calendar"></i>
                        ${formattedDate}
                    </div>
                </div>
                <div class="order-status ${statusClass}">
                    ${statusText}
                </div>
            </div>
            
            <div class="order-address">
                <i class="fas fa-map-marker-alt"></i>
                <div class="order-address-text">${order.pickupAddress}</div>
            </div>
            
            <div class="order-body">
                <div class="order-info">
                    <div class="order-info-label">Pickup Date</div>
                    <div class="order-info-value">
                        <i class="fas fa-calendar-check"></i>
                        ${new Date(order.pickupDate).toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short" }
                        )}
                    </div>
                </div>
                
                <div class="order-info">
                    <div class="order-info-label">Pickup Time</div>
                    <div class="order-info-value">
                        <i class="fas fa-clock"></i>
                        ${order.pickupTime}
                    </div>
                </div>
                
                <div class="order-info">
                    <div class="order-info-label">Delivery Type</div>
                    <div class="order-info-value">
                        <i class="fas fa-truck"></i>
                        ${formatDeliveryType(order.deliveryType)}
                    </div>
                </div>
                
                <div class="order-info">
                    <div class="order-info-label">Items</div>
                    <div class="order-info-value">
                        <i class="fas fa-box"></i>
                        ${order.itemsCount} items (${order.totalQuantity} qty)
                    </div>
                </div>
            </div>
            
            <div class="order-footer">
                <div style="display:flex;flex-direction:column;gap:0.35rem">
                    <div class="order-total">
                        Total: ₹${order.totalAmount.toFixed(2)}
                    </div>
                    <div style="display:flex;align-items:center;gap:0.4rem;font-size:0.78rem;font-weight:600;${
                      order.paymentStatus === "paid"
                        ? "color:#16a34a"
                        : order.paymentStatus === "refunded"
                        ? "color:#7c3aed"
                        : order.paymentStatus === "failed"
                        ? "color:#ef4444"
                        : "color:#d97706"
                    }">
                        <i class="fas fa-${
                          order.paymentStatus === "paid"
                            ? "check-circle"
                            : order.paymentStatus === "refunded"
                            ? "undo-alt"
                            : order.paymentStatus === "failed"
                            ? "times-circle"
                            : "clock"
                        }"></i>
                        Payment: ${
                          order.paymentStatus === "paid"
                            ? "Paid"
                            : order.paymentStatus === "refunded"
                            ? "Refunded"
                            : order.paymentStatus === "failed"
                            ? "Failed"
                            : "Pending"
                        }
                    </div>
                </div>
                
                <div class="order-actions" onclick="event.stopPropagation()">
                    <button class="order-btn primary" onclick="window.openOrderDetails('${
                      order.orderNumber
                    }')">
                        <i class="fas fa-eye"></i>
                        <span>View Details</span>
                    </button>
                    
                    ${
                      canCancel
                        ? `
                        <button class="order-btn danger" onclick="window.confirmCancelOrder('${order.orderNumber}', ${order.orderId})">
                            <i class="fas fa-times-circle"></i>
                            <span>Cancel</span>
                        </button>
                    `
                        : ""
                    }
                </div>
            </div>
        </div>
    `;
}

// ============================================
// FORMAT HELPERS
// ============================================

function formatStatus(status) {
  const statusMap = {
    pending: "Pending",
    confirmed: "Confirmed",
    picked_up: "Picked Up",
    processing: "Processing",
    ready: "Ready",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return statusMap[status] || status;
}

function formatDeliveryType(type) {
  const typeMap = {
    express: "Express (24h)",
    standard: "Standard (48h)",
    economy: "Economy (72h)",
  };
  return typeMap[type] || type;
}

// ============================================
// ORDER DETAILS MODAL
// ============================================

async function openOrderDetails(orderNumber) {
  console.log(`📖 Opening order details for: ${orderNumber}`);

  const order = state.orders.find((o) => o.orderNumber === orderNumber);

  if (!order) {
    showNotification("Order not found", "error");
    return;
  }

  try {
    const token = localStorage.getItem("jwtToken");
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_ORDER_DETAIL}/${order.orderId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (data.success && data.data?.order) {
      showOrderDetailsModal(data.data.order);
    } else {
      throw new Error("Failed to load order details");
    }
  } catch (error) {
    console.error("Error loading order details:", error);
    // Fallback to basic order info from state
    showOrderDetailsModal(order);
  }
}

window.openOrderDetails = openOrderDetails;

function showOrderDetailsModal(order) {
  const modal = document.getElementById("orderModal");
  const content = document.getElementById("orderModalContent");

  if (!modal || !content) return;

  const statusClass = order.status.toLowerCase().replace(/_/g, "-");
  const within24hrs = order.createdAt
    ? Date.now() - new Date(order.createdAt).getTime() < 24 * 60 * 60 * 1000
    : true;
  const canCancel =
    (order.status === "pending" || order.status === "confirmed") && within24hrs;

  // Safe fallbacks for fields that may not exist in list view
  const subtotal = order.subtotal ?? order.totalAmount ?? 0;
  const deliveryCharge = order.deliveryCharge ?? 0;
  const totalAmount = order.totalAmount ?? 0;

  content.innerHTML = `
        <button class="modal-close-btn" onclick="window.closeOrderModal()">
            <i class="fas fa-times"></i>
        </button>
        
        <div style="text-align:center;margin-bottom:2rem">
            <h2 style="font-size:2rem;color:var(--text-primary);margin-bottom:0.5rem">
                Order Details
            </h2>
            <div style="font-size:1.3rem;color:var(--accent-color);font-weight:700">
                ${order.orderNumber}
            </div>
            <div class="order-status ${statusClass}" style="display:inline-block;margin-top:1rem">
                ${formatStatus(order.status)}
            </div>
        </div>
        
        ${
          order.items && order.items.length > 0
            ? `
            <div style="background:var(--secondary-bg);padding:1.5rem;border-radius:12px;margin-bottom:2rem">
                <h3 style="color:var(--text-primary);margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem">
                    <i class="fas fa-box"></i> Order Items
                </h3>
                <div style="display:flex;flex-direction:column;gap:0.75rem">
                    ${order.items
                      .map(
                        (item) => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem;background:var(--primary-bg);border-radius:8px">
                            <div>
                                <strong style="color:var(--text-primary)">${
                                  item.serviceName
                                }</strong>
                                <span style="color:var(--text-secondary);margin-left:0.5rem">× ${
                                  item.quantity
                                } ${item.unit}</span>
                            </div>
                            <strong style="color:var(--accent-color)">₹${item.totalPrice.toFixed(
                              2
                            )}</strong>
                        </div>
                    `
                      )
                      .join("")}
                </div>
            </div>
        `
            : ""
        }
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.5rem;margin-bottom:2rem">
            <div style="background:var(--secondary-bg);padding:1.5rem;border-radius:12px">
                <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem">Pickup Date</div>
                <div style="color:var(--text-primary);font-weight:600;font-size:1.1rem">
                    <i class="fas fa-calendar-check" style="color:var(--accent-color)"></i>
                    ${new Date(order.pickupDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                </div>
            </div>
            
            <div style="background:var(--secondary-bg);padding:1.5rem;border-radius:12px">
                <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem">Pickup Time</div>
                <div style="color:var(--text-primary);font-weight:600;font-size:1.1rem">
                    <i class="fas fa-clock" style="color:var(--accent-color)"></i>
                    ${order.pickupTime}
                </div>
            </div>
            
            <div style="background:var(--secondary-bg);padding:1.5rem;border-radius:12px">
                <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem">Delivery Type</div>
                <div style="color:var(--text-primary);font-weight:600;font-size:1.1rem">
                    <i class="fas fa-truck" style="color:var(--accent-color)"></i>
                    ${formatDeliveryType(order.deliveryType)}
                </div>
            </div>
            
            <div style="background:var(--secondary-bg);padding:1.5rem;border-radius:12px">
                <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem">Payment Method</div>
                <div style="color:var(--text-primary);font-weight:600;font-size:1.1rem">
                    <i class="fas fa-credit-card" style="color:var(--accent-color)"></i>
                    ${(order.paymentMethod || "cod").toUpperCase()}
                </div>
            </div>
            
            <div style="background:var(--secondary-bg);padding:1.5rem;border-radius:12px">
                <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem">Payment Status</div>
                <div style="font-weight:700;font-size:1rem;display:flex;align-items:center;gap:0.4rem;${
                  order.paymentStatus === "paid"
                    ? "color:#16a34a"
                    : order.paymentStatus === "refunded"
                    ? "color:#7c3aed"
                    : order.paymentStatus === "failed"
                    ? "color:#ef4444"
                    : "color:#d97706"
                }">
                    <i class="fas fa-${
                      order.paymentStatus === "paid"
                        ? "check-circle"
                        : order.paymentStatus === "refunded"
                        ? "undo-alt"
                        : order.paymentStatus === "failed"
                        ? "times-circle"
                        : "hourglass-half"
                    }"></i>
                    ${
                      order.paymentStatus === "paid"
                        ? "Paid ✓"
                        : order.paymentStatus === "refunded"
                        ? "Refunded"
                        : order.paymentStatus === "failed"
                        ? "Failed"
                        : "Pending"
                    }
                </div>
                ${
                  order.paymentStatus === "pending"
                    ? `
                    <div style="margin-top:0.4rem;font-size:0.78rem;color:var(--text-secondary)">
                        ${
                          order.paymentMethod === "cod"
                            ? "💵 Pay with cash at delivery"
                            : "📱 Complete payment online"
                        }
                    </div>
                `
                    : ""
                }
            </div>
        </div>
        
        <div style="background:var(--secondary-bg);padding:1.5rem;border-radius:12px;margin-bottom:2rem">
            <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem">Pickup Address</div>
            <div style="color:var(--text-primary);line-height:1.6">
                <i class="fas fa-map-marker-alt" style="color:var(--accent-color)"></i>
                ${order.pickupAddress}
            </div>
        </div>
        
        ${
          order.specialInstructions
            ? `
            <div style="background:var(--secondary-bg);padding:1.5rem;border-radius:12px;margin-bottom:2rem">
                <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem">Special Instructions</div>
                <div style="color:var(--text-primary);line-height:1.6">
                    <i class="fas fa-comment" style="color:var(--accent-color)"></i>
                    ${order.specialInstructions}
                </div>
            </div>
        `
            : ""
        }
        
        <div style="background:linear-gradient(135deg,var(--gradient-start),var(--gradient-end));padding:2rem;border-radius:12px;margin-bottom:2rem">
            <div style="display:flex;justify-content:space-between;align-items:center;color:white">
                <div>
                    <div style="font-size:0.9rem;opacity:0.9;margin-bottom:0.5rem">Total Amount</div>
                    <div style="font-size:2.5rem;font-weight:800">₹${totalAmount.toFixed(
                      2
                    )}</div>
                </div>
                <div style="text-align:right">
                    <div style="font-size:0.9rem;opacity:0.9">Subtotal: ₹${subtotal.toFixed(
                      2
                    )}</div>
                    <div style="font-size:0.9rem;opacity:0.9">Delivery: ₹${deliveryCharge.toFixed(
                      2
                    )}</div>
                </div>
            </div>
        </div>
        
        <div style="display:flex;gap:1rem;flex-wrap:wrap">
            ${
              canCancel
                ? `
                <button class="order-btn danger" style="flex:1" onclick="window.confirmCancelOrder('${order.orderNumber}', ${order.orderId})">
                    <i class="fas fa-times-circle"></i>
                    <span>Cancel Order</span>
                </button>
            `
                : order.status === "pending" || order.status === "confirmed"
                ? `
                <div style="flex:1;padding:0.75rem 1rem;border-radius:10px;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;font-size:0.85rem;text-align:center;">
                    <i class="fas fa-clock"></i> Cancellation window expired (24h limit)
                </div>
            `
                : ""
            }

            <div id="invoiceBtnWrap_${
              order.orderId
            }" style="flex:1;min-width:160px">
                <button class="order-btn secondary" style="width:100%;justify-content:center" disabled>
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Checking invoice…</span>
                </button>
            </div>

            <button class="order-btn secondary" style="flex:1" onclick="window.closeOrderModal()">
                <i class="fas fa-times"></i>
                <span>Close</span>
            </button>
        </div>
    `;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";

  // ── Async: check if invoice is ready and update the button ──
  _loadInvoiceButton(order.orderId, order.orderNumber);
}

function closeOrderModal() {
  const modal = document.getElementById("orderModal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

window.closeOrderModal = closeOrderModal;

// ============================================
// CANCEL ORDER — Custom Popup (replaces confirm())
// ============================================

function confirmCancelOrder(orderNumber, orderId) {
  // Remove any existing cancel popup
  const existing = document.getElementById("cancelConfirmPopup");
  if (existing) existing.remove();

  const popup = document.createElement("div");
  popup.id = "cancelConfirmPopup";
  popup.style.cssText = `
        position:fixed;inset:0;z-index:99999;
        display:flex;align-items:center;justify-content:center;
        background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);
        animation:cancelFadeIn 0.2s ease;
    `;

  popup.innerHTML = `
        <style>
            @keyframes cancelFadeIn  { from{opacity:0} to{opacity:1} }
            @keyframes cancelSlideUp { from{opacity:0;transform:translateY(30px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
            #cancelConfirmPopup .cancel-popup-box {
                background:var(--primary-bg, #fff);
                border-radius:20px;
                padding:2.5rem 2rem 2rem;
                max-width:420px;
                width:90%;
                box-shadow:0 25px 60px rgba(0,0,0,0.25);
                animation:cancelSlideUp 0.25s cubic-bezier(.34,1.56,.64,1);
                text-align:center;
                position:relative;
            }
            #cancelConfirmPopup .cancel-icon-wrap {
                width:72px;height:72px;border-radius:50%;
                background:linear-gradient(135deg,#fee2e2,#fecaca);
                display:flex;align-items:center;justify-content:center;
                margin:0 auto 1.25rem;
                animation:cancelSlideUp 0.3s ease 0.05s both;
            }
            #cancelConfirmPopup .cancel-icon-wrap i {
                font-size:2rem;color:#ef4444;
            }
            #cancelConfirmPopup h3 {
                font-size:1.4rem;font-weight:700;
                color:var(--text-primary,#1a1a2e);
                margin-bottom:0.5rem;
            }
            #cancelConfirmPopup p {
                color:var(--text-secondary,#666);
                font-size:0.95rem;line-height:1.5;
                margin-bottom:0.75rem;
            }
            #cancelConfirmPopup .order-tag {
                display:inline-block;
                background:linear-gradient(135deg,var(--gradient-start,#7c3aed),var(--gradient-end,#6d28d9));
                color:#fff;padding:0.3rem 1rem;
                border-radius:20px;font-size:0.85rem;font-weight:600;
                margin-bottom:1.75rem;letter-spacing:0.5px;
            }
            #cancelConfirmPopup .reason-label {
                text-align:left;display:block;
                font-size:0.82rem;font-weight:600;
                color:var(--text-secondary,#888);
                margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.5px;
            }
            #cancelConfirmPopup .cancel-reason-select {
                width:100%;padding:0.7rem 1rem;
                border:2px solid var(--border-color,#e5e7eb);
                border-radius:10px;font-size:0.9rem;
                background:var(--secondary-bg,#f9fafb);
                color:var(--text-primary,#1a1a2e);
                margin-bottom:1.5rem;outline:none;
                cursor:pointer;
                transition:border-color 0.2s;
            }
            #cancelConfirmPopup .cancel-reason-select:focus {
                border-color:var(--accent-color,#7c3aed);
            }
            #cancelConfirmPopup .popup-actions {
                display:flex;gap:0.75rem;
            }
            #cancelConfirmPopup .popup-btn {
                flex:1;padding:0.85rem 1rem;border-radius:12px;
                font-size:0.95rem;font-weight:600;cursor:pointer;
                border:none;transition:all 0.2s;
            }
            #cancelConfirmPopup .popup-btn-cancel {
                background:var(--secondary-bg,#f3f4f6);
                color:var(--text-primary,#374151);
            }
            #cancelConfirmPopup .popup-btn-cancel:hover {
                background:var(--border-color,#e5e7eb);
                transform:translateY(-1px);
            }
            #cancelConfirmPopup .popup-btn-confirm {
                background:linear-gradient(135deg,#ef4444,#dc2626);
                color:#fff;
                box-shadow:0 4px 15px rgba(239,68,68,0.35);
            }
            #cancelConfirmPopup .popup-btn-confirm:hover {
                transform:translateY(-2px);
                box-shadow:0 6px 20px rgba(239,68,68,0.45);
            }
            #cancelConfirmPopup .popup-btn-confirm:disabled {
                opacity:0.7;cursor:not-allowed;transform:none;
            }
        </style>
        <div class="cancel-popup-box">
            <div class="cancel-icon-wrap">
                <i class="fas fa-ban"></i>
            </div>
            <h3>Cancel Order?</h3>
            <p>This action cannot be undone. Your order will be cancelled immediately.</p>
            <div class="order-tag">${orderNumber}</div>

            <label class="reason-label">Reason for cancellation</label>
            <select class="cancel-reason-select" id="cancelReasonSelect">
                <option value="Changed my mind">Changed my mind</option>
                <option value="Found a better option">Found a better option</option>
                <option value="Order placed by mistake">Order placed by mistake</option>
                <option value="Delivery time too long">Delivery time too long</option>
                <option value="Other">Other</option>
            </select>

            <div class="popup-actions">
                <button class="popup-btn popup-btn-cancel" id="cancelPopupDismiss">
                    <i class="fas fa-arrow-left"></i> Keep Order
                </button>
                <button class="popup-btn popup-btn-confirm" id="cancelPopupConfirm">
                    <i class="fas fa-ban"></i> Yes, Cancel
                </button>
            </div>
        </div>
    `;

  document.body.appendChild(popup);

  // Close on backdrop click
  popup.addEventListener("click", (e) => {
    if (e.target === popup) closeCancelPopup();
  });

  document
    .getElementById("cancelPopupDismiss")
    .addEventListener("click", closeCancelPopup);

  document
    .getElementById("cancelPopupConfirm")
    .addEventListener("click", () => {
      const reason = document.getElementById("cancelReasonSelect").value;
      const btn = document.getElementById("cancelPopupConfirm");
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelling...';
      cancelOrder(orderId, orderNumber, reason);
    });
}

function closeCancelPopup() {
  const popup = document.getElementById("cancelConfirmPopup");
  if (popup) {
    popup.style.animation = "cancelFadeIn 0.15s ease reverse";
    setTimeout(() => popup.remove(), 150);
  }
}

window.confirmCancelOrder = confirmCancelOrder;
window.closeCancelPopup = closeCancelPopup;

async function cancelOrder(
  orderId,
  orderNumber,
  reason = "Cancelled by customer"
) {
  try {
    const token = localStorage.getItem("jwtToken");
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CANCEL_ORDER}/${orderId}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      }
    );

    const data = await response.json();

    if (data.success) {
      closeCancelPopup();
      closeOrderModal();
      showNotification("Order cancelled successfully", "success");
      loadOrders();
    } else {
      throw new Error(data.message || "Failed to cancel order");
    }
  } catch (error) {
    console.error("Error cancelling order:", error);
    closeCancelPopup();
    showNotification(error.message || "Failed to cancel order", "error");
  }
}

// ============================================
// FILTER ORDERS
// ============================================

function setupEventListeners() {
  // ── Filter tabs ──
  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      filterOrders(tab.dataset.filter);
    });
  });

  // ── Inject View Toggle button next to filter tabs ──
  injectViewToggle();

  // ── Close modal on backdrop click ──
  const modal = document.getElementById("orderModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeOrderModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeOrderModal();
      closeCancelPopup();
    }
  });
}

function injectViewToggle() {
  // Don't inject twice
  if (document.getElementById("viewToggleBtn")) return;

  const filterSection = document.querySelector(".filter-section .container");
  if (!filterSection) return;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
        display:flex;justify-content:flex-end;margin-top:0.75rem;
    `;
  wrapper.innerHTML = `
        <style>
            .view-toggle {
                display:inline-flex;
                background:var(--secondary-bg,#f3f4f6);
                border-radius:10px;
                padding:4px;
                gap:2px;
                border:1px solid var(--border-color,#e5e7eb);
            }
            .view-toggle-btn {
                padding:0.45rem 0.85rem;
                border:none;border-radius:7px;
                background:transparent;
                color:var(--text-secondary,#888);
                cursor:pointer;font-size:0.9rem;
                transition:all 0.2s;display:flex;
                align-items:center;gap:0.4rem;
                font-weight:500;
            }
            .view-toggle-btn.active {
                background:var(--accent-color,#7c3aed);
                color:#fff;
                box-shadow:0 2px 8px rgba(124,58,237,0.3);
            }
            .view-toggle-btn:not(.active):hover {
                background:var(--border-color,#e5e7eb);
                color:var(--text-primary,#333);
            }
        </style>
        <div class="view-toggle" id="viewToggleBtn">
            <button class="view-toggle-btn active" data-view="grid" title="Grid View">
                <i class="fas fa-th-large"></i>
                <span>Grid</span>
            </button>
            <button class="view-toggle-btn" data-view="list" title="List View">
                <i class="fas fa-list"></i>
                <span>List</span>
            </button>
        </div>
    `;

  filterSection.appendChild(wrapper);

  document.querySelectorAll(".view-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".view-toggle-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.currentView = btn.dataset.view;
      renderOrders(state.filteredOrders);
    });
  });
}

function filterOrders(filter) {
  state.currentFilter = filter;
  // Group all in-progress statuses under the "Processing" tab
  const processingStatuses = [
    "processing",
    "picked_up",
    "ready",
    "out_for_delivery",
  ];

  if (filter === "all") {
    state.filteredOrders = state.orders;
  } else if (filter === "processing") {
    state.filteredOrders = state.orders.filter((o) =>
      processingStatuses.includes(o.status)
    );
  } else {
    state.filteredOrders = state.orders.filter((o) => o.status === filter);
  }
  renderOrders(state.filteredOrders);
}

// ============================================
// NAVIGATION
// ============================================

function updateActiveNavigation() {
  document.querySelectorAll(".nav-link, .sidebar-link").forEach((link) => {
    const href = link.getAttribute("href") || link.getAttribute("data-section");
    const isActive =
      href === "orders" || href === "orders.html" || href === "#orders";
    link.classList.toggle("active", isActive);
  });
}

// ============================================
// NOTIFICATIONS
// ============================================

function showNotification(msg, type = "info") {
  // Don't recurse if window.showNotification is this same function
  if (typeof window._globalShowNotification === "function") {
    return window._globalShowNotification(msg, type);
  }

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

console.log("✨ Orders Page Ready!");
console.log("🔗 API Base URL:", API_CONFIG.BASE_URL);

// ============================================================
// USER NOTIFICATION POLLING SYSTEM
// Polls every 30s for new notifications (e.g. order accepted)
// ============================================================

(function initUserNotificationPolling() {
  const POLL_INTERVAL_MS = 30000; // 30 seconds
  let pollingTimer = null;

  async function fetchAndShowNotifications() {
    const token = localStorage.getItem("jwtToken");
    if (!token) return;

    try {
      const res = await fetch(
        `${API_CONFIG.BASE_URL}/api/orders/notifications`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !data.data || !data.data.notifications) return;

      const notifs = data.data.notifications;
      if (notifs.length === 0) return;

      // Guard: skip any notification already shown this session
      const shownKey = "shownNotifIds";
      const shownIds = JSON.parse(sessionStorage.getItem(shownKey) || "[]");

      const newNotifs = notifs.filter(
        (n) => !shownIds.includes(n.notification_id)
      );
      if (newNotifs.length === 0) return;

      // Track as shown
      const updatedIds = [
        ...shownIds,
        ...newNotifs.map((n) => n.notification_id),
      ];
      sessionStorage.setItem(shownKey, JSON.stringify(updatedIds));

      // Show each new notification as a popup
      newNotifs.forEach((n, i) => {
        setTimeout(() => {
          showOrderNotificationPopup(n.title, n.message, n.notification_id);
        }, i * 800); // stagger slightly
      });

      // Backend already marks as read atomically — no separate call needed
    } catch (err) {
      // Silently fail — non-critical
      console.warn("🔔 Notification poll error (non-critical):", err.message);
    }
  }

  function showOrderNotificationPopup(title, message, notifId) {
    // Use existing notify system if available
    if (window.notify && window.notify.success) {
      window.notify.show(message, "success", 6000);
      return;
    }

    // Fallback: custom popup
    const existing = document.getElementById(`orderNotifPopup_${notifId}`);
    if (existing) return;

    const popup = document.createElement("div");
    popup.id = `orderNotifPopup_${notifId}`;
    popup.style.cssText = `
            position:fixed;bottom:24px;right:24px;z-index:99999;
            background:#fff;border-radius:16px;
            box-shadow:0 8px 32px rgba(124,58,237,0.18);
            padding:1.25rem 1.5rem;max-width:340px;width:90%;
            border-left:4px solid #7c3aed;
            animation:notifSlideIn 0.35s cubic-bezier(.34,1.56,.64,1);
            display:flex;gap:1rem;align-items:flex-start;
        `;
    popup.innerHTML = `
            <style>
                @keyframes notifSlideIn {
                    from{opacity:0;transform:translateX(60px)}
                    to{opacity:1;transform:translateX(0)}
                }
                @keyframes notifSlideOut {
                    from{opacity:1;transform:translateX(0)}
                    to{opacity:0;transform:translateX(60px)}
                }
            </style>
            <div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;
                        background:linear-gradient(135deg,#7c3aed,#6d28d9);
                        display:flex;align-items:center;justify-content:center;">
                <i class="fas fa-check" style="color:#fff;font-size:1.1rem"></i>
            </div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;color:#1a1a2e;font-size:0.95rem;margin-bottom:0.3rem">${title}</div>
                <p style="color:#555;font-size:0.85rem;line-height:1.5;margin:0">${message}</p>
            </div>
            <button onclick="this.closest('[id^=orderNotifPopup_]').remove()"
                    style="background:none;border:none;color:#999;cursor:pointer;
                           font-size:1rem;padding:0;flex-shrink:0;margin-top:2px;">
                <i class="fas fa-times"></i>
            </button>
        `;

    document.body.appendChild(popup);

    // Auto-remove after 7 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.style.animation = "notifSlideOut 0.3s ease forwards";
        setTimeout(() => popup.remove(), 300);
      }
    }, 7000);
  }

  function startPolling() {
    // Poll immediately on load, then every 30s
    fetchAndShowNotifications();
    pollingTimer = setInterval(fetchAndShowNotifications, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollingTimer) clearInterval(pollingTimer);
  }

  // Start polling if user is logged in
  const token = localStorage.getItem("jwtToken");
  if (token) {
    startPolling();
  }

  // Expose for manual control
  window._notifPolling = { start: startPolling, stop: stopPolling };

  console.log("🔔 User notification polling initialized (30s interval)");
})();

// ════════════════════════════════════════════════════════════
//  INVOICE FUNCTIONS
// ════════════════════════════════════════════════════════════

async function _loadInvoiceButton(orderId, orderNumber) {
  const wrap = document.getElementById(`invoiceBtnWrap_${orderId}`);
  if (!wrap) return;

  try {
    const token =
      localStorage.getItem("jwtToken") || localStorage.getItem("token");
    const res = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHECK_INVOICE}/${orderId}/check`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    const data = await res.json();
    const hasInvoice = data.success && data.data?.has_invoice;

    if (hasInvoice) {
      wrap.innerHTML = `
                <button class="order-btn primary" style="width:100%;justify-content:center;
                    background:linear-gradient(135deg,#6366f1,#8b5cf6)"
                    onclick="window.downloadInvoice(${orderId}, '${orderNumber}')">
                    <i class="fas fa-file-pdf"></i>
                    <span>Download Invoice</span>
                </button>`;
    } else {
      wrap.innerHTML = `
                <div style="width:100%;padding:0.75rem 1rem;border-radius:10px;
                    background:rgba(99,102,241,0.07);border:1px dashed rgba(99,102,241,0.3);
                    color:var(--text-secondary);font-size:0.82rem;text-align:center;">
                    <i class="fas fa-file-invoice" style="color:var(--accent-color)"></i>
                    Invoice not yet generated by admin
                </div>`;
    }
  } catch (_) {
    wrap.innerHTML = "";
  }
}

async function downloadInvoice(orderId, orderNumber) {
  const btn = event?.currentTarget;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> <span>Preparing PDF…</span>';
  }

  try {
    const token =
      localStorage.getItem("jwtToken") || localStorage.getItem("token");
    const res = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DOWNLOAD_INVOICE}/${orderId}/download`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Download failed");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QuickLaundry_${orderNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check"></i> <span>Downloaded!</span>';
      setTimeout(() => {
        if (btn)
          btn.innerHTML =
            '<i class="fas fa-file-pdf"></i> <span>Download Invoice</span>';
        if (btn) btn.disabled = false;
      }, 2500);
    }
  } catch (e) {
    console.error("Invoice download failed:", e);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fas fa-exclamation-circle"></i> <span>Download Failed</span>';
      setTimeout(() => {
        btn.innerHTML =
          '<i class="fas fa-file-pdf"></i> <span>Download Invoice</span>';
      }, 3000);
    }
    alert("Could not download invoice: " + e.message);
  }
}

window.downloadInvoice = downloadInvoice;
