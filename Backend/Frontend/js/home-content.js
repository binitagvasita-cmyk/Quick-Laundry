// ============================================
// HOME CONTENT - WITH AUTH & PROFILE MODALS
// ============================================

console.log("🏠 Home Content JavaScript Loaded!");

// Wait for DOM to load
document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOM loaded, initializing modal systems...");

  // Get modal elements
  const authModalOverlay = document.getElementById("authModalOverlay");
  const authModalContainer = document.getElementById("authModalContainer");
  const authModalClose = document.getElementById("authModalClose");
  const authIframe = document.getElementById("authIframe");

  // ============================================
  // OPEN AUTH MODAL
  // ============================================
  function openAuthModal(page = "login") {
    if (!authModalOverlay || !authIframe) {
      console.error("❌ Auth modal elements not found");
      return;
    }

    console.log("✅ Opening auth modal:", page);

    const iframeSrc = page === "login" ? "login.html" : "registration.html";
    authIframe.src = iframeSrc;

    if (authModalContainer) {
      authModalContainer.classList.add("loading");
    }

    setTimeout(() => {
      authModalOverlay.classList.add("active");
      document.body.style.overflow = "hidden";
    }, 50);

    authIframe.onload = function () {
      console.log("✅ Iframe loaded successfully!");
      if (authModalContainer) {
        authModalContainer.classList.remove("loading");
      }
    };

    authIframe.onerror = function () {
      console.error("❌ Failed to load iframe");
      if (authModalContainer) {
        authModalContainer.classList.remove("loading");
      }
      alert("Failed to load login page. Please check if login.html exists.");
    };
  }

  // ============================================
  // CLOSE AUTH MODAL
  // ============================================
  function closeAuthModal() {
    if (!authModalOverlay) return;

    console.log("🚫 Closing auth modal...");
    authModalOverlay.classList.add("closing");

    setTimeout(() => {
      authModalOverlay.classList.remove("active", "closing");

      if (authIframe) {
        authIframe.src = "about:blank";
      }

      document.body.style.overflow = "";
      console.log("✅ Auth modal closed");
    }, 300);
  }

  // ============================================
  // OPEN PROFILE MODAL - NEW ADDITION ✅
  // ============================================
  function openProfileModal() {
    console.log("👤 Opening profile modal...");

    // Check if user is logged in
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
    if (!isLoggedIn) {
      if (typeof showNotification === "function") {
        showNotification("Please login to view your profile", "info");
      }
      return;
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

  // ============================================
  // CLOSE PROFILE MODAL - NEW ADDITION ✅
  // ============================================
  function closeProfileModal() {
    console.log("🚫 Closing profile modal...");
    closeAuthModal(); // Use same closing logic
  }

  // Export globally
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.openProfileModal = openProfileModal;
  window.closeProfileModal = closeProfileModal;

  // ============================================
  // EVENT LISTENERS
  // ============================================

  // Close button click
  if (authModalClose) {
    authModalClose.addEventListener("click", closeAuthModal);
  }

  // Click outside modal to close
  if (authModalOverlay) {
    authModalOverlay.addEventListener("click", (e) => {
      if (e.target === authModalOverlay) {
        closeAuthModal();
      }
    });
  }

  // ESC key to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && authModalOverlay.classList.contains("active")) {
      closeAuthModal();
    }
  });

  // ============================================
  // IFRAME MESSAGE COMMUNICATION
  // ============================================
  window.addEventListener("message", function (event) {
    console.log("📨 Message received from iframe:", event.data);

    const { type, data } = event.data;

    switch (type) {
      case "CLOSE_MODAL":
        console.log("📩 Close modal requested");
        closeAuthModal();
        break;

      case "CLOSE_PROFILE": // ✅ NEW - Handle profile close
        console.log("📩 Close profile requested");
        closeProfileModal();
        break;

      case "SWITCH_TO_REGISTRATION":
        console.log("📩 Switching to registration");
        if (authIframe) {
          authIframe.src = "registration.html";
        }
        break;

      case "SWITCH_TO_LOGIN":
        console.log("📩 Switching to login");
        if (authIframe) {
          authIframe.src = "login.html";
        }
        break;

      case "AUTH_SUCCESS":
        console.log("✅ Authentication successful!");
        handleAuthSuccess(data);
        break;

      case "SHOW_NOTIFICATION":
        console.log("📢 Notification:", data.message);
        if (typeof showNotification === "function") {
          showNotification(data.message, data.type || "info");
        }
        break;

      default:
        console.log("📨 Unknown message type:", type);
    }
  });

  // ============================================
  // HANDLE AUTH SUCCESS
  // ============================================
  function handleAuthSuccess(userData) {
    console.log("✅ Processing auth success:", userData);

    try {
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userName", userData.userName || "User");
      localStorage.setItem("userEmail", userData.userEmail || "");
      localStorage.setItem(
        "jwtToken",
        userData.token || "demo_token_" + Date.now()
      );
    } catch (e) {
      console.warn("localStorage not available:", e);
    }

    if (typeof checkAuthState === "function") {
      checkAuthState();
    }

    if (typeof checkSidebarAuthState === "function") {
      checkSidebarAuthState();
    }

    if (typeof showNotification === "function") {
      showNotification(`Welcome back, ${userData.userName}!`, "success");
    }

    closeAuthModal();

    window.dispatchEvent(
      new CustomEvent("loginSuccess", {
        detail: userData,
      })
    );

    console.log("✅ Auth state updated successfully");
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  function sendMessageToIframe(type, data = {}) {
    if (authIframe && authIframe.contentWindow) {
      authIframe.contentWindow.postMessage({ type, data }, "*");
      console.log("📤 Message sent to iframe:", type);
    }
  }

  function checkIfAlreadyLoggedIn() {
    let isLoggedIn = false;
    try {
      isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
    } catch (e) {
      console.warn("localStorage not available:", e);
    }

    if (isLoggedIn && authModalOverlay.classList.contains("active")) {
      console.log("ℹ️ User already logged in, closing modal...");
      closeAuthModal();

      if (typeof showNotification === "function") {
        showNotification("You are already logged in!", "info");
      }
    }
  }

  checkIfAlreadyLoggedIn();

  // ============================================
  // IFRAME ERROR HANDLING
  // ============================================
  if (authIframe) {
    authIframe.addEventListener("error", (e) => {
      console.error("❌ Error loading authentication page:", e);

      if (authModalContainer) {
        authModalContainer.classList.remove("loading");
      }

      if (typeof showNotification === "function") {
        showNotification("Failed to load authentication page", "error");
      }
    });
  }

  // ============================================
  // AUTO-CLOSE ON MULTI-TAB LOGIN
  // ============================================
  window.addEventListener("storage", (e) => {
    if (
      e.key === "isLoggedIn" &&
      e.newValue === "true" &&
      authModalOverlay.classList.contains("active")
    ) {
      console.log("✅ Login detected from another tab");
      closeAuthModal();
    }
  });

  // ============================================
  // EXPORT FUNCTIONS GLOBALLY
  // ============================================
  window.sendMessageToIframe = sendMessageToIframe;

  // ============================================
  // ATTACH LOGIN BUTTON HANDLERS
  // ============================================
  setTimeout(() => {
    // Header login button
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) {
      const newLoginBtn = loginBtn.cloneNode(true);
      loginBtn.parentNode.replaceChild(newLoginBtn, loginBtn);

      newLoginBtn.addEventListener("click", function (e) {
        e.preventDefault();
        console.log("🔒 Login button clicked");
        openAuthModal("login");
      });

      console.log("✅ Header login button handler attached");
    }

    // Sidebar login button
    const sidebarLoginBtn = document.getElementById("sidebarLoginBtn");
    if (sidebarLoginBtn) {
      const newSidebarLoginBtn = sidebarLoginBtn.cloneNode(true);
      sidebarLoginBtn.parentNode.replaceChild(
        newSidebarLoginBtn,
        sidebarLoginBtn
      );

      newSidebarLoginBtn.addEventListener("click", function (e) {
        e.preventDefault();
        console.log("🔒 Sidebar login button clicked");

        if (typeof closeSidebar === "function") {
          closeSidebar();
        }

        setTimeout(() => {
          openAuthModal("login");
        }, 300);
      });

      console.log("✅ Sidebar login button handler attached");
    }
  }, 500);

  console.log("🎉 Modal systems initialized!");
});

// ============================================
// SMOOTH SCROLL FOR ANCHOR LINKS
// ============================================
document.addEventListener("click", function (e) {
  const target = e.target.closest('a[href^="#"]');

  if (target) {
    const href = target.getAttribute("href");

    if (href && href !== "#" && href !== "#login") {
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
  }
});

console.log("✨ Home Content JavaScript fully loaded!");

// ============================================
// HOW IT WORKS — VIDEO MODAL
// ============================================

// 🎬 CHANGE THIS to your actual YouTube video ID
// Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ → ID is "dQw4w9WgXcQ"
const HOW_IT_WORKS_VIDEO_ID = "dQw4w9WgXcQ";

window.openHowItWorksVideo = function () {
  const existing = document.getElementById("howItWorksModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "howItWorksModal";
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0,0,0,0.75); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 1rem; animation: fadeInModal 0.25s ease;
  `;

  modal.innerHTML = `
    <div style="
      background: #1a0f2e; border-radius: 18px; width: 100%;
      max-width: 680px; overflow: hidden; position: relative;
      box-shadow: 0 25px 60px rgba(107,70,193,0.45);
      border: 2px solid rgba(167,139,250,0.25);
      animation: slideUpModal 0.3s ease;
    ">
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg,#6b46c1,#9333ea);
        padding: 1rem 1.25rem;
        display: flex; align-items: center; justify-content: space-between;
      ">
        <div style="display:flex;align-items:center;gap:0.6rem;">
          <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);
                      border-radius:50%;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-play" style="color:#fff;font-size:0.85rem;margin-left:2px;"></i>
          </div>
          <div>
            <div style="color:#fff;font-weight:800;font-size:1rem;">How It Works</div>
            <div style="color:rgba(255,255,255,0.7);font-size:0.75rem;">Quick Laundry — Step by Step</div>
          </div>
        </div>
        <button onclick="closeHowItWorksVideo()" style="
          background:rgba(255,255,255,0.15);border:none;color:#fff;
          width:32px;height:32px;border-radius:50%;cursor:pointer;
          font-size:1rem;display:flex;align-items:center;justify-content:center;
          transition:background 0.2s;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'"
           onmouseout="this.style.background='rgba(255,255,255,0.15)'">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Video iframe -->
      <div style="position:relative;padding-bottom:56.25%;height:0;background:#000;">
        <iframe
          id="howItWorksIframe"
          src="images/about.mp4"
          title="How Quick Laundry Works"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
        ></iframe>
      </div>

      <!-- Footer -->
      <div style="
        padding: 0.85rem 1.25rem;
        display: flex; align-items: center; justify-content: space-between;
        background: rgba(107,70,193,0.1);
        border-top: 1px solid rgba(167,139,250,0.15);
      ">
        <span style="color:rgba(255,255,255,0.55);font-size:0.8rem;">
          <i class="fas fa-info-circle" style="color:#a78bfa;"></i>
          &nbsp;Book a pickup after watching!
        </span>
        <button onclick="window.location.href='services.html'" style="
          padding: 0.45rem 1rem;
          background: linear-gradient(135deg,#6b46c1,#9333ea);
          color: #fff; border: none; border-radius: 8px;
          font-weight: 700; cursor: pointer; font-size: 0.82rem;
          display:flex;align-items:center;gap:0.4rem;
        ">
          <i class="fas fa-calendar-plus"></i> Book Now
        </button>
      </div>
    </div>
  `;

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeHowItWorksVideo();
  });

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  // Add animations
  if (!document.getElementById("videoModalStyles")) {
    const s = document.createElement("style");
    s.id = "videoModalStyles";
    s.textContent = `
      @keyframes fadeInModal { from { opacity:0 } to { opacity:1 } }
      @keyframes slideUpModal { from { transform:translateY(30px);opacity:0 } to { transform:translateY(0);opacity:1 } }
    `;
    document.head.appendChild(s);
  }
};

window.closeHowItWorksVideo = function () {
  const modal = document.getElementById("howItWorksModal");
  if (modal) {
    // Stop video before removing
    const iframe = document.getElementById("howItWorksIframe");
    if (iframe) iframe.src = "";
    modal.style.animation = "fadeInModal 0.2s ease reverse";
    setTimeout(() => { modal.remove(); document.body.style.overflow = ""; }, 200);
  }
};

// ESC key closes video modal too
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("howItWorksModal")) {
    closeHowItWorksVideo();
  }
});