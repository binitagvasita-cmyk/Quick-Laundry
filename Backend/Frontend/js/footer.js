// ============================================
// FOOTER JAVASCRIPT - ENHANCED VERSION
// ============================================

console.log("🦶 Footer JavaScript Loading...");

// ============================================
// WAIT FOR DOM TO BE READY
// ============================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFooter);
} else {
  initFooter();
}

function initFooter() {
  console.log("🎯 Initializing Footer...");

  // ============================================
  // BACK TO TOP BUTTON
  // ============================================
  
  const backToTopBtn = document.getElementById("backToTop");

  if (backToTopBtn) {
    // Show/hide button based on scroll position
    window.addEventListener("scroll", () => {
      if (window.pageYOffset > 300) {
        backToTopBtn.classList.add("visible");
      } else {
        backToTopBtn.classList.remove("visible");
      }
    });

    // Scroll to top on click
    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
      console.log("⬆️ Scrolling to top");
    });

    console.log("✅ Back to top button initialized");
  }

  // ============================================
  // NEWSLETTER SUBSCRIPTION
  // ============================================
  
  const newsletterForm = document.querySelector(".newsletter-form");
  const newsletterInput = document.querySelector(".newsletter-input");
  const newsletterBtn = document.querySelector(".newsletter-btn");

  if (newsletterForm && newsletterInput && newsletterBtn) {
    // Prevent form submission (for demo)
    newsletterBtn.addEventListener("click", (e) => {
      e.preventDefault();
      
      const email = newsletterInput.value.trim();
      
      if (!email) {
        showFooterNotification("Please enter your email address", "error");
        newsletterInput.focus();
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showFooterNotification("Please enter a valid email address", "error");
        newsletterInput.focus();
        return;
      }

      // Success feedback
      showFooterNotification("Thank you for subscribing! 🎉", "success");
      newsletterInput.value = "";
      
      // Add animation to button
      newsletterBtn.style.transform = "scale(0.95)";
      setTimeout(() => {
        newsletterBtn.style.transform = "scale(1)";
      }, 150);

      console.log("📧 Newsletter subscription:", email);
    });

    // Submit on Enter key
    newsletterInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        newsletterBtn.click();
      }
    });

    console.log("✅ Newsletter subscription initialized");
  }

  // ============================================
  // SOCIAL LINKS ANALYTICS (OPTIONAL)
  // ============================================
  
  const socialLinks = document.querySelectorAll(".social-link");
  
  socialLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      const platform = link.getAttribute("aria-label") || "Unknown";
      console.log(`📱 Social link clicked: ${platform}`);
      
      // You can add analytics tracking here
      // Example: gtag('event', 'social_click', { platform: platform });
    });
  });

  if (socialLinks.length > 0) {
    console.log(`✅ ${socialLinks.length} social links initialized`);
  }

  // ============================================
  // FOOTER LINKS SMOOTH SCROLL
  // ============================================
  
  const footerLinks = document.querySelectorAll('.footer-list a[href^="#"]');
  
  footerLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      
      if (href && href !== "#") {
        e.preventDefault();
        
        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
          console.log(`🔗 Smooth scroll to: ${targetId}`);
        }
      }
    });
  });

  // ============================================
  // CURRENT YEAR UPDATE
  // ============================================
  
  const copyrightText = document.querySelector(".copyright");
  if (copyrightText) {
    const currentYear = new Date().getFullYear();
    copyrightText.innerHTML = `
      <i class="fas fa-copyright"></i>
      ${currentYear} Quick Laundry. All rights reserved.
    `;
    console.log(`✅ Copyright year updated to ${currentYear}`);
  }

  // ============================================
  // FOOTER ANIMATION ON SCROLL
  // ============================================
  
  const footerSections = document.querySelectorAll(".footer-section");
  
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  };

  const footerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, observerOptions);

  footerSections.forEach(section => {
    section.style.opacity = "0";
    section.style.transform = "translateY(30px)";
    section.style.transition = "all 0.6s ease";
    footerObserver.observe(section);
  });

  console.log("✅ Footer scroll animations initialized");

  // ============================================
  // CONTACT LINKS - CLICK TO COPY
  // ============================================
  
  const contactLinks = document.querySelectorAll(".contact-details a");
  
  contactLinks.forEach(link => {
    const href = link.getAttribute("href");
    
    // Add copy functionality for email and phone
    if (href && (href.startsWith("mailto:") || href.startsWith("tel:"))) {
      link.style.cursor = "pointer";
      
      // Add copy icon on hover (optional)
      link.addEventListener("mouseenter", () => {
        link.setAttribute("title", "Click to copy");
      });
      
      // Copy to clipboard on right-click
      link.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        
        const text = href.startsWith("mailto:") 
          ? href.replace("mailto:", "")
          : href.replace("tel:", "");
        
        navigator.clipboard.writeText(text).then(() => {
          showFooterNotification(`Copied: ${text}`, "success");
        }).catch(err => {
          console.error("Failed to copy:", err);
        });
      });
    }
  });

  console.log("🎉 Footer fully initialized!");
}

// ============================================
// NOTIFICATION SYSTEM FOR FOOTER
// ============================================

function showFooterNotification(message, type = "info") {
  // Remove any existing notifications
  const existingNotification = document.querySelector(".footer-notification");
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement("div");
  notification.className = `footer-notification footer-notification-${type}`;
  
  const icon = type === "success" 
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
    bottom: 100px;
    right: 30px;
    background: ${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"};
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
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Export for use in other scripts
window.showFooterNotification = showFooterNotification;

// ============================================
// ANIMATION STYLES
// ============================================

if (!document.getElementById("footer-notification-styles")) {
  const style = document.createElement("style");
  style.id = "footer-notification-styles";
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

    @media (max-width: 768px) {
      .footer-notification {
        right: 20px !important;
        bottom: 80px !important;
        left: 20px !important;
        max-width: calc(100% - 40px) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

console.log("✨ Footer JavaScript Loaded Successfully!");