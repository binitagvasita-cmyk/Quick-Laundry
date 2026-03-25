// ============================================
// ENHANCED LOGIN PAGE JAVASCRIPT
// Connects to Flask Backend API
// ============================================

console.log("🔐 Quick Laundry Login Page Loaded!");

// ============================================
// API CONFIGURATION
// ============================================

const API_BASE_URL = window.location.origin + "/api";
const API_ENDPOINTS = {
  login: `${API_BASE_URL}/auth/login`,
  checkEmail: `${API_BASE_URL}/auth/check-email`,
  googleLogin: `${API_BASE_URL}/auth/google/login`,
};

// ============================================
// THEME MANAGEMENT
// ============================================

const themeToggle = document.getElementById("themeToggle");
const htmlElement = document.documentElement;

// Load theme on page load
function loadTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  htmlElement.setAttribute("data-theme", savedTheme);
}

// Toggle theme and save to storage
function toggleTheme() {
  const currentTheme = htmlElement.getAttribute("data-theme");
  const newTheme = currentTheme === "light" ? "dark" : "light";

  htmlElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);

  // Add rotation animation
  if (themeToggle) {
    themeToggle.style.transform = "rotate(360deg)";
    setTimeout(() => {
      themeToggle.style.transform = "rotate(0deg)";
    }, 400);
  }
}

if (themeToggle) {
  themeToggle.addEventListener("click", toggleTheme);
}

loadTheme();

// ============================================
// FORM ELEMENTS
// ============================================

const loginForm = document.getElementById("loginForm");
const loginClose = document.getElementById("loginClose");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const passwordToggle = document.getElementById("passwordToggle");
const rememberMeCheckbox = document.getElementById("rememberMe");
const forgotPasswordLink = document.getElementById("forgotPassword");
const googleLoginBtn = document.getElementById("googleLogin");
const loginBtn = document.getElementById("loginBtn");

// ============================================
// CLOSE LOGIN PAGE
// ============================================

function closeLoginPage() {
  const isInIframe = window.self !== window.top;

  if (isInIframe) {
    // Send close message to parent
    window.parent.postMessage(
      {
        type: "CLOSE_MODAL",
        reason: "user_closed",
      },
      "*"
    );
  } else {
    // Redirect to home page
    window.location.href = "home-content.html";
  }
}

if (loginClose) {
  loginClose.addEventListener("click", closeLoginPage);
}

// ============================================
// PASSWORD VISIBILITY TOGGLE
// ============================================

if (passwordToggle) {
  passwordToggle.addEventListener("click", function () {
    const icon = this.querySelector("i");

    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      icon.classList.remove("fa-eye");
      icon.classList.add("fa-eye-slash");
    } else {
      passwordInput.type = "password";
      icon.classList.remove("fa-eye-slash");
      icon.classList.add("fa-eye");
    }
  });
}

// ============================================
// FORM VALIDATION
// ============================================

function showError(inputId, message) {
  const input = document.getElementById(inputId);
  const errorElement = document.getElementById(inputId + "Error");

  if (input) {
    input.classList.add("error");
    input.classList.remove("success");
  }

  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add("show");
  }
}

function showSuccess(inputId) {
  const input = document.getElementById(inputId);
  const errorElement = document.getElementById(inputId + "Error");

  if (input) {
    input.classList.remove("error");
    input.classList.add("success");
  }

  if (errorElement) {
    errorElement.classList.remove("show");
  }
}

function clearError(inputId) {
  const input = document.getElementById(inputId);
  const errorElement = document.getElementById(inputId + "Error");

  if (input) {
    input.classList.remove("error", "success");
  }

  if (errorElement) {
    errorElement.classList.remove("show");
  }
}

// Validate Email
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate Password
function validatePassword(password) {
  return password.length >= 6;
}

// Validate Form
function validateLoginForm() {
  let isValid = true;

  // Email validation
  const email = emailInput.value.trim();
  if (email === "") {
    showError("email", "Please enter your email address");
    isValid = false;
  } else if (!validateEmail(email)) {
    showError("email", "Please enter a valid email address");
    isValid = false;
  } else {
    showSuccess("email");
  }

  // Password validation
  const password = passwordInput.value;
  if (password === "") {
    showError("password", "Please enter your password");
    isValid = false;
  } else if (!validatePassword(password)) {
    showError("password", "Password must be at least 6 characters");
    isValid = false;
  } else {
    showSuccess("password");
  }

  return isValid;
}

// ============================================
// REAL-TIME VALIDATION
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
}

if (passwordInput) {
  passwordInput.addEventListener("blur", function () {
    if (this.value !== "") {
      const password = this.value;
      if (!validatePassword(password)) {
        showError("password", "Password must be at least 6 characters");
      } else {
        showSuccess("password");
      }
    }
  });

  passwordInput.addEventListener("input", function () {
    if (this.classList.contains("error")) {
      clearError("password");
    }
  });
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
        message: "Network error. Please check your connection.",
      },
    };
  }
}

// ============================================
// FORM SUBMISSION - ENHANCED WITH API
// ============================================

if (loginForm) {
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Validate form
    if (!validateLoginForm()) {
      showNotification("Please fix the errors in the form", "error");
      return;
    }

    // Show loading state
    loginBtn.classList.add("loading");
    loginBtn.disabled = true;

    // Get form data
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const rememberMe = rememberMeCheckbox.checked;

    console.log("📧 Login attempt:", { email, rememberMe });

    // Call Flask API
    const response = await apiCall(API_ENDPOINTS.login, "POST", {
      email: email,
      password: password,
    });

    // Remove loading state
    loginBtn.classList.remove("loading");
    loginBtn.disabled = false;

    console.log("📥 API Response:", response);

    // Handle response
    if (response.success && response.data.success) {
      // ✅ LOGIN SUCCESS
      const userData = response.data.data;

      // Store user data in localStorage
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userName", userData.user.full_name);
      localStorage.setItem("userEmail", userData.user.email);
      localStorage.setItem("jwtToken", userData.token);
      localStorage.setItem("loginMethod", "email");

      // Store remember me preference
      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
        localStorage.setItem("savedEmail", email);
      } else {
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("savedEmail");
      }

      // Dispatch custom event for iframe communication
      const loginSuccessEvent = new CustomEvent("loginSuccess", {
        detail: {
          userName: userData.user.full_name,
          userEmail: userData.user.email,
          token: userData.token,
          method: "email",
        },
      });
      window.dispatchEvent(loginSuccessEvent);

      // Show success notification
      showNotification(`Welcome back, ${userData.user.full_name}!`, "success");

      // Check if in iframe or standalone page
      const isInIframe = window.self !== window.top;

      if (isInIframe) {
        // If in iframe, parent window will handle the redirect via AUTH_SUCCESS message
        // The message is sent via loginSuccess event listener in login.html
        console.log("✅ Login successful! (iframe mode - parent will handle)");
      } else {
        // If standalone page, redirect to home page after delay
        setTimeout(() => {
          window.location.href = "home-content.html";
        }, 1500);
        console.log("✅ Login successful! (redirecting to home)");
      }
    } else {
      // ❌ LOGIN FAILED
      handleLoginError(response);
    }
  });
}

// ============================================
// HANDLE LOGIN ERRORS
// ============================================

function handleLoginError(response) {
  const errorMessage = response.data.message || "Login failed";
  const statusCode = response.status;

  console.log("❌ Login error:", errorMessage, "Status:", statusCode);

  // Clear previous errors
  clearError("email");
  clearError("password");

  // Hide info banner by default
  const infoBanner = document.getElementById("notRegisteredBanner");
  if (infoBanner) {
    infoBanner.classList.remove("show");
  }

  // Handle different error scenarios
  if (statusCode === 401) {
    // Unauthorized - Invalid credentials
    showError("email", "Invalid email or password");
    showError("password", "Invalid email or password");
    showNotification("Invalid email or password", "error");
  } else if (statusCode === 403) {
    // Forbidden - Account issues
    if (errorMessage.toLowerCase().includes("deactivated")) {
      showError("email", "Your account has been deactivated");
      showNotification(
        "Your account has been deactivated. Please contact support.",
        "error"
      );
    } else if (errorMessage.toLowerCase().includes("not verified")) {
      showError("email", "Please verify your email first");
      showNotification(
        "Please verify your email before logging in. Check your inbox.",
        "error"
      );
    } else {
      showError("email", errorMessage);
      showNotification(errorMessage, "error");
    }
  } else if (statusCode === 404) {
    // Not found - User doesn't exist
    showError("email", "No account found with this email");
    showNotification("No account found. Please register first.", "error");

    // Show info banner for not registered users
    if (infoBanner) {
      infoBanner.classList.add("show");
    }

    // Show register suggestion after 2 seconds
    setTimeout(() => {
      showNotification("Click 'Sign Up' below to create an account", "info");
    }, 2000);
  } else if (statusCode === 400) {
    // Bad request - Validation error
    showError("email", errorMessage);
    showNotification(errorMessage, "error");
  } else {
    // Other errors
    showError("email", "An error occurred. Please try again.");
    showNotification("Something went wrong. Please try again later.", "error");
  }
}

// ============================================
// GOOGLE LOGIN
// ============================================

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async function () {
    console.log("🔵 Google Login clicked");

    // Disable button and show loading
    googleLoginBtn.disabled = true;
    const originalHTML = googleLoginBtn.innerHTML;
    googleLoginBtn.innerHTML = `
      <i class="fab fa-google"></i>
      <span>Connecting to Google...</span>
    `;

    try {
      // Store current page as return URL
      const returnUrl = window.location.pathname || "/home-content.html";

      // Build the Google login URL with return URL parameter
      const googleLoginUrl = `${
        API_ENDPOINTS.googleLogin
      }?return_url=${encodeURIComponent(returnUrl)}`;

      console.log("🔗 Redirecting to Google OAuth:", googleLoginUrl);

      // Redirect to Flask backend which will redirect to Google
      window.location.href = googleLoginUrl;
    } catch (error) {
      console.error("❌ Google login error:", error);
      showNotification(
        "Failed to connect to Google. Please try again.",
        "error"
      );

      // Reset button on error
      googleLoginBtn.disabled = false;
      googleLoginBtn.innerHTML = originalHTML;
    }
  });
}

// ============================================
// HANDLE GOOGLE LOGIN CALLBACK
// ============================================

function handleGoogleCallback() {
  /**
   * Handle Google OAuth callback parameters
   * Called when user is redirected back from Google via Flask
   */
  const urlParams = new URLSearchParams(window.location.search);

  // Check for Google login success
  const token = urlParams.get("token");
  const userName = urlParams.get("user_name");
  const userEmail = urlParams.get("user_email");
  const isGoogleLogin = urlParams.get("google_login");

  if (token && isGoogleLogin === "true") {
    console.log("✅ Google login successful!");
    console.log("👤 User:", userName, "(" + userEmail + ")");

    // Store user data in localStorage
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userName", userName);
    localStorage.setItem("userEmail", userEmail);
    localStorage.setItem("jwtToken", token);
    localStorage.setItem("loginMethod", "google");

    // Show success notification
    showNotification(`Welcome, ${userName}!`, "success");

    // Dispatch login success event for iframe communication
    const loginSuccessEvent = new CustomEvent("loginSuccess", {
      detail: {
        userName: userName,
        userEmail: userEmail,
        token: token,
        method: "google",
      },
    });
    window.dispatchEvent(loginSuccessEvent);

    // Clean URL parameters (remove query string)
    window.history.replaceState({}, document.title, window.location.pathname);

    // Redirect to home page after short delay
    setTimeout(() => {
      window.location.href = "home-content.html";
    }, 1500);

    return true;
  }

  // Check for Google login error
  const error = urlParams.get("error");
  const reason = urlParams.get("reason");

  if (error) {
    console.error("❌ Google login error:", error);

    let errorMessage = "Google login failed. Please try again.";

    // Map error codes to user-friendly messages
    const errorMessages = {
      google_auth_failed: "Google authentication failed. Please try again.",
      missing_code: "Authorization code was not received from Google.",
      invalid_state: "Security validation failed. Please try again.",
      token_exchange_failed: "Failed to complete authentication with Google.",
      no_access_token: "Failed to receive access token from Google.",
      user_info_failed: "Failed to retrieve your Google account information.",
      user_creation_failed: "Failed to create your account. Please try again.",
      token_generation_failed: "Failed to generate authentication token.",
      callback_exception: "An unexpected error occurred. Please try again.",
      google_not_configured:
        "Google login is temporarily unavailable. Please use email/password login.",
    };

    errorMessage = errorMessages[error] || errorMessage;

    // Add reason if provided
    if (reason) {
      errorMessage += ` (${reason})`;
    }

    showNotification(errorMessage, "error");

    // Show alternative login method suggestion
    setTimeout(() => {
      showNotification("You can still login with email and password", "info");
    }, 3000);

    // Clean URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);

    return false;
  }

  return false;
}

// ============================================
// FORGOT PASSWORD LINK
// ============================================

if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", function (e) {
    e.preventDefault();
    window.location.href = "forgot-password.html";
  });
}

// ============================================
// REMEMBER ME FUNCTIONALITY
// ============================================

function loadRememberedEmail() {
  const rememberMe = localStorage.getItem("rememberMe") === "true";
  const savedEmail = localStorage.getItem("savedEmail");

  if (rememberMe && savedEmail && emailInput) {
    emailInput.value = savedEmail;
    if (rememberMeCheckbox) {
      rememberMeCheckbox.checked = true;
    }
  }
}

// ============================================
// CHECK IF ALREADY LOGGED IN
// ============================================

function checkIfLoggedIn() {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const jwtToken = localStorage.getItem("jwtToken");

  if (isLoggedIn && jwtToken) {
    console.log("✅ User already logged in!");

    // Check if page is loaded in iframe
    const isInIframe = window.self !== window.top;

    if (isInIframe) {
      // If in iframe (modal), send notification to PARENT and close modal
      console.log(
        "📤 In iframe - sending notification and close message to parent"
      );

      // Send notification message to parent (don't show in iframe)
      window.parent.postMessage(
        {
          type: "SHOW_NOTIFICATION",
          data: {
            message: "You are already logged in!",
            type: "info",
          },
        },
        "*"
      );

      // Close modal immediately (no delay needed)
      setTimeout(() => {
        window.parent.postMessage(
          {
            type: "CLOSE_MODAL",
            reason: "already_logged_in",
          },
          "*"
        );
      }, 100); // Small delay to ensure notification is shown first
    } else {
      // If standalone page, redirect to homepage
      console.log("🔄 Standalone page - redirecting to homepage");
      showNotification("You are already logged in!", "info");

      setTimeout(() => {
        window.location.href = "home-content.html";
      }, 1000);
    }
  }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener("keydown", function (e) {
  // ESC key closes login page
  if (e.key === "Escape") {
    closeLoginPage();
  }

  // Enter key submits form
  if (e.key === "Enter" && document.activeElement.tagName !== "BUTTON") {
    if (loginForm) {
      e.preventDefault();
      loginForm.dispatchEvent(new Event("submit"));
    }
  }
});

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
// PREVENT SPAM SUBMISSIONS
// ============================================

let lastSubmitTime = 0;
const submitCooldown = 3000; // 3 seconds

if (loginForm) {
  loginForm.addEventListener(
    "submit",
    function (e) {
      const now = Date.now();

      if (now - lastSubmitTime < submitCooldown && now - lastSubmitTime > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showNotification("Please wait before trying again", "error");
        return false;
      }

      lastSubmitTime = now;
    },
    true
  ); // Use capture phase
}

// ============================================
// ACCESSIBILITY ENHANCEMENTS
// ============================================

if (emailInput) {
  emailInput.setAttribute("aria-label", "Email address");
  emailInput.setAttribute("aria-required", "true");
}

if (passwordInput) {
  passwordInput.setAttribute("aria-label", "Password");
  passwordInput.setAttribute("aria-required", "true");
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
// PAGE INITIALIZATION
// ============================================

// Handle page load events
window.addEventListener("DOMContentLoaded", () => {
  console.log("🔵 DOM Content Loaded - Initializing login page...");

  // Load remembered email
  loadRememberedEmail();

  // Check if already logged in
  checkIfLoggedIn();

  // Handle Google OAuth callback
  const googleCallbackHandled = handleGoogleCallback();

  if (googleCallbackHandled) {
    console.log("✅ Google OAuth callback handled successfully");
  } else {
    console.log("ℹ️ No Google OAuth callback detected");
  }
});

window.addEventListener("load", () => {
  console.log("🔵 Window loaded - Final initialization...");

  // Handle Google OAuth callback again (in case DOMContentLoaded was missed)
  const googleCallbackHandled = handleGoogleCallback();

  // Only auto-focus email if not handling Google callback
  if (!googleCallbackHandled && emailInput && !emailInput.value) {
    setTimeout(() => {
      emailInput.focus();
    }, 500);
  }
});

// ============================================
// EXPORT FUNCTIONS FOR GLOBAL ACCESS
// ============================================

window.showNotification = showNotification;
window.closeLoginPage = closeLoginPage;
window.handleGoogleCallback = handleGoogleCallback;

// ============================================
// FINAL LOGS
// ============================================

console.log("🎉 Enhanced login page fully loaded!");
console.log("🔗 API Base URL:", API_BASE_URL);
console.log("📋 Available endpoints:", API_ENDPOINTS);
console.log("🔵 Google OAuth integration enabled!");
