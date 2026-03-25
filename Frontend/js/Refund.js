// ============================================
// REFUND POLICY PAGE JAVASCRIPT
// ============================================

console.log("📜 Refund Policy Page JavaScript Loading...");

// ============================================
// WAIT FOR DOM TO BE READY
// ============================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRefundPage);
} else {
  initRefundPage();
}

function initRefundPage() {
  console.log("✅ Initializing Refund Policy Page...");

  // ============================================
  // TABLE OF CONTENTS - SMOOTH SCROLL & ACTIVE STATE
  // ============================================

  const tocLinks = document.querySelectorAll(".toc-list a");
  const policySections = document.querySelectorAll(".policy-section");

  // Smooth scroll on TOC link click
  tocLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();

      const targetId = this.getAttribute("href").substring(1);
      const targetSection = document.getElementById(targetId);

      if (targetSection) {
        // Smooth scroll to section
        targetSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        // Update active state
        tocLinks.forEach((l) => l.classList.remove("active"));
        this.classList.add("active");

        console.log(`📍 Scrolled to section: ${targetId}`);
      }
    });
  });

  // ============================================
  // INTERSECTION OBSERVER FOR ACTIVE TOC LINK
  // ============================================

  const observerOptions = {
    root: null,
    rootMargin: "-100px 0px -66%",
    threshold: 0,
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute("id");
        const correspondingLink = document.querySelector(
          `.toc-list a[href="#${id}"]`
        );

        if (correspondingLink) {
          tocLinks.forEach((link) => link.classList.remove("active"));
          correspondingLink.classList.add("active");
        }
      }
    });
  }, observerOptions);

  // Observe all policy sections
  policySections.forEach((section) => {
    sectionObserver.observe(section);
  });

  console.log("✅ Table of Contents active state tracking initialized");

  // ============================================
  // BREADCRUMB HOME LINK
  // ============================================

  const breadcrumbHomeLink = document.querySelector(
    '.breadcrumb-link[href="home-content.html"]'
  );
  if (breadcrumbHomeLink) {
    breadcrumbHomeLink.addEventListener("click", function (e) {
      console.log("🏠 Navigating to home page");
    });
  }

  // ============================================
  // COPY TO CLIPBOARD FOR CONTACT INFO
  // ============================================

  const contactLinks = document.querySelectorAll(".contact-link");

  contactLinks.forEach((link) => {
    // Add copy on right-click
    link.addEventListener("contextmenu", function (e) {
      e.preventDefault();

      const text =
        this.getAttribute("href")?.replace("tel:", "").replace("mailto:", "") ||
        this.textContent.trim();

      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            showNotification(`Copied: ${text}`, "success");
            console.log(`📋 Copied to clipboard: ${text}`);
          })
          .catch((err) => {
            console.error("Failed to copy:", err);
            showNotification("Failed to copy to clipboard", "error");
          });
      } else {
        // Fallback for older browsers
        const tempInput = document.createElement("input");
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
        showNotification(`Copied: ${text}`, "success");
      }
    });

    // Add hover tooltip
    link.addEventListener("mouseenter", function () {
      this.setAttribute("title", "Right-click to copy");
    });
  });

  console.log("✅ Contact info copy functionality initialized");

  // ============================================
  // EXPAND/COLLAPSE SECTIONS (MOBILE)
  // ============================================

  if (window.innerWidth <= 768) {
    const sectionHeaders = document.querySelectorAll(".section-header");

    sectionHeaders.forEach((header) => {
      header.style.cursor = "pointer";

      header.addEventListener("click", function () {
        const section = this.parentElement;
        const content = section.querySelector(".section-content");

        if (content) {
          const isExpanded = content.style.maxHeight;

          if (isExpanded) {
            content.style.maxHeight = null;
            content.style.opacity = "0";
            section.classList.remove("expanded");
          } else {
            content.style.maxHeight = content.scrollHeight + "px";
            content.style.opacity = "1";
            section.classList.add("expanded");
          }
        }
      });
    });

    console.log("✅ Mobile expand/collapse functionality initialized");
  }

  // ============================================
  // SCROLL TO TOP FUNCTIONALITY
  // ============================================

  let scrollToTopBtn = document.querySelector(".back-to-top");

  // If back-to-top button exists from footer, use it
  // Otherwise, we can rely on footer's implementation
  if (scrollToTopBtn) {
    console.log("✅ Using footer's back-to-top button");
  }

  // ============================================
  // PRINT PAGE FUNCTIONALITY
  // ============================================

  // Add print button (optional)
  function addPrintButton() {
    const ctaButtons = document.querySelector(".cta-buttons");
    if (ctaButtons && !document.getElementById("printPageBtn")) {
      const printBtn = document.createElement("a");
      printBtn.id = "printPageBtn";
      printBtn.href = "#";
      printBtn.className = "cta-button secondary";
      printBtn.innerHTML = `
        <i class="fas fa-print"></i>
        Print Policy
      `;

      printBtn.addEventListener("click", function (e) {
        e.preventDefault();
        window.print();
        console.log("🖨️ Print dialog opened");
      });

      ctaButtons.appendChild(printBtn);
      console.log("✅ Print button added");
    }
  }

  // Uncomment to enable print button
  // addPrintButton();

  // ============================================
  // EXTERNAL LINKS - OPEN IN NEW TAB
  // ============================================

  const externalLinks = document.querySelectorAll(
    'a[href^="http"]:not([href*="quicklaundry.com"])'
  );
  externalLinks.forEach((link) => {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });

  if (externalLinks.length > 0) {
    console.log(`✅ ${externalLinks.length} external links open in new tab`);
  }

  // ============================================
  // NOTIFICATION SYSTEM (REUSE FROM OTHER PAGES)
  // ============================================

  function showNotification(message, type = "info") {
    // Check if notification function exists globally
    if (typeof window.showNotification === "function") {
      window.showNotification(message, type);
      return;
    }

    // Otherwise create our own notification
    const notification = document.createElement("div");
    notification.className = `refund-notification refund-notification-${type}`;

    const icon =
      type === "success"
        ? "fa-check-circle"
        : type === "error"
        ? "fa-exclamation-circle"
        : "fa-info-circle";

    notification.innerHTML = `
      <i class="fas ${icon}"></i>
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
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 600;
      z-index: 100000;
      animation: slideInRight 0.3s ease;
      font-family: inherit;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Export notification function
  window.showRefundNotification = showNotification;

  // ============================================
  // ANIMATION STYLES FOR NOTIFICATIONS
  // ============================================

  if (!document.getElementById("refund-notification-styles")) {
    const style = document.createElement("style");
    style.id = "refund-notification-styles";
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // HIGHLIGHT SEARCH PARAMS (IF ANY)
  // ============================================

  // Check if URL has a hash/section to scroll to
  const urlHash = window.location.hash;
  if (urlHash) {
    setTimeout(() => {
      const targetSection = document.querySelector(urlHash);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
        console.log(`📍 Auto-scrolled to section from URL: ${urlHash}`);
      }
    }, 500);
  }

  // ============================================
  // LAZY LOADING FOR ANIMATIONS
  // ============================================

  const animatedElements = document.querySelectorAll(
    ".summary-card, .scenario-card, .payment-method, .contact-method"
  );

  const animationObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          animationObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
    }
  );

  animatedElements.forEach((element) => {
    element.style.opacity = "0";
    element.style.transform = "translateY(30px)";
    element.style.transition = "all 0.6s ease";
    animationObserver.observe(element);
  });

  console.log("✅ Lazy load animations initialized");

  // ============================================
  // READ TIME ESTIMATOR
  // ============================================

  function estimateReadTime() {
    const content = document.querySelector(".policy-sections");
    if (content) {
      const text = content.innerText;
      const words = text.trim().split(/\s+/).length;
      const readTime = Math.ceil(words / 200); // Average reading speed: 200 words/min

      // Add read time to page meta (if desired)
      const pageMeta = document.querySelector(".page-meta");
      if (pageMeta && !document.getElementById("readTimeIndicator")) {
        const readTimeElement = document.createElement("div");
        readTimeElement.id = "readTimeIndicator";
        readTimeElement.className = "meta-item";
        readTimeElement.innerHTML = `
          <i class="fas fa-clock"></i>
          <span>${readTime} min read</span>
        `;
        pageMeta.appendChild(readTimeElement);
        console.log(`📖 Estimated read time: ${readTime} minutes`);
      }
    }
  }

  estimateReadTime();

  // ============================================
  // ACCESSIBILITY IMPROVEMENTS
  // ============================================

  // Add skip to content link
  function addSkipToContent() {
    if (!document.getElementById("skipToContent")) {
      const skipLink = document.createElement("a");
      skipLink.id = "skipToContent";
      skipLink.href = "#cancellation-policy";
      skipLink.className = "skip-to-content";
      skipLink.textContent = "Skip to main content";

      skipLink.style.cssText = `
        position: absolute;
        top: -100px;
        left: 0;
        background: var(--accent-color);
        color: white;
        padding: 0.75rem 1.5rem;
        text-decoration: none;
        border-radius: 0 0 8px 0;
        z-index: 10001;
        transition: top 0.3s ease;
      `;

      skipLink.addEventListener("focus", function () {
        this.style.top = "0";
      });

      skipLink.addEventListener("blur", function () {
        this.style.top = "-100px";
      });

      document.body.insertBefore(skipLink, document.body.firstChild);
      console.log("✅ Skip to content link added");
    }
  }

  addSkipToContent();

  // ============================================
  // CONSOLE LOG FEATURES
  // ============================================

  console.log("✨ Refund Policy Page Features:");
  console.log("   - Smooth scrolling to sections");
  console.log("   - Active TOC link tracking");
  console.log("   - Copy contact info on right-click");
  console.log("   - Mobile expand/collapse sections");
  console.log("   - Lazy load animations");
  console.log("   - Read time estimator");
  console.log("   - Accessibility improvements");
  console.log("");
  console.log("🔧 Available Functions:");
  console.log("   - showRefundNotification(message, type)");

  console.log("🎉 Refund Policy Page fully initialized!");
}

// ============================================
// AUTH MODAL FUNCTIONALITY (COPIED FROM HOME-CONTENT.JS)
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ Auth modal system initializing...");

  const authModalOverlay = document.getElementById("authModalOverlay");
  const authModalContainer = document.getElementById("authModalContainer");
  const authModalClose = document.getElementById("authModalClose");
  const authIframe = document.getElementById("authIframe");

  // Open Auth Modal
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
  }

  // Close Auth Modal
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

  // Event Listeners
  if (authModalClose) {
    authModalClose.addEventListener("click", closeAuthModal);
  }

  if (authModalOverlay) {
    authModalOverlay.addEventListener("click", (e) => {
      if (e.target === authModalOverlay) {
        closeAuthModal();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && authModalOverlay.classList.contains("active")) {
      closeAuthModal();
    }
  });

  // Message Communication
  window.addEventListener("message", function (event) {
    console.log("📨 Message received from iframe:", event.data);

    const { type, data } = event.data;

    switch (type) {
      case "CLOSE_MODAL":
        closeAuthModal();
        break;

      case "SWITCH_TO_REGISTRATION":
        if (authIframe) {
          authIframe.src = "registration.html";
        }
        break;

      case "SWITCH_TO_LOGIN":
        if (authIframe) {
          authIframe.src = "login.html";
        }
        break;

      case "AUTH_SUCCESS":
        handleAuthSuccess(data);
        break;

      case "SHOW_NOTIFICATION":
        if (typeof showNotification === "function") {
          showNotification(data.message, data.type || "info");
        }
        break;
    }
  });

  // Handle Auth Success
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
  }

  // Export functions
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;

  // Attach login button handler
  setTimeout(() => {
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) {
      const newLoginBtn = loginBtn.cloneNode(true);
      loginBtn.parentNode.replaceChild(newLoginBtn, loginBtn);

      newLoginBtn.addEventListener("click", function (e) {
        e.preventDefault();
        console.log("🔑 Login button clicked");
        openAuthModal("login");
      });

      console.log("✅ Login button handler attached");
    }

    const sidebarLoginBtn = document.getElementById("sidebarLoginBtn");
    if (sidebarLoginBtn) {
      const newSidebarLoginBtn = sidebarLoginBtn.cloneNode(true);
      sidebarLoginBtn.parentNode.replaceChild(
        newSidebarLoginBtn,
        sidebarLoginBtn
      );

      newSidebarLoginBtn.addEventListener("click", function (e) {
        e.preventDefault();
        console.log("🔑 Sidebar login button clicked");

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
});

console.log("✨ Refund Policy Page JavaScript Loaded Successfully!");