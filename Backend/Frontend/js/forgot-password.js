// ============================================
// FORGOT PASSWORD PAGE JAVASCRIPT
// Handles password reset request flow
// ============================================

console.log("🔐 Forgot Password Page Loaded!");

// ============================================
// API CONFIGURATION
// ============================================

const API_BASE_URL = window.location.origin + "/api";
const API_ENDPOINTS = {
  forgotPassword: `${API_BASE_URL}/auth/forgot-password`,
  resendResetEmail: `${API_BASE_URL}/auth/resend-reset-email`,
};

// ============================================
// FORM ELEMENTS
// ============================================

const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const emailInput = document.getElementById("email");
const resetBtn = document.getElementById("resetBtn");
const formContainer = document.getElementById("formContainer");
const successContainer = document.getElementById("successContainer");
const sentToEmail = document.getElementById("sentToEmail");
const resendLink = document.getElementById("resendLink");
const resendTimer = document.getElementById("resendTimer");

// ============================================
// STATE MANAGEMENT
// ============================================

let currentEmail = "";
let resendCooldown = 60; // 60 seconds cooldown
let resendInterval = null;

// ============================================
// FORM VALIDATION
// ============================================

function showError(inputId, message) {
  const input = document.getElementById(inputId);
  const errorElement = document.getElementById(inputId + "Error");
  const errorText = errorElement?.querySelector(".error-text");

  if (input) {
    input.classList.add("error");
    input.classList.remove("success");
  }

  if (errorElement && errorText) {
    errorText.textContent = message;
    errorElement.classList.add("show");
  }
}

function showSuccess(inputId) {
  const input = document.getElementById(inputId);
  const errorElement = document.getElementById(inputId + "Error");
  const successElement = document.getElementById(inputId + "Success");

  if (input) {
    input.classList.remove("error");
    input.classList.add("success");
  }

  if (errorElement) {
    errorElement.classList.remove("show");
  }

  if (successElement) {
    successElement.classList.add("show");
  }
}

function clearError(inputId) {
  const input = document.getElementById(inputId);
  const errorElement = document.getElementById(inputId + "Error");
  const successElement = document.getElementById(inputId + "Success");

  if (input) {
    input.classList.remove("error", "success");
  }

  if (errorElement) {
    errorElement.classList.remove("show");
  }

  if (successElement) {
    successElement.classList.remove("show");
  }
}

// Validate Email
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

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
      type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"
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
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 4000);
}

// Add notification animations
if (!document.getElementById("notification-styles")) {
  const style = document.createElement("style");
  style.id = "notification-styles";
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
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
// API CALL HELPER
// ============================================

async function apiCall(endpoint, method = "GET", body = null) {
  try {
    const options = {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, options);
    const data = await response.json();

    return {
      success: response.ok,
      status: response.status,
      data: data,
    };
  } catch (error) {
    console.error("❌ API Error:", error);
    return {
      success: false,
      status: 500,
      data: {
        success: false,
        message: "Network error. Please check your connection and try again.",
      },
    };
  }
}

// ============================================
// SHOW SUCCESS SCREEN
// ============================================

function showSuccessScreen(email) {
  // Hide form, show success
  formContainer.style.display = "none";
  successContainer.classList.add("show");

  // Display email
  sentToEmail.textContent = email;

  // Store email for resend
  currentEmail = email;

  // Start resend cooldown
  startResendCooldown();
}

// ============================================
// RESEND COOLDOWN TIMER
// ============================================

function startResendCooldown() {
  resendCooldown = 60;
  resendLink.classList.add("disabled");
  resendTimer.style.display = "inline";

  resendInterval = setInterval(() => {
    resendCooldown--;

    if (resendCooldown > 0) {
      resendTimer.textContent = `(wait ${resendCooldown}s)`;
    } else {
      clearInterval(resendInterval);
      resendLink.classList.remove("disabled");
      resendTimer.style.display = "none";
    }
  }, 1000);
}

// ============================================
// RESEND RESET EMAIL
// ============================================

async function resendResetEmail() {
  if (resendLink.classList.contains("disabled")) {
    return;
  }

  console.log("🔄 Resending reset email to:", currentEmail);

  // Show loading
  const originalText = resendLink.textContent;
  resendLink.textContent = "Sending...";
  resendLink.classList.add("disabled");

  // Call API
  const response = await apiCall(API_ENDPOINTS.resendResetEmail, "POST", {
    email: currentEmail,
  });

  // Restore text
  resendLink.textContent = originalText;

  if (response.success && response.data.success) {
    showNotification("Reset email sent again!", "success");
    startResendCooldown();
  } else {
    resendLink.classList.remove("disabled");
    showNotification(
      response.data.message || "Failed to resend email. Please try again.",
      "error"
    );
  }
}

// ============================================
// FORM SUBMISSION
// ============================================

if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Clear previous errors
    clearError("email");

    // Get email
    const email = emailInput.value.trim();

    // Validate email
    if (email === "") {
      showError("email", "Please enter your email address");
      emailInput.focus();
      return;
    }

    if (!validateEmail(email)) {
      showError("email", "Please enter a valid email address");
      emailInput.focus();
      return;
    }

    // Show success state
    showSuccess("email");

    // Show loading state
    resetBtn.classList.add("loading");
    resetBtn.disabled = true;

    console.log("📧 Requesting password reset for:", email);

    // Call API
    const response = await apiCall(API_ENDPOINTS.forgotPassword, "POST", {
      email: email,
    });

    // Remove loading state
    resetBtn.classList.remove("loading");
    resetBtn.disabled = false;

    console.log("📥 API Response:", response);

    // Handle response
    if (response.success && response.data.success) {
      // ✅ SUCCESS - Show success screen
      console.log("✅ Reset email sent successfully!");

      showNotification(
        response.data.message || "Reset link sent to your email!",
        "success"
      );

      // Show success screen
      setTimeout(() => {
        showSuccessScreen(email);
      }, 500);
    } else {
      // ❌ ERROR
      const errorMessage =
        response.data.message ||
        "Failed to send reset email. Please try again.";

      console.log("❌ Error:", errorMessage);

      if (response.status === 404) {
        showError("email", "No account found with this email address");
        showNotification(
          "Email not found. Please check and try again.",
          "error"
        );
      } else if (response.status === 400) {
        showError("email", errorMessage);
        showNotification(errorMessage, "error");
      } else if (response.status === 500) {
        showError("email", "Server error. Please try again later.");
        showNotification("Server error. Please try again later.", "error");
      } else {
        showError("email", "An error occurred. Please try again.");
        showNotification(
          "Something went wrong. Please try again later.",
          "error"
        );
      }
    }
  });
}

// ============================================
// REAL-TIME EMAIL VALIDATION
// ============================================

if (emailInput) {
  emailInput.addEventListener("blur", function () {
    if (this.value.trim() !== "") {
      const email = this.value.trim();
      if (!validateEmail(email)) {
        showError("email", "Please enter a valid email address");
      } else {
        showSuccess("email");
      }
    }
  });

  emailInput.addEventListener("input", function () {
    if (this.classList.contains("error")) {
      clearError("email");
    }
  });

  // Auto-focus email input on page load
  setTimeout(() => {
    emailInput.focus();
  }, 500);
}

// ============================================
// RESEND LINK HANDLER
// ============================================

if (resendLink) {
  resendLink.addEventListener("click", function (e) {
    e.preventDefault();
    resendResetEmail();
  });
}

// ============================================
// INPUT ANIMATIONS
// ============================================

const formInputs = document.querySelectorAll(".form-input");

formInputs.forEach((input) => {
  input.addEventListener("focus", function () {
    this.parentElement.style.transform = "scale(1.02)";
    this.parentElement.style.transition = "transform 0.2s ease";
  });

  input.addEventListener("blur", function () {
    this.parentElement.style.transform = "scale(1)";
  });
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener("keydown", function (e) {
  // ESC key goes back to login
  if (e.key === "Escape") {
    window.location.href = "login.html";
  }
});

// ============================================
// PREVENT SPAM SUBMISSIONS
// ============================================

let lastSubmitTime = 0;
const submitCooldown = 3000; // 3 seconds

if (forgotPasswordForm) {
  const originalSubmitHandler = forgotPasswordForm.onsubmit;

  forgotPasswordForm.addEventListener(
    "submit",
    function (e) {
      const now = Date.now();

      if (now - lastSubmitTime < submitCooldown) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showNotification("Please wait before trying again", "error");
        return false;
      }

      lastSubmitTime = now;
    },
    true
  );
}

// ============================================
// CHECK FOR PRE-FILLED EMAIL (from URL params)
// ============================================

function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const emailParam = urlParams.get("email");

  if (emailParam) {
    emailInput.value = emailParam;
    console.log("📧 Email pre-filled from URL:", emailParam);
  }
}

// Check on page load
checkUrlParams();

// ============================================
// ACCESSIBILITY ENHANCEMENTS
// ============================================

if (emailInput) {
  emailInput.setAttribute("aria-label", "Email address");
  emailInput.setAttribute("aria-required", "true");
}

// Announce errors to screen readers
function announceError(message) {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "alert");
  announcement.setAttribute("aria-live", "assertive");
  announcement.style.position = "absolute";
  announcement.style.left = "-10000px";
  announcement.textContent = message;
  document.body.appendChild(announcement);

  setTimeout(() => {
    announcement.remove();
  }, 1000);
}

// ============================================
// EXPORT FUNCTIONS FOR GLOBAL ACCESS
// ============================================

window.showNotification = showNotification;
window.resendResetEmail = resendResetEmail;

console.log("🎉 Forgot password page fully loaded!");
console.log("🔗 API Base URL:", API_BASE_URL);
console.log("📋 Available endpoints:", API_ENDPOINTS);
