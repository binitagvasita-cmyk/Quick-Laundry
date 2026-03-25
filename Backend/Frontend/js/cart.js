// ============================================
// CART.JS — Full Checkout Flow
// ✅ Order Summary Modal (compact)
// ✅ Payment: Online (QR) / Cash on Delivery
// ✅ QR Code Payment
// ✅ Order Success Modal (compact)
// ✅ Email confirmation via backend
// ============================================

console.log("🛒 Cart page loading...");

const API_BASE_URL = window.location.origin;

// UPI details — change to your actual UPI ID
const UPI_ID = "9173576732@ybl";
const UPI_NAME = "Quick Laundry";

// DOM Elements
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const cartContent = document.getElementById("cartContent");
const cartItemsContainer = document.getElementById("cartItems");
const totalItemsEl = document.getElementById("totalItems");
const subtotalEl = document.getElementById("subtotal");
const grandTotalEl = document.getElementById("grandTotal");
const checkoutBtn = document.getElementById("checkoutBtn");

// State
let cartItems = [];
let pendingCartItems = [];
let pendingCheckoutData = null;

// ============================================
// AUTH
// ============================================
function checkAuth() {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const jwtToken = localStorage.getItem("jwtToken");
  if (!isLoggedIn || !jwtToken) {
    window.location.href = "home-content.html";
    return null;
  }
  return jwtToken;
}

// ============================================
// FETCH CART ITEMS
// ============================================
async function fetchCartItems() {
  const token = checkAuth();
  if (!token) return;

  try {
    loadingState.style.display = "block";
    emptyState.style.display = "none";
    cartContent.style.display = "none";

    const response = await fetch(`${API_BASE_URL}/api/cart`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (result.success) {
      cartItems = result.data.cartItems || [];
      pendingCartItems = cartItems.filter((item) => item.status === "pending");
      renderCart();
    } else {
      throw new Error(result.message || "Failed to load cart");
    }
  } catch (error) {
    console.error("❌ Error fetching cart:", error);
    loadingState.style.display = "none";
    emptyState.style.display = "block";
    showNotification("Failed to load cart items", "error");
  }
}

// ============================================
// RENDER CART
// ============================================
function renderCart() {
  loadingState.style.display = "none";

  if (cartItems.length === 0) {
    emptyState.style.display = "block";
    cartContent.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  cartContent.style.display = "grid";

  cartItemsContainer.innerHTML = cartItems
    .map(
      (item) => `
        <div class="cart-item">
            <div class="item-header">
                <div class="item-info">
                    <h3 class="item-name"><i class="fas fa-tshirt"></i> ${
                      item.serviceName
                    }</h3>
                    <span class="status-badge status-${
                      item.status
                    }">${formatStatus(item.status)}</span>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:1.8rem;font-weight:800;color:var(--accent-color);">₹${
                      item.totalPrice
                    }</div>
                    <div style="font-size:0.85rem;color:var(--text-secondary);">₹${
                      item.unitPrice
                    } × ${item.quantity} ${item.unit}</div>
                </div>
            </div>

            <div class="item-details">
                <div class="detail-item"><i class="fas fa-calendar"></i><span>Pickup: ${formatDate(
                  item.pickupDate
                )}</span></div>
                <div class="detail-item"><i class="fas fa-clock"></i><span>${
                  item.pickupTime
                }</span></div>
                <div class="detail-item"><i class="fas fa-map-marker-alt"></i><span>${truncateText(
                  item.pickupAddress,
                  40
                )}</span></div>
                ${
                  item.specialInstructions
                    ? `
                <div class="detail-item" style="grid-column:1/-1;">
                    <i class="fas fa-comment"></i><span>${item.specialInstructions}</span>
                </div>`
                    : ""
                }
            </div>

            <div style="display:flex;gap:0.75rem;margin-top:1rem;">
                ${
                  item.status === "pending"
                    ? `
                <button class="btn btn-remove" onclick="removeFromCart(${item.cartId})">
                    <i class="fas fa-trash"></i> Remove
                </button>`
                    : `
                <span style="color:var(--text-secondary);font-size:0.9rem;">
                    <i class="fas fa-info-circle"></i> Being processed
                </span>`
                }
            </div>
        </div>
    `
    )
    .join("");

  updateSummary();
}

// ============================================
// UPDATE SUMMARY
// ============================================
function updateSummary() {
  const total = pendingCartItems.reduce(
    (sum, item) => sum + parseFloat(item.totalPrice),
    0
  );

  totalItemsEl.textContent = pendingCartItems.length;
  subtotalEl.textContent = `₹${total.toFixed(2)}`;
  grandTotalEl.textContent = `₹${total.toFixed(2)}`;

  if (checkoutBtn) {
    if (pendingCartItems.length === 0) {
      checkoutBtn.disabled = true;
      checkoutBtn.innerHTML =
        '<i class="fas fa-times-circle"></i> No items to checkout';
    } else {
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML =
        '<i class="fas fa-check-circle"></i> Proceed to Checkout';
    }
  }
}

// ============================================
// REMOVE FROM CART
// ============================================
async function removeFromCart(cartId) {
  if (!confirm("Remove this item from cart?")) return;
  const token = checkAuth();
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/cart/${cartId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const result = await response.json();
    if (result.success) {
      showNotification("Item removed from cart", "success");
      await fetchCartItems();
    } else throw new Error(result.message);
  } catch (error) {
    showNotification("Failed to remove item", "error");
  }
}
window.removeFromCart = removeFromCart;

// ============================================
// PROCEED TO CHECKOUT
// ============================================
async function proceedToCheckout() {
  if (pendingCartItems.length === 0) {
    showNotification("No items to checkout", "info");
    return;
  }
  checkAuth();
  showCheckoutFormModal();
}
window.proceedToCheckout = proceedToCheckout;

// ============================================
// STEP 1: CHECKOUT FORM MODAL
// ============================================
function showCheckoutFormModal() {
  const existing = document.getElementById("checkoutFormModal");
  if (existing) existing.remove();

  const subtotal = pendingCartItems.reduce(
    (sum, i) => sum + parseFloat(i.totalPrice),
    0
  );

  const modal = document.createElement("div");
  modal.id = "checkoutFormModal";
  modal.style.cssText = `position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);
        display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px);`;

  modal.innerHTML = `
    <div style="background:var(--card-bg,#fff);border-radius:16px;max-width:420px;width:100%;
                max-height:88vh;overflow-y:auto;padding:1.5rem;position:relative;
                box-shadow:0 20px 50px rgba(0,0,0,0.3);border:2px solid var(--border-color);">

        <button onclick="document.getElementById('checkoutFormModal').remove();document.body.style.overflow=''"
            style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;
                   font-size:1.3rem;cursor:pointer;color:var(--text-secondary);">
            <i class="fas fa-times"></i>
        </button>

        <div style="text-align:center;margin-bottom:1.25rem;">
            <div style="width:44px;height:44px;background:linear-gradient(135deg,#7c3aed,#a855f7);
                        border-radius:50%;display:flex;align-items:center;justify-content:center;
                        margin:0 auto 0.75rem;font-size:1.1rem;color:#fff;">
                <i class="fas fa-shopping-bag"></i>
            </div>
            <h2 style="color:var(--text-primary);font-size:1.4rem;margin-bottom:0.2rem;">Checkout</h2>
            <p style="color:var(--text-secondary);font-size:0.85rem;">${
              pendingCartItems.length
            } item(s) &nbsp;·&nbsp; ₹${subtotal.toFixed(2)}</p>
        </div>

        <!-- Items mini list -->
        <div style="background:var(--secondary-bg,#f8f9fa);border-radius:10px;padding:0.75rem;margin-bottom:1rem;max-height:140px;overflow-y:auto;">
            ${pendingCartItems
              .map(
                (item) => `
                <div style="display:flex;justify-content:space-between;align-items:center;
                            padding:0.4rem 0;border-bottom:1px solid var(--border-color);">
                    <div>
                        <div style="font-weight:600;color:var(--text-primary);font-size:0.88rem;">
                            <i class="fas fa-tshirt" style="color:var(--accent-color);"></i> ${
                              item.serviceName
                            }
                        </div>
                        <div style="font-size:0.76rem;color:var(--text-secondary);">
                            ${item.quantity} ${
                  item.unit
                } &nbsp;·&nbsp; ${formatDate(item.pickupDate)} &nbsp;·&nbsp; ${
                  item.pickupTime
                }
                        </div>
                    </div>
                    <div style="font-weight:700;color:var(--accent-color);font-size:0.95rem;">₹${
                      item.totalPrice
                    }</div>
                </div>
            `
              )
              .join("")}
        </div>

        <!-- Delivery Type -->
        <div style="margin-bottom:1rem;">
            <label style="display:block;font-weight:600;color:var(--text-primary);margin-bottom:0.5rem;font-size:0.9rem;">
                <i class="fas fa-truck" style="color:var(--accent-color);"></i> Delivery Type *
            </label>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;">
                ${[
                  {
                    val: "standard",
                    label: "Standard",
                    sub: "48 hrs · Free",
                    icon: "fa-clock",
                  },
                  {
                    val: "express",
                    label: "Express",
                    sub: "24 hrs · +₹50",
                    icon: "fa-bolt",
                  },
                  {
                    val: "economy",
                    label: "Economy",
                    sub: "72 hrs · -₹30",
                    icon: "fa-leaf",
                  },
                ]
                  .map(
                    (d, i) => `
                    <label onclick="selectDelivery('${d.val}')" id="dlv_${
                      d.val
                    }"
                           style="display:flex;flex-direction:column;align-items:center;gap:0.3rem;
                                  padding:0.6rem 0.4rem;border:2px solid ${
                                    i === 0
                                      ? "var(--accent-color)"
                                      : "var(--border-color)"
                                  };
                                  border-radius:10px;cursor:pointer;text-align:center;
                                  background:${
                                    i === 0
                                      ? "rgba(124,58,237,0.07)"
                                      : "var(--secondary-bg)"
                                  };transition:all 0.2s;">
                        <input type="radio" name="deliveryType" value="${
                          d.val
                        }" ${i === 0 ? "checked" : ""} style="display:none;">
                        <i class="fas ${d.icon}" style="font-size:1rem;color:${
                      i === 0 ? "var(--accent-color)" : "var(--text-secondary)"
                    };"></i>
                        <span style="font-weight:700;color:var(--text-primary);font-size:0.8rem;">${
                          d.label
                        }</span>
                        <span style="font-size:0.7rem;color:var(--text-secondary);">${
                          d.sub
                        }</span>
                    </label>
                `
                  )
                  .join("")}
            </div>
        </div>

        <!-- Payment Mode -->
        <div style="margin-bottom:1rem;">
            <label style="display:block;font-weight:600;color:var(--text-primary);margin-bottom:0.5rem;font-size:0.9rem;">
                <i class="fas fa-credit-card" style="color:var(--accent-color);"></i> Payment Mode *
            </label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">
                <label id="pay_online" onclick="selectCartPayment('online')"
                       style="display:flex;align-items:center;gap:0.6rem;padding:0.8rem;
                              border:2px solid var(--accent-color);border-radius:10px;cursor:pointer;
                              background:rgba(124,58,237,0.07);transition:all 0.2s;">
                    <input type="radio" name="cartPayment" value="online" checked style="accent-color:var(--accent-color);">
                    <div>
                        <div style="font-weight:700;color:var(--text-primary);font-size:0.85rem;">
                            <i class="fas fa-qrcode" style="color:var(--accent-color);"></i> Online / UPI
                        </div>
                        <div style="font-size:0.72rem;color:var(--text-secondary);">Pay via QR code</div>
                    </div>
                </label>
                <label id="pay_cod" onclick="selectCartPayment('cod')"
                       style="display:flex;align-items:center;gap:0.6rem;padding:0.8rem;
                              border:2px solid var(--border-color);border-radius:10px;cursor:pointer;
                              background:var(--secondary-bg);transition:all 0.2s;">
                    <input type="radio" name="cartPayment" value="cod" style="accent-color:var(--accent-color);">
                    <div>
                        <div style="font-weight:700;color:var(--text-primary);font-size:0.85rem;">
                            <i class="fas fa-money-bill-wave" style="color:#10b981;"></i> Cash on Delivery
                        </div>
                        <div style="font-size:0.72rem;color:var(--text-secondary);">Pay when we arrive</div>
                    </div>
                </label>
            </div>
        </div>

        <!-- Special Notes -->
        <div style="margin-bottom:1.1rem;">
            <label style="display:block;font-weight:600;color:var(--text-primary);margin-bottom:0.5rem;font-size:0.9rem;">
                <i class="fas fa-comment" style="color:var(--accent-color);"></i> Special Instructions (Optional)
            </label>
            <textarea id="checkoutNotes" rows="2" placeholder="Any special requests..."
                style="width:100%;padding:0.65rem;border:2px solid var(--border-color);border-radius:10px;
                       background:var(--primary-bg,#fff);color:var(--text-primary);font-family:inherit;
                       font-size:0.88rem;resize:vertical;"></textarea>
        </div>

        <!-- Price breakdown -->
        <div id="priceBreakdown" style="background:var(--secondary-bg,#f8f9fa);border-radius:10px;
                                        padding:0.75rem 1rem;margin-bottom:1rem;font-size:0.88rem;">
            <div style="display:flex;justify-content:space-between;padding:0.3rem 0;color:var(--text-secondary);">
                <span>Subtotal (${
                  pendingCartItems.length
                } items)</span><span>₹${subtotal.toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:0.3rem 0;color:var(--text-secondary);" id="deliveryChargeRow">
                <span>Delivery Charge</span><span>Free</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:0.4rem 0;
                        border-top:2px solid var(--border-color);margin-top:0.3rem;
                        font-weight:800;color:var(--accent-color);font-size:1rem;" id="totalRow">
                <span>Total</span><span>₹${subtotal.toFixed(2)}</span>
            </div>
        </div>

        <div style="display:flex;gap:0.6rem;">
            <button onclick="document.getElementById('checkoutFormModal').remove();document.body.style.overflow=''"
                style="padding:0.7rem 1rem;background:var(--secondary-bg);color:var(--text-primary);
                       border:2px solid var(--border-color);border-radius:10px;font-weight:600;cursor:pointer;">
                Cancel
            </button>
            <button onclick="goToOrderSummary()"
                style="flex:1;padding:0.7rem;background:linear-gradient(135deg,#7c3aed,#a855f7);
                       color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;
                       font-size:0.95rem;box-shadow:0 4px 12px rgba(124,58,237,0.35);">
                <i class="fas fa-arrow-right"></i> Review Order
            </button>
        </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
      document.body.style.overflow = "";
    }
  });
}

// ============================================
// DELIVERY / PAYMENT SELECTION
// ============================================
window.selectDelivery = (val) => {
  ["standard", "express", "economy"].forEach((v) => {
    const el = document.getElementById(`dlv_${v}`);
    if (!el) return;
    const sel = v === val;
    el.style.border = sel
      ? "2px solid var(--accent-color)"
      : "2px solid var(--border-color)";
    el.style.background = sel ? "rgba(124,58,237,0.07)" : "var(--secondary-bg)";
    el.querySelector("input").checked = sel;
    const icon = el.querySelector("i");
    if (icon)
      icon.style.color = sel ? "var(--accent-color)" : "var(--text-secondary)";
  });
  const sub = pendingCartItems.reduce(
    (s, i) => s + parseFloat(i.totalPrice),
    0
  );
  const charge = val === "express" ? 50 : val === "economy" ? -30 : 0;
  const total = sub + charge;
  const cr = document.getElementById("deliveryChargeRow");
  const tr = document.getElementById("totalRow");
  if (cr)
    cr.innerHTML = `<span>Delivery Charge</span><span>${
      val === "express"
        ? "+₹50"
        : val === "economy"
        ? "-₹30 (discount)"
        : "Free"
    }</span>`;
  if (tr) tr.innerHTML = `<span>Total</span><span>₹${total.toFixed(2)}</span>`;
};

window.selectCartPayment = (mode) => {
  const ol = document.getElementById("pay_online");
  const cl = document.getElementById("pay_cod");
  if (ol) {
    ol.style.border =
      mode === "online"
        ? "2px solid var(--accent-color)"
        : "2px solid var(--border-color)";
    ol.style.background =
      mode === "online" ? "rgba(124,58,237,0.07)" : "var(--secondary-bg)";
    ol.querySelector("input").checked = mode === "online";
  }
  if (cl) {
    cl.style.border =
      mode === "cod" ? "2px solid #10b981" : "2px solid var(--border-color)";
    cl.style.background =
      mode === "cod" ? "rgba(16,185,129,0.07)" : "var(--secondary-bg)";
    cl.querySelector("input").checked = mode === "cod";
  }
};

// ============================================
// STEP 2: ORDER SUMMARY MODAL
// ============================================
window.goToOrderSummary = () => {
  const deliveryType =
    document.querySelector('input[name="deliveryType"]:checked')?.value ||
    "standard";
  const paymentMode =
    document.querySelector('input[name="cartPayment"]:checked')?.value ||
    "online";
  const specialNotes =
    document.getElementById("checkoutNotes")?.value.trim() || "";
  const subtotal = pendingCartItems.reduce(
    (s, i) => s + parseFloat(i.totalPrice),
    0
  );
  const deliveryCharge =
    deliveryType === "express" ? 50 : deliveryType === "economy" ? -30 : 0;
  const totalAmount = subtotal + deliveryCharge;
  const deliveryMap = {
    express: "Express (24 hrs) +₹50",
    standard: "Standard (48 hrs)",
    economy: "Economy (72 hrs) -₹30",
  };

  pendingCheckoutData = {
    deliveryType,
    paymentMode,
    specialNotes,
    subtotal,
    deliveryCharge,
    totalAmount,
  };

  document.getElementById("checkoutFormModal")?.remove();

  const existing = document.getElementById("cartSummaryModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "cartSummaryModal";
  modal.style.cssText = `position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);
        display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px);`;

  const payIcon =
    paymentMode === "online"
      ? '<i class="fas fa-qrcode" style="color:var(--accent-color)"></i> Online / UPI'
      : '<i class="fas fa-money-bill-wave" style="color:#10b981"></i> Cash on Delivery';

  modal.innerHTML = `
    <div style="background:var(--card-bg,#fff);border-radius:16px;max-width:400px;width:100%;
                max-height:88vh;overflow-y:auto;padding:1.5rem;position:relative;
                box-shadow:0 20px 50px rgba(0,0,0,0.3);">
        <button onclick="document.getElementById('cartSummaryModal').remove();document.body.style.overflow=''"
            style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;
                   font-size:1.3rem;cursor:pointer;color:var(--text-secondary);">
            <i class="fas fa-times"></i>
        </button>
        <div style="text-align:center;margin-bottom:1rem;">
            <div style="width:44px;height:44px;background:linear-gradient(135deg,#7c3aed,#a855f7);
                        border-radius:50%;display:flex;align-items:center;justify-content:center;
                        margin:0 auto 0.6rem;font-size:1.1rem;color:#fff;">
                <i class="fas fa-receipt"></i>
            </div>
            <h2 style="color:var(--text-primary);font-size:1.3rem;margin-bottom:0.2rem;">Order Summary</h2>
            <p style="color:var(--text-secondary);font-size:0.82rem;">Review before confirming</p>
        </div>

        <div style="background:var(--secondary-bg,#f8f9fa);border-radius:10px;
                    padding:0.75rem;margin-bottom:0.9rem;max-height:160px;overflow-y:auto;">
            ${pendingCartItems
              .map(
                (item) => `
                <div style="display:flex;justify-content:space-between;padding:0.35rem 0;
                            border-bottom:1px solid var(--border-color);">
                    <div>
                        <div style="font-weight:600;color:var(--text-primary);font-size:0.85rem;">
                            <i class="fas fa-tshirt" style="color:var(--accent-color);font-size:0.75rem;"></i> ${
                              item.serviceName
                            }
                        </div>
                        <div style="font-size:0.74rem;color:var(--text-secondary);">
                            ${item.quantity} ${
                  item.unit
                } &nbsp;·&nbsp; ${formatDate(item.pickupDate)}
                        </div>
                    </div>
                    <div style="font-weight:700;color:var(--accent-color);font-size:0.9rem;">₹${
                      item.totalPrice
                    }</div>
                </div>
            `
              )
              .join("")}
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:0.9rem;font-size:0.85rem;">
            <tr style="border-bottom:1px solid var(--border-color);">
                <td style="padding:0.45rem 0.4rem;color:var(--text-secondary);">Delivery</td>
                <td style="padding:0.45rem 0.4rem;text-align:right;color:var(--text-primary);font-weight:600;">${
                  deliveryMap[deliveryType]
                }</td>
            </tr>
            <tr style="border-bottom:1px solid var(--border-color);">
                <td style="padding:0.45rem 0.4rem;color:var(--text-secondary);">Payment</td>
                <td style="padding:0.45rem 0.4rem;text-align:right;font-weight:600;">${payIcon}</td>
            </tr>
            ${
              specialNotes
                ? `
            <tr style="border-bottom:1px solid var(--border-color);">
                <td style="padding:0.45rem 0.4rem;color:var(--text-secondary);">Notes</td>
                <td style="padding:0.45rem 0.4rem;text-align:right;color:var(--text-primary);font-weight:600;">${specialNotes}</td>
            </tr>`
                : ""
            }
            <tr style="border-top:2px solid var(--border-color);">
                <td style="padding:0.6rem 0.4rem;font-weight:800;color:var(--text-primary);font-size:1rem;">Total</td>
                <td style="padding:0.6rem 0.4rem;text-align:right;font-weight:800;color:var(--accent-color);font-size:1.3rem;">₹${totalAmount.toFixed(
                  2
                )}</td>
            </tr>
        </table>

        <div style="display:flex;gap:0.6rem;">
            <button onclick="document.getElementById('cartSummaryModal').remove();document.body.style.overflow='';showCheckoutFormModal()"
                style="flex:1;padding:0.7rem;background:var(--secondary-bg);color:var(--accent-color);
                       border:2px solid var(--accent-color);border-radius:10px;font-weight:700;cursor:pointer;font-size:0.88rem;">
                <i class="fas fa-arrow-left"></i> Edit
            </button>
            <button onclick="confirmCartOrder()"
                style="flex:2;padding:0.7rem;background:linear-gradient(135deg,#7c3aed,#a855f7);
                       color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;
                       font-size:0.88rem;box-shadow:0 4px 12px rgba(124,58,237,0.35);">
                <i class="fas fa-bolt"></i> ${
                  paymentMode === "online" ? "Pay Online" : "Place Order (COD)"
                }
            </button>
        </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
      document.body.style.overflow = "";
    }
  });
};

// ============================================
// STEP 3: CONFIRM
// ============================================
window.confirmCartOrder = () => {
  const d = pendingCheckoutData;
  if (!d) return;
  document.getElementById("cartSummaryModal")?.remove();
  document.body.style.overflow = "";
  if (d.paymentMode === "online") {
    showCartQRModal(d.totalAmount);
  } else {
    submitCartOrder("cod", null);
  }
};

// ============================================
// QR PAYMENT MODAL
// ============================================
function showCartQRModal(amount) {
  const existing = document.getElementById("cartQRModal");
  if (existing) existing.remove();

  const upiNote = `CartOrder-QL-${Date.now()}`;
  const upiLink = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(
    UPI_NAME
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(upiNote)}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    upiLink
  )}`;

  const modal = document.createElement("div");
  modal.id = "cartQRModal";
  modal.style.cssText = `position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.7);
        display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px);`;

  modal.innerHTML = `
    <div style="background:var(--card-bg,#fff);border-radius:16px;max-width:320px;width:100%;
                position:relative;box-shadow:0 20px 50px rgba(0,0,0,0.3);text-align:center;overflow:hidden">
        <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:1rem 1.25rem;position:relative">
            <div style="display:flex;align-items:center;gap:0.5rem;justify-content:center;color:#fff">
                <i class="fas fa-qrcode" style="font-size:1.1rem"></i>
                <div>
                    <div style="font-weight:800;font-size:1rem">Scan & Pay</div>
                    <div style="opacity:0.85;font-size:0.75rem">Complete payment to confirm</div>
                </div>
            </div>
            <button onclick="cancelCartQR()" style="position:absolute;top:0.6rem;right:0.6rem;
                background:rgba(255,255,255,0.2);border:none;color:#fff;width:26px;height:26px;
                border-radius:50%;cursor:pointer;font-size:0.85rem;line-height:26px">✕</button>
        </div>
        <div style="padding:1rem 1.25rem">
            <div style="color:var(--text-secondary);font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Amount to Pay</div>
            <div style="font-size:2rem;font-weight:800;color:var(--accent-color);margin-bottom:0.75rem">₹${amount.toFixed(
              2
            )}</div>
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
            <div style="background:var(--secondary-bg,#f8f9fa);border-radius:10px;padding:0.6rem 0.9rem;
                        margin-bottom:0.75rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem">
                <div style="text-align:left">
                    <div style="font-size:0.68rem;color:var(--text-secondary)">UPI ID</div>
                    <div style="font-weight:700;color:var(--text-primary);font-size:0.85rem">${UPI_ID}</div>
                </div>
                <button onclick="copyCartUPI()" id="cartCopyUpiBtn"
                    style="padding:0.35rem 0.75rem;background:var(--accent-color);color:#fff;border:none;
                           border-radius:7px;cursor:pointer;font-size:0.78rem;font-weight:600;white-space:nowrap">
                    <i class="fas fa-copy"></i> Copy
                </button>
            </div>
            <div style="text-align:left;margin-bottom:0.75rem">
                ${[
                  `Open your UPI app`,
                  `Scan the QR code above`,
                  `Pay ₹${amount.toFixed(2)} & click below`,
                ]
                  .map(
                    (s, i) => `
                    <div style="display:flex;align-items:center;gap:0.5rem;padding:0.25rem 0">
                        <div style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);
                                    color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0">${
                                      i + 1
                                    }</div>
                        <span style="color:var(--text-secondary);font-size:0.8rem">${s}</span>
                    </div>`
                  )
                  .join("")}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem">
                <button onclick="cancelCartQR()"
                    style="padding:0.65rem;background:var(--secondary-bg);color:var(--text-primary);
                           border:2px solid var(--border-color);border-radius:10px;font-weight:600;cursor:pointer;font-size:0.85rem">
                    Cancel
                </button>
                <button onclick="confirmCartQRPaid()" id="cartQRDoneBtn"
                    style="padding:0.65rem;background:linear-gradient(135deg,#10b981,#059669);color:#fff;
                           border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:0.85rem;
                           box-shadow:0 3px 10px rgba(16,185,129,0.35)">
                    <i class="fas fa-check"></i> I've Paid
                </button>
            </div>
        </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";
}

window.copyCartUPI = () => {
  navigator.clipboard
    .writeText(UPI_ID)
    .then(() => {
      const btn = document.getElementById("cartCopyUpiBtn");
      if (btn) {
        btn.innerHTML = "<i class='fas fa-check'></i> Copied!";
        btn.style.background = "#10b981";
        setTimeout(() => {
          btn.innerHTML = "<i class='fas fa-copy'></i> Copy";
          btn.style.background = "var(--accent-color)";
        }, 2000);
      }
    })
    .catch(() => showNotification("UPI ID: " + UPI_ID, "info"));
};

window.cancelCartQR = () => {
  document.getElementById("cartQRModal")?.remove();
  document.body.style.overflow = "";
  showNotification("Payment cancelled. Order not placed.", "info");
};

window.confirmCartQRPaid = async () => {
  const btn = document.getElementById("cartQRDoneBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming...';
  }
  document.getElementById("cartQRModal")?.remove();
  document.body.style.overflow = "";
  await submitCartOrder("online", "pending_verification");
};

// ============================================
// SUBMIT ORDER
// ============================================
async function submitCartOrder(paymentMode, paymentStatus) {
  const token = checkAuth();
  if (!token) return;
  const d = pendingCheckoutData;
  if (!d) return;

  try {
    showNotification("Placing your order...", "info");

    const response = await fetch(`${API_BASE_URL}/api/cart/checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentMethod: paymentMode,
        deliveryType: d.deliveryType,
        specialInstructions: d.specialNotes,
      }),
    });

    const result = await response.json();

    if (result.success) {
      pendingCheckoutData = null;
      showCartSuccessModal(result.data, paymentMode);
      await fetchCartItems();
    } else {
      throw new Error(result.message || "Checkout failed");
    }
  } catch (error) {
    console.error("❌ Cart checkout error:", error);
    showNotification(error.message || "Failed to place order", "error");
  }
}

// ============================================
// SUCCESS MODAL
// ============================================
function showCartSuccessModal(orderData, paymentMode) {
  const existing = document.getElementById("cartSuccessModal");
  if (existing) existing.remove();

  const payLabel =
    paymentMode === "online"
      ? "Online (Pending Verification)"
      : "Cash on Delivery";

  const modal = document.createElement("div");
  modal.id = "cartSuccessModal";
  modal.style.cssText = `position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,0.7);
        display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px);`;

  modal.innerHTML = `
    <div style="background:var(--card-bg,#fff);border-radius:16px;max-width:360px;width:100%;
                padding:1.75rem;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.3)">
        <div style="width:60px;height:60px;background:linear-gradient(135deg,#10b981,#059669);
                    border-radius:50%;display:flex;align-items:center;justify-content:center;
                    margin:0 auto 1rem;font-size:1.5rem;color:#fff;
                    box-shadow:0 6px 20px rgba(16,185,129,0.4);animation:cartPopIn 0.5s ease">
            <i class="fas fa-check"></i>
        </div>
        <h2 style="color:var(--text-primary);font-size:1.4rem;margin-bottom:0.4rem">Order Placed! 🎉</h2>
        <p style="color:var(--text-secondary);margin-bottom:1rem;font-size:0.88rem">
            Your cart order has been confirmed.
        </p>
        <div style="background:var(--secondary-bg,#f8f9fa);border-radius:12px;padding:1rem;margin-bottom:1rem;text-align:left">
            ${cartSuccessRow(
              "fas fa-hashtag",
              "Order #",
              orderData.orderNumber
            )}
            ${cartSuccessRow(
              "fas fa-box",
              "Items",
              `${orderData.itemsCount} service(s)`
            )}
            ${cartSuccessRow(
              "fas fa-rupee-sign",
              "Total",
              `₹${orderData.totalAmount}`
            )}
            ${cartSuccessRow("fas fa-credit-card", "Payment", payLabel)}
        </div>
        <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);
                    border-radius:8px;padding:0.6rem;margin-bottom:1rem;font-size:0.82rem">
            <i class="fas fa-envelope" style="color:#10b981"></i>
            <span style="color:var(--text-secondary);margin-left:0.4rem">Confirmation email sent to your inbox.</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem">
            <button onclick="document.getElementById('cartSuccessModal').remove();document.body.style.overflow=''"
                style="padding:0.7rem;background:var(--secondary-bg);color:var(--text-primary);
                       border:2px solid var(--border-color);border-radius:10px;font-weight:600;cursor:pointer;
                       display:flex;align-items:center;justify-content:center;gap:0.4rem;font-size:0.85rem">
                <i class="fas fa-shopping-bag"></i> Shop More
            </button>
            <button onclick="window.location.href='orders.html'"
                style="padding:0.7rem;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;
                       border:none;border-radius:10px;font-weight:700;cursor:pointer;
                       display:flex;align-items:center;justify-content:center;gap:0.4rem;font-size:0.85rem;
                       box-shadow:0 4px 12px rgba(124,58,237,0.35)">
                <i class="fas fa-list-alt"></i> My Orders
            </button>
        </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  if (!document.getElementById("cartSuccessAnim")) {
    const s = document.createElement("style");
    s.id = "cartSuccessAnim";
    s.textContent = `@keyframes cartPopIn{0%{transform:scale(0.3);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}`;
    document.head.appendChild(s);
  }
}

function cartSuccessRow(icon, label, value) {
  return `<div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;border-bottom:1px solid var(--border-color);">
        <i class="${icon}" style="color:var(--accent-color);width:14px;flex-shrink:0;font-size:0.85rem;"></i>
        <div style="flex:1;">${
          label
            ? `<span style="color:var(--text-secondary);font-size:0.8rem;">${label} </span>`
            : ""
        }<span style="color:var(--text-primary);font-weight:600;font-size:0.88rem;">${value}</span></div>
    </div>`;
}

// ============================================
// UTILITY
// ============================================
function formatStatus(status) {
  return (
    {
      pending: "Pending",
      confirmed: "Confirmed",
      processing: "Processing",
      completed: "Completed",
      cancelled: "Cancelled",
    }[status] || status
  );
}
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function truncateText(text, maxLength) {
  return text.length <= maxLength ? text : text.substring(0, maxLength) + "...";
}
function showNotification(message, type = "info") {
  const colors = {
    success: "linear-gradient(135deg,#10b981,#059669)",
    error: "linear-gradient(135deg,#ef4444,#dc2626)",
    info: "linear-gradient(135deg,#3b82f6,#2563eb)",
  };
  const icons = {
    success: "fa-check-circle",
    error: "fa-times-circle",
    info: "fa-info-circle",
  };
  const n = document.createElement("div");
  n.style.cssText = `position:fixed;top:100px;right:20px;background:${colors[type]};color:#fff;padding:0.9rem 1.25rem;border-radius:12px;box-shadow:0 8px 20px rgba(0,0,0,0.3);z-index:10010;font-weight:600;display:flex;align-items:center;gap:0.6rem;animation:slideInRight 0.3s ease;font-size:0.9rem;`;
  n.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
  document.body.appendChild(n);
  setTimeout(() => {
    n.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => n.remove(), 300);
  }, 3000);
}

// ============================================
// INITIALIZE
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("🎯 Initializing cart page...");
  fetchCartItems();
});

const style = document.createElement("style");
style.textContent = `
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes fadeOut{from{opacity:1}to{opacity:0}}
    @keyframes slideInRight{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}
    @keyframes slideOutRight{from{transform:translateX(0);opacity:1}to{transform:translateX(400px);opacity:0}}
`;
document.head.appendChild(style);
console.log("✅ Cart page ready!");
