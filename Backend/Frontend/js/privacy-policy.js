// ============================================
// PRIVACY POLICY PAGE JAVASCRIPT
// ============================================

console.log("🔒 Privacy Policy JavaScript Loading...");

// ============================================
// WAIT FOR DOM TO BE READY
// ============================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPrivacyPolicy);
} else {
  initPrivacyPolicy();
}

function initPrivacyPolicy() {
  console.log("🎯 Initializing Privacy Policy Page...");

  // ============================================
  // SMOOTH SCROLL FOR NAVIGATION LINKS
  // ============================================

  const navLinks = document.querySelectorAll('.privacy-nav-link');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      const targetId = link.getAttribute('href').substring(1);
      const targetSection = document.getElementById(targetId);
      
      if (targetSection) {
        // Calculate offset for fixed header and nav
        const headerHeight = document.querySelector('.header')?.offsetHeight || 76;
        const navHeight = document.querySelector('.privacy-nav')?.offsetHeight || 100;
        const offset = headerHeight + navHeight + 20;
        
        const targetPosition = targetSection.offsetTop - offset;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });

        // Update active state
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        console.log(`📍 Scrolled to section: ${targetId}`);
      }
    });
  });

  console.log(`✅ ${navLinks.length} navigation links initialized`);

  // ============================================
  // HIGHLIGHT ACTIVE SECTION ON SCROLL
  // ============================================

  const sections = document.querySelectorAll('.privacy-section[id]');
  const headerHeight = document.querySelector('.header')?.offsetHeight || 76;
  const navHeight = document.querySelector('.privacy-nav')?.offsetHeight || 100;
  
  function highlightActiveSection() {
    const scrollY = window.pageYOffset;
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop - headerHeight - navHeight - 50;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');
      
      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  // Throttle scroll event for better performance
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    if (scrollTimeout) {
      window.cancelAnimationFrame(scrollTimeout);
    }
    scrollTimeout = window.requestAnimationFrame(highlightActiveSection);
  });

  console.log("✅ Section highlighting initialized");

  // ============================================
  // COOKIE SETTINGS BUTTON
  // ============================================

  const cookieSettingsBtn = document.querySelector('.cookie-settings-btn');
  
  if (cookieSettingsBtn) {
    cookieSettingsBtn.addEventListener('click', () => {
      console.log("🍪 Cookie settings button clicked");
      
      // Show notification (you can replace this with actual cookie settings modal)
      showPrivacyNotification(
        "Cookie preferences feature coming soon! You can manage cookies through your browser settings.",
        "info"
      );
    });
    console.log("✅ Cookie settings button initialized");
  }

  // ============================================
  // COPY CONTACT INFORMATION
  // ============================================

  const contactLinks = document.querySelectorAll('.contact-card a');
  
  contactLinks.forEach(link => {
    // Add right-click to copy functionality
    link.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      
      const href = link.getAttribute('href');
      let textToCopy = '';
      
      if (href.startsWith('mailto:')) {
        textToCopy = href.replace('mailto:', '');
      } else if (href.startsWith('tel:')) {
        textToCopy = href.replace('tel:', '');
      }
      
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          showPrivacyNotification(`Copied: ${textToCopy}`, "success");
          console.log(`📋 Copied to clipboard: ${textToCopy}`);
        }).catch(err => {
          console.error("Failed to copy:", err);
        });
      }
    });
  });

  if (contactLinks.length > 0) {
    console.log(`✅ ${contactLinks.length} contact links initialized`);
  }

  // ============================================
  // PRINT PAGE FUNCTIONALITY
  // ============================================

  // Add keyboard shortcut for printing (Ctrl+P)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      window.print();
      console.log("🖨️ Print dialog opened");
    }
  });

  // ============================================
  // SECTION ANIMATIONS
  // ============================================

  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  sections.forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(30px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    sectionObserver.observe(section);
  });

  console.log("✅ Section animations initialized");

  // ============================================
  // LAST UPDATED DATE
  // ============================================

  // Auto-update the "Last Updated" date if needed
  const updateLastModified = () => {
    const updatedElement = document.querySelector('.privacy-updated');
    if (updatedElement && document.lastModified) {
      // Optionally update with actual last modified date
      // const lastModified = new Date(document.lastModified);
      // updatedElement.innerHTML = `<i class="fas fa-calendar-alt"></i> Last Updated: ${lastModified.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      console.log("📅 Last updated date checked");
    }
  };

  updateLastModified();

  // ============================================
  // EXTERNAL LINK WARNING (OPTIONAL)
  // ============================================

  const externalLinks = document.querySelectorAll('a[href^="http"]:not([href*="quicklaundry.com"])');
  
  externalLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const confirmed = confirm(`You are about to leave Quick Laundry website. Continue to ${link.href}?`);
      if (!confirmed) {
        e.preventDefault();
      }
    });
  });

  if (externalLinks.length > 0) {
    console.log(`✅ ${externalLinks.length} external links protected`);
  }

  // ============================================
  // READING PROGRESS INDICATOR
  // ============================================

  const createProgressBar = () => {
    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.style.cssText = `
      position: fixed;
      top: var(--header-height);
      left: 0;
      width: 0%;
      height: 4px;
      background: linear-gradient(90deg, var(--gradient-start), var(--gradient-end));
      z-index: 1000;
      transition: width 0.1s ease;
    `;
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight - windowHeight;
      const scrolled = window.scrollY;
      const progress = (scrolled / documentHeight) * 100;
      
      progressBar.style.width = `${Math.min(progress, 100)}%`;
    });

    console.log("✅ Reading progress bar created");
  };

  createProgressBar();

  // ============================================
  // TABLE OF CONTENTS TOGGLE (MOBILE)
  // ============================================

  const privacyNav = document.querySelector('.privacy-nav');
  const privacyNavContainer = document.querySelector('.privacy-nav-container');
  
  if (window.innerWidth <= 768 && privacyNav && privacyNavContainer) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'nav-toggle-btn';
    toggleBtn.innerHTML = '<i class="fas fa-list"></i> Table of Contents';
    toggleBtn.style.cssText = `
      display: block;
      width: 100%;
      padding: 0.75rem;
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 1rem;
    `;

    const navLinks = privacyNavContainer.querySelector('.privacy-nav-links');
    navLinks.style.display = 'none';

    toggleBtn.addEventListener('click', () => {
      const isVisible = navLinks.style.display !== 'none';
      navLinks.style.display = isVisible ? 'none' : 'flex';
      toggleBtn.innerHTML = isVisible 
        ? '<i class="fas fa-list"></i> Table of Contents'
        : '<i class="fas fa-times"></i> Close';
    });

    privacyNavContainer.insertBefore(toggleBtn, navLinks);
    console.log("✅ Mobile table of contents toggle created");
  }

  // ============================================
  // ANALYTICS TRACKING (OPTIONAL)
  // ============================================

  // Track which sections users spend the most time on
  const sectionViewTimes = {};
  let currentSection = null;
  let sectionStartTime = Date.now();

  const trackSectionView = () => {
    const scrollY = window.pageYOffset;
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop - headerHeight - navHeight;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');
      
      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        if (currentSection !== sectionId) {
          // Section changed
          if (currentSection) {
            const timeSpent = Date.now() - sectionStartTime;
            sectionViewTimes[currentSection] = (sectionViewTimes[currentSection] || 0) + timeSpent;
            console.log(`📊 Time spent on ${currentSection}: ${timeSpent}ms`);
          }
          
          currentSection = sectionId;
          sectionStartTime = Date.now();
        }
      }
    });
  };

  window.addEventListener('scroll', trackSectionView);

  // Log section view times when user leaves the page
  window.addEventListener('beforeunload', () => {
    if (currentSection) {
      const timeSpent = Date.now() - sectionStartTime;
      sectionViewTimes[currentSection] = (sectionViewTimes[currentSection] || 0) + timeSpent;
    }
    console.log("📊 Total section view times:", sectionViewTimes);
  });

  console.log("✅ Section view tracking initialized");

  console.log("🎉 Privacy Policy Page fully initialized!");
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

function showPrivacyNotification(message, type = "info") {
  // Remove any existing notifications
  const existingNotification = document.querySelector('.privacy-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement('div');
  notification.className = `privacy-notification privacy-notification-${type}`;
  
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
    top: calc(var(--header-height) + 20px);
    right: 20px;
    background: ${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-weight: 600;
    z-index: 10001;
    animation: slideInRight 0.3s ease;
    font-family: inherit;
    max-width: 400px;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Export for use in other scripts
window.showPrivacyNotification = showPrivacyNotification;

// ============================================
// ANIMATION STYLES
// ============================================

if (!document.getElementById("privacy-notification-styles")) {
  const style = document.createElement("style");
  style.id = "privacy-notification-styles";
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
      .privacy-notification {
        right: 10px !important;
        left: 10px !important;
        max-width: calc(100% - 20px) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

console.log("✨ Privacy Policy JavaScript Loaded Successfully!");