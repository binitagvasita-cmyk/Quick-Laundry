// ============================================
// SIDEBAR JAVASCRIPT - STANDALONE (FIXED)
// ============================================

console.log("🎨 Sidebar JavaScript Loaded!");

// ============================================
// WAIT FOR DOM TO BE READY
// ============================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSidebar);
} else {
  initSidebar();
}

function initSidebar() {
  console.log("🚀 Initializing sidebar...");

  // ============================================
  // GET DOM ELEMENTS
  // ============================================

  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebarClose = document.getElementById("sidebarClose");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const mainContent = document.querySelector(".main-content");
  const sidebarNavGuest = document.getElementById("sidebarNavGuest");
  const sidebarNavUser = document.getElementById("sidebarNavUser");
  const sidebarUserInfo = document.getElementById("sidebarUserInfo");
  const sidebarUserName = document.getElementById("sidebarUserName");
  const sidebarUserEmail = document.getElementById("sidebarUserEmail");
  const sidebarLogout = document.getElementById("sidebarLogout");
  const sidebarLoginBtn = document.getElementById("sidebarLoginBtn");

  let isSidebarOpen = false;

  // Safe storage wrapper
  const storage = {
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

  // ============================================
  // SIDEBAR TOGGLE FUNCTIONS
  // ============================================

  function openSidebar() {
    if (!sidebar || !sidebarOverlay) return;

    sidebar.classList.add("active");
    sidebarOverlay.classList.add("active");
    isSidebarOpen = true;

    if (window.innerWidth >= 1200 && mainContent) {
      mainContent.classList.add("sidebar-open");
    }

    if (window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    }

    console.log("✅ Sidebar opened");
  }

  function closeSidebar() {
    if (!sidebar || !sidebarOverlay) return;

    sidebar.classList.remove("active");
    sidebarOverlay.classList.remove("active");
    isSidebarOpen = false;

    if (mainContent) {
      mainContent.classList.remove("sidebar-open");
    }

    document.body.style.overflow = "";

    console.log("✅ Sidebar closed");
  }

  function toggleSidebar() {
    if (isSidebarOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", toggleSidebar);
  }

  if (sidebarClose) {
    sidebarClose.addEventListener("click", closeSidebar);
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeSidebar);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isSidebarOpen) {
      closeSidebar();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1200 && isSidebarOpen) {
      if (sidebarOverlay) sidebarOverlay.classList.remove("active");
    } else if (window.innerWidth < 1200 && isSidebarOpen) {
      if (sidebarOverlay) sidebarOverlay.classList.add("active");
    }
  });

  // ============================================
  // SIDEBAR NAVIGATION ACTIVE STATE
  // ============================================

  const sidebarLinks = document.querySelectorAll(".sidebar-link");

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      if (this.id === "sidebarLogout") return;

      const parentNav = this.closest(".sidebar-nav");
      if (parentNav) {
        const navLinks = parentNav.querySelectorAll(".sidebar-link");
        navLinks.forEach((l) => l.classList.remove("active"));
      }

      this.classList.add("active");

      if (window.innerWidth < 1200) {
        setTimeout(() => closeSidebar(), 300);
      }

      const href = this.getAttribute("href");
      if (
        href &&
        href.startsWith("#") &&
        href !== "#logout" &&
        href !== "#login"
      ) {
        e.preventDefault();

        const targetId = href.substring(1);
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
          if (window.innerWidth < 1200) closeSidebar();

          setTimeout(
            () => {
              targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
            },
            window.innerWidth < 1200 ? 300 : 0
          );
        }
      }
    });
  });

  // ============================================
  // AUTHENTICATION STATE MANAGEMENT
  // ============================================

  function checkSidebarAuthState() {
    const isLoggedIn = storage.getItem("isLoggedIn") === "true";
    const userName = storage.getItem("userName") || "Guest User";
    const userEmail = storage.getItem("userEmail") || "guest@example.com";

    console.log("🔐 Sidebar auth state check:", { isLoggedIn, userName });

    if (isLoggedIn) {
      if (sidebarNavGuest) sidebarNavGuest.style.display = "none";
      if (sidebarNavUser)  sidebarNavUser.style.display  = "block";
      if (sidebarUserInfo) sidebarUserInfo.style.display = "flex";
      if (sidebarUserName)  sidebarUserName.textContent  = userName;
      if (sidebarUserEmail) sidebarUserEmail.textContent = userEmail;
      console.log("✅ Sidebar: User menu shown");
    } else {
      if (sidebarNavGuest) sidebarNavGuest.style.display = "block";
      if (sidebarNavUser)  sidebarNavUser.style.display  = "none";
      if (sidebarUserInfo) sidebarUserInfo.style.display = "none";
      console.log("✅ Sidebar: Guest menu shown");
    }
  }

  checkSidebarAuthState();

  // ============================================
  // SIDEBAR LOGIN BUTTON
  // ============================================

  if (sidebarLoginBtn) {
    sidebarLoginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("🔐 Sidebar login button clicked");

      closeSidebar();

      setTimeout(() => {
        if (typeof openAuthModal === "function") {
          openAuthModal("login");
        } else {
          setTimeout(() => {
            if (typeof openAuthModal === "function") {
              openAuthModal("login");
            } else {
              showSidebarNotification("Authentication system is loading. Please try again.", "info");
            }
          }, 100);
        }
      }, 300);
    });
  }

  // ============================================
  // SIDEBAR LOGOUT BUTTON
  // ============================================

  if (sidebarLogout) {
    sidebarLogout.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("🔓 Logout button clicked");

      storage.removeItem("isLoggedIn");
      storage.removeItem("userName");
      storage.removeItem("userEmail");
      storage.removeItem("jwtToken");

      checkSidebarAuthState();

      if (typeof checkAuthState === "function") {
        checkAuthState();
      }

      window.dispatchEvent(new CustomEvent("authStateChanged"));

      closeSidebar();
      showSidebarNotification("Logged out successfully!", "success");

      console.log("✅ User logged out successfully");
    });
  }

  // ============================================
  // ORDER BADGE UPDATE
  // ============================================

  function updateOrderBadge(count) {
    const orderBadge = document.querySelector(".sidebar-badge");
    if (orderBadge) {
      orderBadge.textContent = count;
      orderBadge.style.display = count === 0 ? "none" : "flex";
    }
  }

  function loadOrderCount() {
    const orderCount = parseInt(storage.getItem("orderCount")) || 3;
    updateOrderBadge(orderCount);
  }

  loadOrderCount();

  // ============================================
  // NOTIFICATION SYSTEM
  // ============================================

  function showSidebarNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.innerHTML = `
      <i class="fas fa-${
        type === "success" ? "check-circle" :
        type === "error"   ? "exclamation-circle" : "info-circle"
      }"></i>
      <span>${message}</span>
    `;

    notification.style.cssText = `
      position:fixed;top:100px;right:20px;
      background:${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"};
      color:white;padding:1rem 1.5rem;border-radius:12px;
      box-shadow:0 10px 30px rgba(0,0,0,0.2);
      display:flex;align-items:center;gap:10px;
      font-weight:600;z-index:10001;
      animation:slideInRight 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  if (!document.getElementById("sidebar-notification-styles")) {
    const style = document.createElement("style");
    style.id = "sidebar-notification-styles";
    style.textContent = `
      @keyframes slideInRight  { from{transform:translateX(400px);opacity:0} to{transform:translateX(0);opacity:1} }
      @keyframes slideOutRight { from{transform:translateX(0);opacity:1}    to{transform:translateX(400px);opacity:0} }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // DYNAMIC LINK HANDLERS — FIXED ✅
  // ============================================

  // ✅ FIX: "Book Laundry" → services.html
  // Sirf logged-out users ko rokna, logged-in pe normal redirect
  const bookLaundryLink = document.querySelector('.sidebar-link[data-section="book"]');
  if (bookLaundryLink) {
    bookLaundryLink.addEventListener("click", (e) => {
      const isLoggedIn = storage.getItem("isLoggedIn") === "true";
      if (!isLoggedIn) {
        e.preventDefault(); // ✅ Sirf tab rokna jab logged out ho
        showSidebarNotification("Please login to book laundry service", "error");
        closeSidebar();
        return;
      }
      // ✅ Logged in → e.preventDefault() nahi → services.html pe redirect hoga
      console.log("📅 Redirecting to services.html...");
    });
  }

  // ✅ FIX: "Track Order" → orders.html
  // Sirf logged-out users ko rokna
  const trackOrderLink = document.querySelector('.sidebar-link[data-section="track"]');
  if (trackOrderLink) {
    trackOrderLink.addEventListener("click", (e) => {
      const isLoggedIn = storage.getItem("isLoggedIn") === "true";
      if (!isLoggedIn) {
        e.preventDefault(); // ✅ Sirf tab rokna jab logged out ho
        showSidebarNotification("Please login to track your orders", "error");
        closeSidebar();
        return;
      }
      // ✅ Logged in → e.preventDefault() nahi → orders.html pe redirect hoga
      console.log("📍 Redirecting to orders.html...");
    });
  }

  // ✅ FIX: "My Orders" → orders.html
  // e.preventDefault() BILKUL NAHI — seedha redirect
  const myOrdersLink = document.querySelector('.sidebar-link[data-section="orders"]');
  if (myOrdersLink) {
    myOrdersLink.addEventListener("click", () => {
      // ✅ koi preventDefault nahi — orders.html pe redirect hoga
      console.log("🛍️ Redirecting to orders.html...");
    });
  }

  // ============================================
  // LISTEN FOR AUTH STATE CHANGES
  // ============================================

  window.addEventListener("storage", (e) => {
    if (e.key === "isLoggedIn" || e.key === "userName" || e.key === "userEmail") {
      console.log("🔄 Auth state changed in another tab, updating sidebar...");
      checkSidebarAuthState();
    }
  });

  window.addEventListener("authStateChanged", () => {
    console.log("🔄 Auth state changed event received in sidebar");
    checkSidebarAuthState();
  });

  window.addEventListener("loginSuccess", (e) => {
    console.log("✅ Login success event received in sidebar:", e.detail);
    checkSidebarAuthState();
  });

  let lastAuthState = storage.getItem("isLoggedIn");
  setInterval(() => {
    const currentAuthState = storage.getItem("isLoggedIn");
    if (currentAuthState !== lastAuthState) {
      console.log("🔄 Auth state changed (periodic check), updating sidebar...");
      checkSidebarAuthState();
      lastAuthState = currentAuthState;
    }
  }, 500);

  // ============================================
  // EXPORT FUNCTIONS FOR GLOBAL ACCESS
  // ============================================

  window.openSidebar            = openSidebar;
  window.closeSidebar           = closeSidebar;
  window.toggleSidebar          = toggleSidebar;
  window.updateOrderBadge       = updateOrderBadge;
  window.checkSidebarAuthState  = checkSidebarAuthState;
  window.showSidebarNotification = showSidebarNotification;

  console.log("✨ Sidebar initialized!");
  console.log("✅ FIX: My Orders    → orders.html   (redirect working)");
  console.log("✅ FIX: Book Laundry → services.html (redirect working)");
  console.log("✅ FIX: Track Order  → orders.html   (redirect working)");
}

console.log("🎉 Sidebar JavaScript fully initialized!");