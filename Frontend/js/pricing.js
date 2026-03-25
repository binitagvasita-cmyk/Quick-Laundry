// ============================================
// PRICING PAGE JAVASCRIPT - MENU STYLE
// Quick Laundry — View Toggle: Vertical & Horizontal
// ============================================

console.log("💰 Pricing Menu JS Loaded!");

// ============================================
// API CONFIG
// ============================================
const API_CONFIG = {
  BASE_URL: window.location.origin,
  ENDPOINTS: {
    VALIDATE_TOKEN: "/api/auth/validate-token",
  },
};

// ============================================
// PRICING DATA
// ============================================
const pricingData = [
  {
    id: 1,
    name: "Iron Only",
    category: "ironing",
    description:
      "Professional ironing service for your already washed clothes. We ensure crisp, clean folds every time.",
    price: 5,
    unit: "per piece",
    icon: "fa-iron",
    image:
      "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&h=250&fit=crop",
    features: [
      "Steam Iron",
      "Professional Finish",
      "24hr Delivery",
      "Hanger Included",
    ],
  },
  {
    id: 2,
    name: "Wash & Iron",
    category: "washing",
    description:
      "Complete wash and iron service with premium detergents. Your clothes come back fresh and perfectly pressed.",
    price: 15,
    unit: "per piece",
    icon: "fa-soap",
    image:
      "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=400&h=250&fit=crop",
    features: [
      "Premium Detergent",
      "Fabric Softener",
      "Steam Iron",
      "48hr Service",
    ],
  },
  {
    id: 3,
    name: "Roll Press",
    category: "ironing",
    description:
      "Traditional roll press for curtains and bedsheets. Perfect for large flat items needing a smooth finish.",
    price: 12,
    unit: "per piece",
    icon: "fa-scroll",
    image:
      "https://images.unsplash.com/photo-1604335398980-ededbd8d37d0?w=400&h=250&fit=crop",
    features: [
      "Large Items",
      "Traditional Method",
      "Smooth Finish",
      "24hr Service",
    ],
  },
  {
    id: 4,
    name: "Steam Press",
    category: "premium",
    description:
      "Professional steam pressing for delicate fabrics. Gentle on your clothes while removing every wrinkle.",
    price: 20,
    unit: "per piece",
    icon: "fa-wind",
    image:
      "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=400&h=250&fit=crop",
    features: ["Delicate Fabrics", "Steam Technology", "No Marks", "Same Day"],
  },
  {
    id: 5,
    name: "Dry Clean",
    category: "dry-clean",
    description:
      "Specialized dry cleaning for suits and formal wear. Expert handling with chemical-free processes.",
    price: 50,
    unit: "per piece",
    icon: "fa-vest",
    image:
      "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&h=250&fit=crop",
    features: [
      "Chemical-Free",
      "Stain Removal",
      "Protective Cover",
      "3-5 Days",
    ],
  },
  {
    id: 6,
    name: "Express Wash",
    category: "washing",
    description:
      "Quick wash and dry service ready in just 12 hours. When you need your clothes fast without compromise.",
    price: 25,
    unit: "per piece",
    icon: "fa-bolt",
    image:
      "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400&h=250&fit=crop",
    features: ["12hr Service", "Premium Care", "Quick Dry", "Priority"],
  },
  {
    id: 7,
    name: "Bedding Service",
    category: "washing",
    description:
      "Specialized service for bedsheets, pillow covers and comforters. Deep cleaned, sanitized and neatly folded.",
    price: 100,
    unit: "per set",
    icon: "fa-bed",
    image:
      "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=250&fit=crop",
    features: ["Large Capacity", "Sanitization", "Softener", "48hr Service"],
  },
  {
    id: 8,
    name: "Curtain Cleaning",
    category: "premium",
    description:
      "Professional curtain cleaning with careful handling. Remove dust, allergens and odors for a fresh home.",
    price: 80,
    unit: "per panel",
    icon: "fa-bars-staggered",
    image:
      "https://images.unsplash.com/photo-1574438008389-1e480e831b4c?w=400&h=250&fit=crop",
    features: ["Dust Removal", "Roll Press", "Careful Handle", "5-7 Days"],
  },
  {
    id: 9,
    name: "Shoe Cleaning",
    category: "premium",
    description:
      "Professional shoe cleaning and polishing service. Restore the shine and freshness of your footwear.",
    price: 40,
    unit: "per pair",
    icon: "fa-shoe-prints",
    image:
      "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=400&h=250&fit=crop",
    features: [
      "Deep Cleaning",
      "Polish & Shine",
      "Odor Removal",
      "24hr Service",
    ],
  },
  {
    id: 10,
    name: "Leather Care",
    category: "premium",
    description:
      "Specialized care for leather jackets and accessories. Conditioning, cleaning and color restoration.",
    price: 150,
    unit: "per item",
    icon: "fa-briefcase",
    image:
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=250&fit=crop",
    features: ["Conditioning", "Stain Removal", "Color Restore", "7-10 Days"],
  },
  {
    id: 11,
    name: "Stain Removal",
    category: "premium",
    description:
      "Expert stain removal for stubborn stains. Oil, ink, food — we treat all types with color-safe solutions.",
    price: 30,
    unit: "per item",
    icon: "fa-droplet",
    image:
      "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&h=250&fit=crop",
    features: [
      "All Stain Types",
      "Expert Treatment",
      "Color Safe",
      "48hr Service",
    ],
  },
  {
    id: 12,
    name: "Alteration Service",
    category: "premium",
    description:
      "Professional alteration and repair service. Hemming, stitching, buttons — all garments welcome.",
    price: 60,
    unit: "per item",
    icon: "fa-scissors",
    image:
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=400&h=250&fit=crop",
    features: ["Expert Tailoring", "All Garments", "Perfect Fit", "3-5 Days"],
  },
];

// ============================================
// CATEGORY CONFIG
// ============================================
const categoryConfig = {
  washing: { icon: "fa-soap", label: "Washing Services" },
  ironing: { icon: "fa-iron", label: "Ironing Services" },
  "dry-clean": { icon: "fa-vest", label: "Dry Clean Services" },
  premium: { icon: "fa-star", label: "Premium Services" },
};

// ============================================
// STATE
// ============================================
let currentCategory = "all";
let searchQuery = "";
let filteredData = [];
let currentView = "vertical"; // 'vertical' | 'horizontal'

// ============================================
// VIEW TOGGLE
// ============================================
function setView(view) {
  currentView = view;

  document
    .getElementById("verticalBtn")
    .classList.toggle("active", view === "vertical");
  document
    .getElementById("horizontalBtn")
    .classList.toggle("active", view === "horizontal");

  // Re-render with new view
  renderMenu();

  // Persist preference
  try {
    localStorage.setItem("pricingView", view);
  } catch (e) {}
}

// ============================================
// AUTH (kept for header/sidebar)
// ============================================
async function validateAndSetAuthStatus() {
  const token = localStorage.getItem("jwtToken");
  if (!token) return false;
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VALIDATE_TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const result = await response.json();
    if (result.success && response.ok) {
      if (result.data.user) {
        localStorage.setItem("userName", result.data.user.full_name || "User");
        localStorage.setItem("userEmail", result.data.user.email || "");
      }
      return true;
    } else {
      clearAuthData();
      return false;
    }
  } catch (e) {
    clearAuthData();
    return false;
  }
}

function clearAuthData() {
  localStorage.removeItem("jwtToken");
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("userName");
  localStorage.removeItem("userEmail");
  window.dispatchEvent(
    new CustomEvent("authStateChanged", { detail: { isLoggedIn: false } })
  );
}

// ============================================
// FILTER & SEARCH
// ============================================
function filterData() {
  filteredData = pricingData.filter((s) => {
    const matchCat =
      currentCategory === "all" || s.category === currentCategory;
    const matchSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });
  renderMenu();
  document.getElementById("resultCount").textContent = filteredData.length;
}

function clearFilters() {
  currentCategory = "all";
  searchQuery = "";
  document.getElementById("searchInput").value = "";
  document
    .querySelectorAll(".category-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.category === "all"));
  filterData();
}

// ============================================
// RENDER MENU
// ============================================
function renderMenu() {
  const menuContent = document.getElementById("menuContent");
  const emptyState = document.getElementById("emptyState");
  const loadingState = document.getElementById("loadingState");
  const ctaStrip = document.getElementById("ctaStrip");

  loadingState.style.display = "none";

  if (filteredData.length === 0) {
    menuContent.style.display = "none";
    emptyState.style.display = "block";
    ctaStrip.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  menuContent.style.display = "block";
  ctaStrip.style.display = "block";

  let html = "";

  // Group by category when showing all without search
  const useGroups = currentCategory === "all" && !searchQuery;

  if (useGroups) {
    const cats = ["washing", "ironing", "dry-clean", "premium"];
    cats.forEach((cat) => {
      const items = filteredData.filter((s) => s.category === cat);
      if (!items.length) return;
      const cfg = categoryConfig[cat];
      html += `
        <div class="menu-section">
          <div class="menu-section-header">
            <div class="menu-section-icon"><i class="fas ${cfg.icon}"></i></div>
            <div class="menu-section-title">${cfg.label}</div>
            <div class="menu-section-count">${items.length} service${
        items.length > 1 ? "s" : ""
      }</div>
          </div>
          ${
            currentView === "vertical"
              ? `<div class="menu-items-list">${items
                  .map(renderListItem)
                  .join("")}</div>`
              : `<div class="menu-items-grid">${items
                  .map(renderGridItem)
                  .join("")}</div>`
          }
        </div>
      `;
    });
  } else {
    // Flat list (filtered / searched)
    html =
      currentView === "vertical"
        ? `<div class="menu-section"><div class="menu-items-list">${filteredData
            .map(renderListItem)
            .join("")}</div></div>`
        : `<div class="menu-section"><div class="menu-items-grid">${filteredData
            .map(renderGridItem)
            .join("")}</div></div>`;
  }

  menuContent.innerHTML = html;
}

// ============================================
// RENDER — VERTICAL LIST ITEM
// ============================================
function renderListItem(service) {
  const pills = service.features
    .map(
      (f) => `
    <span class="feature-pill"><i class="fas fa-check"></i> ${f}</span>
  `
    )
    .join("");

  return `
    <div class="menu-item">
      <div class="item-image-wrap">
        <img src="${service.image}" alt="${service.name}" loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
        <div class="item-image-fallback"><i class="fas ${
          service.icon
        }"></i></div>
      </div>
      <div class="item-body">
        <div class="item-name-row">
          <span class="item-name">${service.name}</span>
          <span class="item-category-badge">${service.category.replace(
            "-",
            " "
          )}</span>
        </div>
        <div class="item-desc">${service.description}</div>
        <div class="item-features">${pills}</div>
      </div>
      <div class="item-price-col">
        <div class="item-starting">Starting at</div>
        <div class="item-price">₹${service.price}</div>
        <div class="item-unit">${service.unit}</div>
      </div>
    </div>
  `;
}

// ============================================
// RENDER — HORIZONTAL GRID ITEM (Card)
// ============================================
function renderGridItem(service) {
  const pills = service.features
    .map(
      (f) => `
    <span class="feature-pill"><i class="fas fa-check"></i> ${f}</span>
  `
    )
    .join("");

  return `
    <div class="grid-item">
      <div class="grid-img-wrap">
        <img class="grid-img" src="${service.image}" alt="${
    service.name
  }" loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
        <div class="grid-img-fallback"><i class="fas ${service.icon}"></i></div>
        <span class="grid-badge-overlay">${service.category.replace(
          "-",
          " "
        )}</span>
      </div>
      <div class="grid-body">
        <div class="grid-name">${service.name}</div>
        <div class="grid-desc">${service.description}</div>
        <div class="grid-features">${pills}</div>
      </div>
      <div class="grid-footer">
        <span class="grid-starting">From</span>
        <span class="grid-price">₹${service.price}</span>
        <span class="grid-unit">${service.unit}</span>
      </div>
    </div>
  `;
}

// ============================================
// NOTIFICATION
// ============================================
function showNotification(message, type = "info") {
  const n = document.createElement("div");
  n.className = `notification notification-${type}`;
  const icons = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    warning: "fa-exclamation-triangle",
    info: "fa-info-circle",
  };
  n.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
  document.body.appendChild(n);
  setTimeout(() => n.classList.add("show"), 100);
  setTimeout(() => {
    n.classList.remove("show");
    setTimeout(() => n.remove(), 300);
  }, 3000);
}

// ============================================
// INIT
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("📄 Pricing menu loaded");

  // Restore saved view preference
  try {
    const savedView = localStorage.getItem("pricingView");
    if (savedView === "horizontal") {
      currentView = "horizontal";
      document.getElementById("verticalBtn").classList.remove("active");
      document.getElementById("horizontalBtn").classList.add("active");
    }
  } catch (e) {}

  // View toggle buttons
  document
    .getElementById("verticalBtn")
    .addEventListener("click", () => setView("vertical"));
  document
    .getElementById("horizontalBtn")
    .addEventListener("click", () => setView("horizontal"));

  // Category filter
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".category-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.dataset.category;
      filterData();
    });
  });

  // Search
  document.getElementById("searchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    filterData();
  });

  // Clear filters
  document
    .getElementById("clearFilters")
    .addEventListener("click", clearFilters);

  // Validate auth in background
  validateAndSetAuthStatus();

  // Initial render
  filterData();

  setTimeout(() => {
    document.getElementById("loadingState").style.display = "none";
  }, 400);
});

console.log("✅ Pricing menu initialized!");
