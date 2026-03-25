// ============================================
// RESET PASSWORD PAGE JAVASCRIPT
// Handles password reset with token verification
// ============================================

console.log("🔐 Reset Password Page Loaded!");

// ============================================
// API CONFIGURATION
// ============================================

const API_BASE_URL = window.location.origin + "/api";
const API_ENDPOINTS = {
  verifyToken: `${API_BASE_URL}/auth/verify-reset-token`,
  resetPassword: `${API_BASE_URL}/auth/reset-password`,
};

// ============================================
// FORM ELEMENTS
// ============================================

const resetPasswordForm = document.getElementById("resetPasswordForm");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const newPasswordToggle = document.getElementById("newPasswordToggle");
const confirmPasswordToggle = document.getElementById("confirmPasswordToggle");
const resetBtn = document.getElementById("resetBtn");

// Containers
const verifyingContainer = document.getElementById("verifyingContainer");
const invalidContainer = document.getElementById("invalidContainer");
const formContainer = document.getElementById("formContainer");
const successContainer = document.getElementById("successContainer");
const invalidMessage = document.getElementById("invalidMessage");

// Password strength elements
const passwordStrength = document.getElementById("passwordStrength");
const strengthBarFill = document.getElementById("strengthBarFill");
const strengthText = document.getElementById("strengthText");

// Password requirements
const reqLength = document.getElementById("req-length");
const reqUppercase = document.getElementById("req-uppercase");
const reqLowercase = document.getElementById("req-lowercase");
const reqNumber = document.getElementById("req-number");

// ============================================
// STATE MANAGEMENT
// ============================================

let resetToken = "";
let tokenVerified = false;

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

// ============================================
// PASSWORD VALIDATION
// ============================================

function checkPasswordRequirements(password) {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  // Update requirement items
  if (reqLength) reqLength.classList.toggle("met", requirements.length);
  if (reqUppercase)
    reqUppercase.classList.toggle("met", requirements.uppercase);
  if (reqLowercase)
    reqLowercase.classList.toggle("met", requirements.lowercase);
  if (reqNumber) reqNumber.classList.toggle("met", requirements.number);

  return requirements;
}

function calculatePasswordStrength(password) {
  if (!password) {
    return { strength: 0, label: "" };
  }

  let strength = 0;

  // Length check
  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 10;

  // Character variety
  if (/[a-z]/.test(password)) strength += 15;
  if (/[A-Z]/.test(password)) strength += 15;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 20; // Special characters

  // Determine label
  let label = "";
  if (strength < 40) {
    label = "weak";
  } else if (strength < 70) {
    label = "medium";
  } else {
    label = "strong";
  }

  return { strength, label };
}

function updatePasswordStrength(password) {
  if (!password || !passwordStrength) {
    if (passwordStrength) passwordStrength.style.display = "none";
    return;
  }

  passwordStrength.style.display = "block";

  const { strength, label } = calculatePasswordStrength(password);

  // Update strength bar
  if (strengthBarFill) {
    strengthBarFill.className = `strength-bar-fill ${label}`;
  }

  // Update strength text
  if (strengthText) {
    strengthText.className = `strength-text ${label}`;
    strengthText.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  }
}

function validatePassword(password) {
  const requirements = checkPasswordRequirements(password);

  // All requirements must be met
  return (
    requirements.length &&
    requirements.uppercase &&
    requirements.lowercase &&
    requirements.number
  );
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

    console.log("🌐 Making API call:", endpoint);
    console.log("📤 Request body:", body);

    const response = await fetch(endpoint, options);
    const data = await response.json();

    console.log("📥 Response status:", response.status);
    console.log("📥 Response data:", data);

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
// TOKEN VERIFICATION
// ============================================

async function verifyResetToken(token) {
  console.log("🔍 Verifying reset token...");

  const response = await apiCall(
    `${API_ENDPOINTS.verifyToken}?token=${encodeURIComponent(token)}`
  );

  console.log("📥 Verification response:", response);

  if (response.success && response.data.success) {
    console.log("✅ Token is valid!");
    tokenVerified = true;

    // Hide verifying, show form
    if (verifyingContainer) verifyingContainer.classList.remove("show");
    if (formContainer) formContainer.classList.add("show");

    // Focus on password input
    setTimeout(() => {
      if (newPasswordInput) newPasswordInput.focus();
    }, 300);

    return true;
  } else {
    console.log("❌ Token verification failed");
    tokenVerified = false;

    // Show error container
    if (verifyingContainer) verifyingContainer.classList.remove("show");
    if (invalidContainer) invalidContainer.classList.add("show");

    // Update error message
    const errorMsg =
      response.data.message ||
      "This password reset link is invalid or has expired.";
    if (invalidMessage) invalidMessage.textContent = errorMsg;

    return false;
  }
}

// ============================================
// GET TOKEN FROM URL
// ============================================

function getTokenFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  if (!token) {
    console.log("❌ No token found in URL");
    if (verifyingContainer) verifyingContainer.classList.remove("show");
    if (invalidContainer) invalidContainer.classList.add("show");
    if (invalidMessage) {
      invalidMessage.textContent =
        "No reset token found. Please use the link from your email.";
    }
    return null;
  }

  console.log("🔑 Token found:", token.substring(0, 30) + "...");
  return token;
}

// ============================================
// PASSWORD VISIBILITY TOGGLE
// ============================================

if (newPasswordToggle) {
  newPasswordToggle.addEventListener("click", function () {
    const icon = this.querySelector("i");

    if (newPasswordInput.type === "password") {
      newPasswordInput.type = "text";
      icon.classList.remove("fa-eye");
      icon.classList.add("fa-eye-slash");
    } else {
      newPasswordInput.type = "password";
      icon.classList.remove("fa-eye-slash");
      icon.classList.add("fa-eye");
    }
  });
}

if (confirmPasswordToggle) {
  confirmPasswordToggle.addEventListener("click", function () {
    const icon = this.querySelector("i");

    if (confirmPasswordInput.type === "password") {
      confirmPasswordInput.type = "text";
      icon.classList.remove("fa-eye");
      icon.classList.add("fa-eye-slash");
    } else {
      confirmPasswordInput.type = "password";
      icon.classList.remove("fa-eye-slash");
      icon.classList.add("fa-eye");
    }
  });
}

// ============================================
// REAL-TIME PASSWORD VALIDATION
// ============================================

if (newPasswordInput) {
  newPasswordInput.addEventListener("input", function () {
    const password = this.value;

    // Clear errors
    clearError("newPassword");

    // Check requirements
    checkPasswordRequirements(password);

    // Update strength indicator
    updatePasswordStrength(password);

    // Check if confirm password matches
    if (confirmPasswordInput && confirmPasswordInput.value) {
      if (password === confirmPasswordInput.value) {
        showSuccess("confirmPassword");
      } else {
        clearError("confirmPassword");
      }
    }
  });

  newPasswordInput.addEventListener("blur", function () {
    const password = this.value;

    if (password && !validatePassword(password)) {
      showError("newPassword", "Password must meet all requirements");
    }
  });
}

if (confirmPasswordInput) {
  confirmPasswordInput.addEventListener("input", function () {
    const password = newPasswordInput ? newPasswordInput.value : "";
    const confirmPassword = this.value;

    clearError("confirmPassword");

    if (confirmPassword && password === confirmPassword) {
      showSuccess("confirmPassword");
    }
  });

  confirmPasswordInput.addEventListener("blur", function () {
    const password = newPasswordInput ? newPasswordInput.value : "";
    const confirmPassword = this.value;

    if (confirmPassword && password !== confirmPassword) {
      showError("confirmPassword", "Passwords do not match");
    }
  });
}

// ============================================
// FORM SUBMISSION
// ============================================

if (resetPasswordForm) {
  resetPasswordForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!tokenVerified) {
      showNotification(
        "Invalid reset token. Please request a new link.",
        "error"
      );
      return;
    }

    // Clear previous errors
    clearError("newPassword");
    clearError("confirmPassword");

    // Get values
    const newPassword = newPasswordInput ? newPasswordInput.value : "";
    const confirmPassword = confirmPasswordInput
      ? confirmPasswordInput.value
      : "";

    // Validate new password
    if (!newPassword) {
      showError("newPassword", "Please enter a new password");
      if (newPasswordInput) newPasswordInput.focus();
      return;
    }

    if (!validatePassword(newPassword)) {
      showError("newPassword", "Password must meet all requirements");
      if (newPasswordInput) newPasswordInput.focus();
      return;
    }

    // Validate confirm password
    if (!confirmPassword) {
      showError("confirmPassword", "Please confirm your password");
      if (confirmPasswordInput) confirmPasswordInput.focus();
      return;
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      showError("confirmPassword", "Passwords do not match");
      if (confirmPasswordInput) confirmPasswordInput.focus();
      return;
    }

    // Show loading state
    if (resetBtn) {
      resetBtn.classList.add("loading");
      resetBtn.disabled = true;
    }

    console.log("🔐 Resetting password...");

    // Call API
    const response = await apiCall(API_ENDPOINTS.resetPassword, "POST", {
      token: resetToken,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });

    // Remove loading state
    if (resetBtn) {
      resetBtn.classList.remove("loading");
      resetBtn.disabled = false;
    }

    console.log("📥 Reset response:", response);

    // Handle response
    if (response.success && response.data.success) {
      // ✅ SUCCESS
      console.log("✅ Password reset successful!");

      showNotification(
        response.data.message || "Password reset successful!",
        "success"
      );

      // Hide form, show success
      if (formContainer) formContainer.classList.remove("show");
      if (successContainer) successContainer.classList.add("show");

      // Redirect to login after 3 seconds
      setTimeout(() => {
        window.location.href = "login.html";
      }, 3000);
    } else {
      // ❌ ERROR
      const errorMessage =
        response.data.message || "Failed to reset password. Please try again.";

      console.log("❌ Error:", errorMessage);

      if (response.status === 401 || response.status === 400) {
        // Invalid or expired token
        showNotification(errorMessage, "error");

        // Show invalid container
        if (formContainer) formContainer.classList.remove("show");
        if (invalidContainer) invalidContainer.classList.add("show");
        if (invalidMessage) invalidMessage.textContent = errorMessage;
      } else if (response.status === 500) {
        showError("newPassword", "Server error. Please try again later.");
        showNotification("Server error. Please try again later.", "error");
      } else {
        showError("newPassword", errorMessage);
        showNotification(errorMessage, "error");
      }
    }
  });
}

// ============================================
// INPUT ANIMATIONS
// ============================================

const formInputs = document.querySelectorAll(".form-input");

formInputs.forEach((input) => {
  input.addEventListener("focus", function () {
    if (this.parentElement) {
      this.parentElement.style.transform = "scale(1.02)";
      this.parentElement.style.transition = "transform 0.2s ease";
    }
  });

  input.addEventListener("blur", function () {
    if (this.parentElement) {
      this.parentElement.style.transform = "scale(1)";
    }
  });
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener("keydown", function (e) {
  // ESC key goes to login
  if (e.key === "Escape") {
    window.location.href = "login.html";
  }
});

// ============================================
// INITIALIZE ON PAGE LOAD
// ============================================

window.addEventListener("DOMContentLoaded", async () => {
  console.log("🔄 Page loaded, checking for reset token...");

  // Get token from URL
  resetToken = getTokenFromUrl();

  if (!resetToken) {
    return;
  }

  // Verify token
  await verifyResetToken(resetToken);
});

// ============================================
// PREVENT SPAM SUBMISSIONS
// ============================================

let lastSubmitTime = 0;
const submitCooldown = 3000; // 3 seconds

if (resetPasswordForm) {
  resetPasswordForm.addEventListener(
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
// ACCESSIBILITY ENHANCEMENTS
// ============================================

if (newPasswordInput) {
  newPasswordInput.setAttribute("aria-label", "New password");
  newPasswordInput.setAttribute("aria-required", "true");
}

if (confirmPasswordInput) {
  confirmPasswordInput.setAttribute("aria-label", "Confirm password");
  confirmPasswordInput.setAttribute("aria-required", "true");
}

// ============================================
// EXPORT FUNCTIONS FOR GLOBAL ACCESS
// ============================================

window.showNotification = showNotification;
window.verifyResetToken = verifyResetToken;

console.log("🎉 Reset password page fully loaded!");
console.log("🔗 API Base URL:", API_BASE_URL);
console.log("📋 Available endpoints:", API_ENDPOINTS);
