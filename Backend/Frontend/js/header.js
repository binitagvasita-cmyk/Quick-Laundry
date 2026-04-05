// ============================================
// HEADER JAVASCRIPT - FIXED
// Uses global window.safeStorage directly (no redeclaration)
// ============================================

console.log("🚀 Header JavaScript Loading...");

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
// PROFILE MODAL FUNCTIONS - GLOBAL ✅
// ============================================

function openProfileModal() {
  console.log("👤 Opening profile modal...");

  // Check if user is logged in
  const isLoggedIn = window.safeStorage.getItem("isLoggedIn") === "true";
  if (!isLoggedIn) {
    if (typeof showNotification === "function") {
      showNotification("Please login to view your profile", "info");
    }
    return;
  }

  // Check if we're on home-content page (has authModalOverlay)
  let authModalOverlay = document.getElementById("authModalOverlay");
  let authModalContainer = document.getElementById("authModalContainer");
  let authIframe = document.getElementById("authIframe");

  // If modal doesn't exist, create it dynamically
  if (!authModalOverlay) {
    createProfileModal();
    authModalOverlay = document.getElementById("authModalOverlay");
    authModalContainer = document.getElementById("authModalContainer");
    authIframe = document.getElementById("authIframe");
  }

  if (!authModalOverlay || !authIframe) {
    console.error("❌ Modal elements not found");
    return;
  }

  // Set iframe to profile page
  authIframe.src = "profile.html";

  if (authModalContainer) {
    authModalContainer.classList.add("loading");
  }

  setTimeout(() => {
    authModalOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }, 50);

  authIframe.onload = function () {
    console.log("✅ Profile iframe loaded!");
    if (authModalContainer) {
      authModalContainer.classList.remove("loading");
    }
  };

  authIframe.onerror = function () {
    console.error("❌ Failed to load profile page");
    if (authModalContainer) {
      authModalContainer.classList.remove("loading");
    }
    if (typeof showNotification === "function") {
      showNotification("Failed to load profile page", "error");
    }
  };
}

function closeProfileModal() {
  console.log("🚫 Closing profile modal...");
  const authModalOverlay = document.getElementById("authModalOverlay");
  const authIframe = document.getElementById("authIframe");

  if (!authModalOverlay) return;

  authModalOverlay.classList.add("closing");

  setTimeout(() => {
    authModalOverlay.classList.remove("active", "closing");

    if (authIframe) {
      authIframe.src = "about:blank";
    }

    document.body.style.overflow = "";
    console.log("✅ Profile modal closed");
  }, 300);
}

function createProfileModal() {
  console.log("🔨 Creating profile modal dynamically...");

  const modalHTML = `
    <div class="auth-modal-overlay" id="authModalOverlay">
      <div class="auth-modal-container" id="authModalContainer">
        <button class="auth-modal-close" id="authModalClose" aria-label="Close">
          <i class="fas fa-times"></i>
        </button>
        <iframe
          id="authIframe"
          src="about:blank"
          style="width: 100%; height: 100%; border: none"
        ></iframe>
      </div>
    </div>
  `;

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = modalHTML;
  document.body.appendChild(tempDiv.firstElementChild);

  // Add auth-modal.css if not already present
  if (!document.querySelector('link[href="css/auth-modal.css"]')) {
    const authModalCSS = document.createElement("link");
    authModalCSS.rel = "stylesheet";
    authModalCSS.href = "css/auth-modal.css";
    document.head.appendChild(authModalCSS);
  }

  // Setup close handlers
  const authModalClose = document.getElementById("authModalClose");
  const authModalOverlay = document.getElementById("authModalOverlay");

  if (authModalClose) {
    authModalClose.addEventListener("click", closeProfileModal);
  }

  if (authModalOverlay) {
    authModalOverlay.addEventListener("click", (e) => {
      if (e.target === authModalOverlay) {
        closeProfileModal();
      }
    });
  }

  // ESC key to close
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      authModalOverlay &&
      authModalOverlay.classList.contains("active")
    ) {
      closeProfileModal();
    }
  });

  // Listen for messages from iframe
  window.addEventListener("message", function (event) {
    const { type } = event.data;

    if (type === "CLOSE_PROFILE") {
      console.log("📩 Close profile requested from iframe");
      closeProfileModal();
    }
  });

  console.log("✅ Profile modal created!");
}

// Export globally
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.createProfileModal = createProfileModal;
// ============================================
// OPEN AUTH MODAL (LOGIN/REGISTER)
// ============================================

function openAuthModal(type = "login") {
  // Create modal if it doesn't exist
  let authModalOverlay = document.getElementById("authModalOverlay");
  if (!authModalOverlay) {
    createProfileModal(); // reuses same modal structure
    authModalOverlay = document.getElementById("authModalOverlay");
  }

  const iframe = document.getElementById("authIframe");
  const container = document.getElementById("authModalContainer");

  if (!authModalOverlay || !iframe) {
    console.error("❌ Auth modal elements not found");
    return;
  }

  // Only reload if not already on the right page
  const targetPage = type === "login" ? "login.html" : "registration.html";
  if (!iframe.src.includes(targetPage)) {
    iframe.src = targetPage;
    if (container) container.classList.add("loading");

    iframe.onload = () => {
      if (container) container.classList.remove("loading");
      console.log(`✅ ${targetPage} loaded in modal`);
    };
  }

  // Show modal
  setTimeout(() => {
    authModalOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }, 50);

  console.log(`✅ Auth modal opened: ${type}`);
}

// Handle messages from login/register iframes
window.addEventListener("message", function (event) {
  const { type, data } = event.data;

  if (type === "AUTH_SUCCESS") {
    // User logged in successfully from iframe
    if (data) {
      window.safeStorage.setItem("isLoggedIn", "true");
      window.safeStorage.setItem("userName", data.userName || "");
      window.safeStorage.setItem("userEmail", data.userEmail || "");
      window.safeStorage.setItem("jwtToken", data.token || "");
    }

    // Close modal
    const overlay = document.getElementById("authModalOverlay");
    const iframe = document.getElementById("authIframe");
    if (overlay) {
      overlay.classList.add("closing");
      setTimeout(() => {
        overlay.classList.remove("active", "closing");
        if (iframe) iframe.src = "about:blank";
        document.body.style.overflow = "";
      }, 300);
    }

    // Fire login success event so header updates
    window.dispatchEvent(
      new CustomEvent("loginSuccess", {
        detail: { userName: data?.userName },
      })
    );
  }

  if (type === "CLOSE_MODAL") {
    const overlay = document.getElementById("authModalOverlay");
    const iframe = document.getElementById("authIframe");
    if (overlay) {
      overlay.classList.add("closing");
      setTimeout(() => {
        overlay.classList.remove("active", "closing");
        if (iframe) iframe.src = "about:blank";
        document.body.style.overflow = "";
      }, 300);
    }
  }

  if (type === "SWITCH_TO_REGISTRATION") {
    const iframe = document.getElementById("authIframe");
    if (iframe) iframe.src = "registration.html";
  }
});

window.openAuthModal = openAuthModal;
// ============================================
// WAIT FOR HEADER DOM TO BE READY - WITH RETRY ✅
// ============================================

function waitForHeaderElements() {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max (50 * 100ms)

    const checkInterval = setInterval(() => {
      attempts++;

      // Check if essential header elements exist
      const header = document.getElementById("header");
      const loginBtn = document.getElementById("loginBtn");
      const userMenu = document.getElementById("userMenu");

      if (header && (loginBtn || userMenu)) {
        console.log(`✅ Header elements found after ${attempts} attempts`);
        clearInterval(checkInterval);
        resolve(true);
      } else if (attempts >= maxAttempts) {
        console.warn("⚠️ Header elements not found after max attempts");
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100); // Check every 100ms
  });
}

// ============================================
// INITIALIZE HEADER - WAIT FOR DOM FIRST
// ============================================

async function initHeader() {
  console.log("🎯 Waiting for header elements to load...");

  // Wait for header elements to be available
  const elementsReady = await waitForHeaderElements();

  if (!elementsReady) {
    console.error("❌ Failed to initialize header - elements not found");
    // Still try to check auth state in case elements load later
    setTimeout(checkAuthState, 1000);
    return;
  }

  console.log("✅ Header elements ready, initializing...");

  // ============================================
  // GET ALL ELEMENTS
  // ============================================

  const themeToggle = document.getElementById("themeToggle");
  const mobileToggle = document.getElementById("mobileToggle");
  const navLinks = document.getElementById("navLinks");
  const loginBtn = document.getElementById("loginBtn");
  const userMenu = document.getElementById("userMenu");
  const logoutBtn = document.getElementById("logoutBtn");
  const header = document.getElementById("header");
  const htmlElement = document.documentElement;

  // Navigation links
  const allNavLinks = document.querySelectorAll(".nav-link");

  // ============================================
  // THEME MANAGEMENT
  // ============================================

  function loadTheme() {
    const savedTheme = window.safeStorage.getItem("theme") || "light";
    htmlElement.setAttribute("data-theme", savedTheme);
    console.log("🎨 Theme loaded:", savedTheme);
  }

  function toggleTheme() {
    const currentTheme = htmlElement.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";

    htmlElement.setAttribute("data-theme", newTheme);
    window.safeStorage.setItem("theme", newTheme);

    console.log("🎨 Theme changed to:", newTheme);

    // Send theme change to iframe (profile modal)
    const authIframe = document.getElementById("authIframe");
    if (authIframe && authIframe.contentWindow) {
      authIframe.contentWindow.postMessage(
        { type: "THEME_CHANGED", theme: newTheme },
        "*"
      );
      console.log("📤 Theme change sent to iframe");
    }

    if (themeToggle) {
      themeToggle.style.transition = "transform 0.4s ease";
      themeToggle.style.transform = "rotate(360deg)";
      setTimeout(() => {
        themeToggle.style.transform = "rotate(0deg)";
      }, 400);
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
    loadTheme();
    console.log("✅ Theme toggle initialized");
  }

  // ============================================
  // MOBILE MENU TOGGLE
  // ============================================

  let isMobileMenuOpen = false;

  function toggleMobileMenu() {
    isMobileMenuOpen = !isMobileMenuOpen;

    if (navLinks) {
      if (isMobileMenuOpen) {
        navLinks.classList.add("active");
        if (mobileToggle) {
          mobileToggle.innerHTML = '<i class="fas fa-times"></i>';
        }
        document.body.style.overflow = "hidden";
      } else {
        navLinks.classList.remove("active");
        if (mobileToggle) {
          mobileToggle.innerHTML = '<i class="fas fa-bars"></i>';
        }
        document.body.style.overflow = "";
      }
    }
  }

  if (mobileToggle) {
    mobileToggle.addEventListener("click", toggleMobileMenu);
    console.log("✅ Mobile menu toggle initialized");
  }

  allNavLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      if (window.innerWidth <= 768) {
        if (link.parentElement.classList.contains("nav-dropdown")) {
          e.preventDefault();
          link.parentElement.classList.toggle("active");
        } else {
          if (isMobileMenuOpen) {
            toggleMobileMenu();
          }
        }
      }

      allNavLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && isMobileMenuOpen) {
      toggleMobileMenu();
    }
  });

  // ============================================
  // AUTHENTICATION STATE MANAGEMENT - FIXED ✅
  // ============================================

  function checkAuthState() {
    const isLoggedIn = window.safeStorage.getItem("isLoggedIn") === "true";
    const userName = window.safeStorage.getItem("userName") || "Guest User";

    console.log("🔐 Auth state check:", { isLoggedIn, userName });

    // Get elements fresh (in case they loaded after initial check)
    const loginBtn = document.getElementById("loginBtn");
    const userMenu = document.getElementById("userMenu");
    const userNameElement = document.querySelector(".user-name");

    if (isLoggedIn) {
      if (loginBtn) {
        loginBtn.style.display = "none";
        loginBtn.style.visibility = "hidden";
      }

      if (userMenu) {
        userMenu.style.display = "flex";
        userMenu.style.visibility = "visible";
      }

      if (userNameElement) {
        userNameElement.textContent = userName;
        console.log(`✅ Username displayed: ${userName}`);
      } else {
        console.warn("⚠️ .user-name element not found, retrying...");
        // Retry after a short delay
        setTimeout(() => {
          const retryElement = document.querySelector(".user-name");
          if (retryElement) {
            retryElement.textContent = userName;
            console.log(`✅ Username displayed on retry: ${userName}`);
          }
        }, 200);
      }

      console.log("✅ User menu shown, login button hidden");
    } else {
      if (loginBtn) {
        loginBtn.style.display = "flex";
        loginBtn.style.visibility = "visible";
      }

      if (userMenu) {
        userMenu.style.display = "none";
        userMenu.style.visibility = "hidden";
      }

      console.log("✅ Login button shown, user menu hidden");
    }
  }
  // Pre-load login iframe in background for instant modal open
  function preloadAuthIframe() {
    let overlay = document.getElementById("authModalOverlay");
    if (!overlay) createProfileModal();

    const iframe = document.getElementById("authIframe");
    if (iframe && iframe.src === "about:blank") {
      // Load silently in background
      const tempFrame = document.createElement("iframe");
      tempFrame.style.display = "none";
      tempFrame.src = "login.html";
      tempFrame.onload = () => {
        // Now swap: pre-warm the real iframe
        if (iframe && iframe.src === "about:blank") {
          iframe.src = "login.html";
        }
        tempFrame.remove();
      };
      document.body.appendChild(tempFrame);
    }
  }

  // Pre-load after page is fully ready (low priority)
  setTimeout(preloadAuthIframe, 2000);

  // ============================================
  // LOGIN/LOGOUT HANDLERS
  // ============================================

  if (loginBtn) {
    loginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("🔑 Header login button clicked");

      if (typeof openAuthModal === "function") {
        openAuthModal("login");
      } else {
        console.error("❌ openAuthModal function not found");
      }
    });
    console.log("✅ Login button initialized");
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();

      window.safeStorage.removeItem("isLoggedIn");
      window.safeStorage.removeItem("userName");
      window.safeStorage.removeItem("userEmail");
      window.safeStorage.removeItem("jwtToken");

      checkAuthState();

      if (typeof showNotification === "function") {
        showNotification("Logged out successfully!", "success");
      }

      console.log("✅ User logged out");
    });
    console.log("✅ Logout button initialized");
  }

  // ============================================
  // PROFILE LINK HANDLER - NEW ADDITION ✅
  // ============================================

  const profileLink = document.querySelector('a[href="profile.html"]');
  if (profileLink) {
    profileLink.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("👤 Profile link clicked");

      // Check if user is logged in
      const isLoggedIn = window.safeStorage.getItem("isLoggedIn") === "true";
      if (!isLoggedIn) {
        if (typeof showNotification === "function") {
          showNotification("Please login to view your profile", "info");
        }
        if (typeof openAuthModal === "function") {
          openAuthModal("login");
        }
        return;
      }

      // Open profile modal
      openProfileModal();
    });
    console.log("✅ Profile link handler attached");
  }

  // ✅ INITIAL AUTH STATE CHECK
  checkAuthState();

  // ============================================
  // AUTH STATE CHANGE LISTENERS
  // ============================================

  window.addEventListener("storage", (e) => {
    if (e.key === "isLoggedIn" || e.key === "userName") {
      console.log("🔄 Auth state changed in another tab");
      checkAuthState();
    }
  });

  window.addEventListener("loginSuccess", (e) => {
    console.log("✅ Login success event received:", e.detail);

    // Small delay to ensure localStorage is updated
    setTimeout(() => {
      checkAuthState();

      if (
        e.detail &&
        e.detail.userName &&
        typeof showNotification === "function"
      ) {
        showNotification(`Welcome back, ${e.detail.userName}!`, "success");
      }
    }, 100);
  });

  window.addEventListener("authStateChanged", () => {
    console.log("🔄 Auth state changed event received in header");
    setTimeout(checkAuthState, 100);
  });

  // ✅ PERIODIC AUTH STATE CHECK (for dynamically loaded headers)
  let lastAuthState = window.safeStorage.getItem("isLoggedIn");
  setInterval(() => {
    const currentAuthState = window.safeStorage.getItem("isLoggedIn");
    if (currentAuthState !== lastAuthState) {
      console.log("🔄 Auth state changed (periodic check)");
      checkAuthState();
      lastAuthState = currentAuthState;
    }
  }, 500);

  // ============================================
  // HEADER SCROLL EFFECT
  // ============================================

  let lastScroll = 0;

  if (header) {
    window.addEventListener("scroll", () => {
      const currentScroll = window.pageYOffset;

      if (currentScroll > 0) {
        header.style.boxShadow = "0 6px 30px var(--shadow-color)";
      } else {
        header.style.boxShadow = "0 4px 20px var(--shadow-color)";
      }

      lastScroll = currentScroll;
    });
    console.log("✅ Header scroll effect initialized");
  }

  // ============================================
  // SMOOTH SCROLL
  // ============================================

  allNavLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");

      if (href && href.startsWith("#")) {
        e.preventDefault();

        const targetId = href.substring(1);
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
          targetSection.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }
    });
  });

  // ============================================
  // NOTIFICATION SYSTEM
  // ============================================

  function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
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

  window.showNotification = showNotification;

  if (!document.getElementById("notification-styles")) {
    const style = document.createElement("style");
    style.id = "notification-styles";
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // EXPORT FUNCTIONS
  // ============================================

  window.checkAuthState = checkAuthState;

  console.log("🎉 Header fully initialized!");
}

// ============================================
// START INITIALIZATION
// ============================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHeader);
} else {
  // DOM already loaded
  initHeader();
}

// ============================================
// CART BADGE UPDATE FUNCTION
// ============================================

async function updateCartBadge() {
  const isLoggedIn = window.safeStorage.getItem("isLoggedIn") === "true";
  const jwtToken = window.safeStorage.getItem("jwtToken");

  if (!isLoggedIn || !jwtToken) {
    return;
  }

  try {
    const response = await fetch(window.location.origin + "/api/cart", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (result.success) {
      const cartCount = result.data.cartItems.length;

      const cartBadge = document.getElementById("cartBadge");
      if (cartBadge) {
        if (cartCount > 0) {
          cartBadge.textContent = cartCount;
          cartBadge.style.display = "block";
        } else {
          cartBadge.style.display = "none";
        }
      }

      console.log(`🛒 Cart items: ${cartCount}`);
    }
  } catch (error) {
    console.error("❌ Error fetching cart count:", error);
  }
}

window.addEventListener("loginSuccess", () => {
  updateCartBadge();
});

setInterval(() => {
  const isLoggedIn = window.safeStorage.getItem("isLoggedIn") === "true";
  if (isLoggedIn) {
    updateCartBadge();
  }
}, 30000);

if (window.safeStorage.getItem("isLoggedIn") === "true") {
  setTimeout(updateCartBadge, 1000);
}

window.updateCartBadge = updateCartBadge;

console.log("✨ Header JavaScript Loaded Successfully!");
