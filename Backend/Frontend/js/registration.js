// ============================================
// REGISTRATION PAGE JAVASCRIPT - UPDATED FLOW
// Registration without auto-login - redirect to login page
// ============================================

console.log("🧺 Quick Laundry Registration Page Loaded!");

// ============================================
// API CONFIGURATION
// ============================================

const API_BASE_URL = window.location.origin + "/api";

const API_ENDPOINTS = {
  REGISTER: `${API_BASE_URL}/auth/register`,
  CHECK_EMAIL: `${API_BASE_URL}/auth/check-email`,
  CHECK_PHONE: `${API_BASE_URL}/auth/check-phone`,
  VERIFY_OTP: `${API_BASE_URL}/auth/verify-otp`,
  RESEND_OTP: `${API_BASE_URL}/auth/resend-otp`,
};

// ============================================
// THEME MANAGEMENT
// ============================================

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

function loadTheme() {
  const savedTheme = storage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
}

loadTheme();

const Security = {
  mask_email: function (email) {
    if (!email || !email.includes("@")) {
      return email;
    }

    const [local, domain] = email.split("@");

    if (local.length <= 2) {
      return local[0] + "*@" + domain;
    } else {
      return (
        local.substring(0, 2) + "*".repeat(local.length - 2) + "@" + domain
      );
    }
  },
};

window.addEventListener("message", function (event) {
  if (event.data && event.data.type === "theme-change") {
    const newTheme = event.data.theme;
    document.documentElement.setAttribute("data-theme", newTheme);
    storage.setItem("theme", newTheme);
  }
});

window.addEventListener("storage", function (e) {
  if (e.key === "theme") {
    const newTheme = e.newValue || "light";
    document.documentElement.setAttribute("data-theme", newTheme);
  }
});

// ============================================
// GLOBAL VARIABLES
// ============================================

let currentStep = 1;
const totalSteps = 4;
let otpTimer = null;
let otpTimeRemaining = 60;
let tempUserId = null;

const registrationForm = document.getElementById("registrationForm");
const registrationClose = document.getElementById("registrationClose");
const loginLink = document.getElementById("loginLink");
const nextButtons = document.querySelectorAll(".btn-next");
const prevButtons = document.querySelectorAll(".btn-prev");
const submitButton = document.getElementById("submitBtn");
const otpInputs = document.querySelectorAll(".otp-input");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const resendOtpBtn = document.getElementById("resendOtpBtn");
const timerCount = document.getElementById("timerCount");
const passwordToggles = document.querySelectorAll(".password-toggle");

// ============================================
// API HELPER FUNCTIONS
// ============================================

async function apiRequest(url, method = "GET", data = null) {
  try {
    const options = {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (data && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(data);
    }

    console.log(`📤 API Request: ${method} ${url}`, data);

    const response = await fetch(url, options);
    const result = await response.json();

    console.log(`📥 API Response: ${response.status}`, result);

    return {
      success: response.ok,
      status: response.status,
      data: result,
    };
  } catch (error) {
    console.error("❌ API Request Error:", error);
    return {
      success: false,
      status: 0,
      data: { message: "Network error. Please check your connection." },
    };
  }
}

function showNotification(message, type = "info") {
  console.log(`📢 ${type.toUpperCase()}: ${message}`);

  if (window.notify) {
    if (type === "error") {
      window.notify.error(message);
    } else if (type === "success") {
      window.notify.success(message);
    } else if (type === "warning") {
      window.notify.warning(message);
    } else {
      window.notify.info(message);
    }
  } else {
    alert(`${type === "error" ? "Error" : "Success"}: ${message}`);
  }
}

// ============================================
// CLOSE REGISTRATION MODAL
// ============================================

function closeRegistrationModal() {
  const registrationOverlay = document.querySelector(".registration-overlay");
  registrationOverlay.classList.remove("active");
  setTimeout(() => {
    window.location.href = "home.html";
  }, 300);
}

if (registrationClose) {
  registrationClose.addEventListener("click", closeRegistrationModal);
}

if (loginLink) {
  loginLink.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "login.html";
  });
}

// ============================================
// STEP NAVIGATION
// ============================================

function updateProgressSteps(step) {
  const progressSteps = document.querySelectorAll(".progress-step");
  const progressLines = document.querySelectorAll(".progress-line");

  progressSteps.forEach((stepEl, index) => {
    const stepNumber = index + 1;
    if (stepNumber < step) {
      stepEl.classList.add("completed");
      stepEl.classList.remove("active");
    } else if (stepNumber === step) {
      stepEl.classList.add("active");
      stepEl.classList.remove("completed");
    } else {
      stepEl.classList.remove("active", "completed");
    }
  });

  progressLines.forEach((line, index) => {
    if (index < step - 1) {
      line.style.background =
        "linear-gradient(90deg, var(--gradient-start), var(--gradient-end))";
    } else {
      line.style.background = "var(--border-color)";
    }
  });
}

function showStep(step) {
  const formSteps = document.querySelectorAll(".form-step");
  formSteps.forEach((stepEl) => {
    stepEl.classList.remove("active");
  });

  const currentStepEl = document.querySelector(
    `.form-step[data-step="${step}"]`
  );
  if (currentStepEl) {
    currentStepEl.classList.add("active");
  }

  currentStep = step;
  updateProgressSteps(step);

  const registrationForm = document.querySelector(".registration-form");
  if (registrationForm) {
    registrationForm.scrollTop = 0;
  }
}

nextButtons.forEach((button) => {
  button.addEventListener("click", function () {
    const nextStep = parseInt(this.getAttribute("data-next"));
    if (validateStep(currentStep)) {
      showStep(nextStep);
    }
  });
});

prevButtons.forEach((button) => {
  button.addEventListener("click", function () {
    const prevStep = parseInt(this.getAttribute("data-prev"));
    showStep(prevStep);
  });
});

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

function showSuccess(inputId, message = "") {
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

  if (successElement && message) {
    successElement.textContent = message;
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

function validateStep1() {
  let isValid = true;

  const fullName = document.getElementById("fullName").value.trim();
  if (fullName === "") {
    showError("fullName", "Please enter your full name");
    isValid = false;
  } else if (fullName.length < 3) {
    showError("fullName", "Name must be at least 3 characters");
    isValid = false;
  } else if (!/^[a-zA-Z\s]+$/.test(fullName)) {
    showError("fullName", "Name can only contain letters and spaces");
    isValid = false;
  } else {
    clearError("fullName");
  }

  const email = document.getElementById("email").value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email === "") {
    showError("email", "Please enter your email address");
    isValid = false;
  } else if (!emailRegex.test(email)) {
    showError("email", "Please enter a valid email address");
    isValid = false;
  } else {
    showSuccess("email", "✓ Valid email");
  }

  const phone = document.getElementById("phone").value.trim();
  const phoneRegex = /^[6-9]\d{9}$/;
  if (phone === "") {
    showError("phone", "Please enter your phone number");
    isValid = false;
  } else if (!phoneRegex.test(phone)) {
    showError("phone", "Please enter a valid 10-digit phone number");
    isValid = false;
  } else {
    clearError("phone");
  }

  const password = document.getElementById("password").value;
  if (password === "") {
    showError("password", "Please create a password");
    isValid = false;
  } else if (password.length < 8) {
    showError("password", "Password must be at least 8 characters");
    isValid = false;
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    showError(
      "password",
      "Password must contain uppercase, lowercase, and number"
    );
    isValid = false;
  } else {
    clearError("password");
  }

  const confirmPassword = document.getElementById("confirmPassword").value;
  if (confirmPassword === "") {
    showError("confirmPassword", "Please confirm your password");
    isValid = false;
  } else if (password !== confirmPassword) {
    showError("confirmPassword", "Passwords do not match");
    isValid = false;
  } else {
    clearError("confirmPassword");
  }

  return isValid;
}

function validateStep2() {
  let isValid = true;

  const address = document.getElementById("address").value.trim();
  if (address === "") {
    showError("address", "Please enter your complete address");
    isValid = false;
  } else if (address.length < 10) {
    showError(
      "address",
      "Please enter a complete address (at least 10 characters)"
    );
    isValid = false;
  } else {
    clearError("address");
  }

  const city = document.getElementById("city").value.trim();
  if (city === "") {
    showError("city", "Please enter your city");
    isValid = false;
  } else if (!/^[a-zA-Z\s]+$/.test(city)) {
    showError("city", "City name can only contain letters");
    isValid = false;
  } else {
    clearError("city");
  }

  const pincode = document.getElementById("pincode").value.trim();
  const pincodeRegex = /^\d{6}$/;

  // ============================================
  // SERVICE AREA CHECK — Satellite, Ahmedabad (within ~10 km)
  // Covered pincodes: Satellite, Bodakdev, Vastrapur, Prahlad Nagar,
  // Anandnagar, Jodhpur, Thaltej, Shyamal, Paldi, Navrangpura
  // ============================================
  const SERVICEABLE_PINCODES = {
    380015: "Satellite",
    380054: "Bodakdev",
    380051: "Vastrapur",
    380015: "Prahlad Nagar",
    380061: "Anandnagar",
    380015: "Jodhpur Village",
    380059: "Thaltej",
    380013: "Shyamal / Paldi",
    380009: "Navrangpura",
    380006: "Ambawadi",
    380007: "Maninagar (nearby)",
    380058: "Science City Road",
    380060: "Gota (nearby)",
  };

  if (pincode === "") {
    showError("pincode", "Please enter your PIN code");
    isValid = false;
  } else if (!pincodeRegex.test(pincode)) {
    showError("pincode", "Please enter a valid 6-digit PIN code");
    isValid = false;
  } else if (!SERVICEABLE_PINCODES[pincode]) {
    showError(
      "pincode",
      `⚠️ Sorry! We currently only serve Satellite & nearby areas of Ahmedabad (within 10 km). Your pincode ${pincode} is outside our delivery zone. Covered areas: Satellite, Bodakdev, Vastrapur, Prahlad Nagar, Thaltej, Navrangpura, Ambawadi.`
    );
    isValid = false;
  } else {
    showSuccess(
      "pincode",
      `✅ Great! We serve ${SERVICEABLE_PINCODES[pincode]} area.`
    );
    clearError("pincode");
  }

  return isValid;
}

function validateStep3() {
  let isValid = true;

  const commEmail = document.getElementById("commEmail").checked;
  const commWhatsapp = document.getElementById("commWhatsapp").checked;
  const commPhone = document.getElementById("commPhone").checked;

  if (!commEmail && !commWhatsapp && !commPhone) {
    const errorElement = document.getElementById("communicationError");
    if (errorElement) {
      errorElement.textContent =
        "Please select at least one communication method";
      errorElement.classList.add("show");
    }
    isValid = false;
  } else {
    const errorElement = document.getElementById("communicationError");
    if (errorElement) {
      errorElement.classList.remove("show");
    }
  }

  const termsAgree = document.getElementById("termsAgree").checked;
  if (!termsAgree) {
    const errorElement = document.getElementById("termsError");
    if (errorElement) {
      errorElement.textContent = "You must agree to Terms & Conditions";
      errorElement.classList.add("show");
    }
    isValid = false;
  } else {
    const errorElement = document.getElementById("termsError");
    if (errorElement) {
      errorElement.classList.remove("show");
    }
  }

  return isValid;
}

function validateStep(step) {
  switch (step) {
    case 1:
      return validateStep1();
    case 2:
      return validateStep2();
    case 3:
      return validateStep3();
    default:
      return true;
  }
}

// ============================================
// PASSWORD STRENGTH METER
// ============================================

function checkPasswordStrength(password) {
  const strengthProgress = document.querySelector(".strength-progress");
  const strengthText = document.querySelector(".strength-text");

  if (!strengthProgress || !strengthText) return;

  let strength = 0;

  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z\d]/.test(password)) strength++;

  strengthProgress.classList.remove("weak", "medium", "strong");

  if (strength <= 2) {
    strengthProgress.classList.add("weak");
    strengthText.textContent = "Weak Password";
    strengthText.style.color = "#ef4444";
  } else if (strength <= 4) {
    strengthProgress.classList.add("medium");
    strengthText.textContent = "Medium Password";
    strengthText.style.color = "#f59e0b";
  } else {
    strengthProgress.classList.add("strong");
    strengthText.textContent = "Strong Password";
    strengthText.style.color = "#10b981";
  }
}

const passwordInput = document.getElementById("password");
if (passwordInput) {
  passwordInput.addEventListener("input", function () {
    checkPasswordStrength(this.value);
  });
}

// ============================================
// PASSWORD TOGGLE VISIBILITY
// ============================================

passwordToggles.forEach((toggle) => {
  toggle.addEventListener("click", function () {
    const targetId = this.getAttribute("data-target");
    const targetInput = document.getElementById(targetId);
    const icon = this.querySelector("i");

    if (targetInput.type === "password") {
      targetInput.type = "text";
      icon.classList.remove("fa-eye");
      icon.classList.add("fa-eye-slash");
    } else {
      targetInput.type = "password";
      icon.classList.remove("fa-eye-slash");
      icon.classList.add("fa-eye");
    }
  });
});

// ============================================
// REAL-TIME VALIDATION
// ============================================

const formInputs = document.querySelectorAll(".form-input, .form-textarea");
formInputs.forEach((input) => {
  input.addEventListener("blur", function () {
    if (this.value.trim() !== "") {
      validateStep(currentStep);
    }
  });

  input.addEventListener("input", function () {
    if (this.classList.contains("error")) {
      clearError(this.id);
    }
  });
});

// ============================================
// PHONE NUMBER FORMATTING
// ============================================

const phoneInput = document.getElementById("phone");
if (phoneInput) {
  phoneInput.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "");
    if (this.value.length > 10) {
      this.value = this.value.slice(0, 10);
    }
  });
}

// ============================================
// PIN CODE FORMATTING + LIVE SERVICE AREA CHECK
// ============================================

const SATELLITE_PINCODES = {
  380015: "Satellite / Prahlad Nagar / Jodhpur Village",
  380054: "Bodakdev",
  380051: "Vastrapur",
  380061: "Anandnagar",
  380059: "Thaltej",
  380013: "Shyamal / Paldi",
  380009: "Navrangpura",
  380006: "Ambawadi",
  380007: "Maninagar (nearby)",
  380058: "Science City Road",
  380060: "Gota (nearby)",
};

const pincodeInput = document.getElementById("pincode");
if (pincodeInput) {
  pincodeInput.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "");
    if (this.value.length > 6) {
      this.value = this.value.slice(0, 6);
    }
    // Live check when 6 digits entered
    if (this.value.length === 6) {
      if (SATELLITE_PINCODES[this.value]) {
        showSuccess(
          "pincode",
          `✅ We deliver to ${SATELLITE_PINCODES[this.value]}!`
        );
        clearError("pincode");
      } else {
        showError(
          "pincode",
          `⚠️ Pincode ${this.value} is outside our 10 km delivery zone (Satellite, Ahmedabad). Served areas: Satellite, Bodakdev, Vastrapur, Prahlad Nagar, Thaltej, Navrangpura.`
        );
      }
    } else {
      clearError("pincode");
    }
  });
}

// ============================================
// OTP FUNCTIONALITY
// ============================================

if (sendOtpBtn) {
  sendOtpBtn.addEventListener("click", async function () {
    if (!validateStep3()) {
      return;
    }

    sendOtpBtn.disabled = true;
    sendOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    const formData = {
      full_name: document.getElementById("fullName").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      password: document.getElementById("password").value,
      address: document.getElementById("address").value.trim(),
      city: document.getElementById("city").value.trim(),
      pincode: document.getElementById("pincode").value.trim(),
      comm_email: document.getElementById("commEmail").checked,
      comm_whatsapp: document.getElementById("commWhatsapp").checked,
      comm_phone: document.getElementById("commPhone").checked,
    };

    console.log("📋 Registering user with data:", formData);

    const response = await apiRequest(API_ENDPOINTS.REGISTER, "POST", formData);

    console.log("📥 Full Response Object:", response);

    sendOtpBtn.disabled = false;
    sendOtpBtn.innerHTML = 'Send OTP <i class="fas fa-paper-plane"></i>';

    if (response.success) {
      const responseData = response.data?.data || response.data;

      tempUserId = responseData.temp_user_id;
      const userEmail = responseData.email;
      const maskedEmail = responseData.otp_sent_to;

      console.log("✅ temp_user_id received:", tempUserId);

      if (!tempUserId) {
        console.error("❌ Could not find temp_user_id in response!");
        console.error("Full response:", JSON.stringify(response, null, 2));
        showNotification(
          "Registration error: Temporary ID not received",
          "error"
        );
        return;
      }

      storage.setItem("tempUserId", tempUserId);
      storage.setItem("tempUserEmail", userEmail);

      console.log("✅ Stored temp_user_id:", storage.getItem("tempUserId"));

      const otpEmail = document.getElementById("otpEmail");
      if (otpEmail) {
        otpEmail.textContent = maskedEmail || Security.mask_email(userEmail);
      }

      console.log(
        "✅ Registration initiated, OTP sent. Waiting for verification..."
      );

      showNotification("OTP sent successfully to your email!", "success");
      showStep(4);
      startOTPTimer();
      otpInputs[0].focus();
    } else {
      const errorMsg = response.data.message || "Registration failed";

      if (response.data.errors) {
        const errors = response.data.errors;
        for (const [field, message] of Object.entries(errors)) {
          showError(field, message);
        }
      }

      showNotification(errorMsg, "error");
    }
  });
}

function startOTPTimer() {
  otpTimeRemaining = 60;
  resendOtpBtn.disabled = true;

  otpTimer = setInterval(() => {
    otpTimeRemaining--;
    timerCount.textContent = otpTimeRemaining;

    if (otpTimeRemaining <= 0) {
      clearInterval(otpTimer);
      resendOtpBtn.disabled = false;
    }
  }, 1000);
}

if (resendOtpBtn) {
  resendOtpBtn.addEventListener("click", async function () {
    const userId = tempUserId || storage.getItem("tempUserId");

    if (!userId) {
      showNotification(
        "Session expired. Please start registration again.",
        "error"
      );
      return;
    }

    resendOtpBtn.disabled = true;
    resendOtpBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Sending...';

    const response = await apiRequest(API_ENDPOINTS.RESEND_OTP, "POST", {
      temp_user_id: userId,
      otp_type: "registration",
    });

    resendOtpBtn.innerHTML = '<i class="fas fa-redo"></i> Resend OTP';

    if (response.success) {
      otpInputs.forEach((input) => {
        input.value = "";
      });

      showNotification("OTP resent successfully", "success");
      startOTPTimer();
      otpInputs[0].focus();
    } else {
      resendOtpBtn.disabled = false;
      showNotification(
        response.data.message || "Failed to resend OTP",
        "error"
      );
    }
  });
}

otpInputs.forEach((input, index) => {
  input.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "");

    if (this.value.length === 1 && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }

    const allFilled = Array.from(otpInputs).every(
      (inp) => inp.value.length === 1
    );
    if (allFilled) {
      submitButton.classList.add("pulse");
    }
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Backspace" && this.value === "" && index > 0) {
      otpInputs[index - 1].focus();
    }
  });

  input.addEventListener("paste", function (e) {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "");

    for (let i = 0; i < Math.min(pastedData.length, otpInputs.length); i++) {
      otpInputs[i].value = pastedData[i];
    }

    const lastFilledIndex = Math.min(
      pastedData.length - 1,
      otpInputs.length - 1
    );
    otpInputs[lastFilledIndex].focus();
  });
});

// ============================================
// FORM SUBMISSION - VERIFY OTP (NO AUTO-LOGIN)
// ============================================

if (registrationForm) {
  registrationForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    console.log("🔐 OTP VERIFICATION - DEBUG START");
    console.log("   tempUserId variable:", tempUserId);
    console.log("   tempUserId from storage:", storage.getItem("tempUserId"));

    const userId = tempUserId || storage.getItem("tempUserId");

    console.log("   Final temp_user_id being used:", userId);
    console.log("🔐 OTP VERIFICATION - DEBUG END");

    if (!userId) {
      showNotification(
        "Session expired. Please start registration again.",
        "error"
      );
      return;
    }

    const enteredOTP = Array.from(otpInputs)
      .map((input) => input.value)
      .join("");

    if (enteredOTP.length !== 6) {
      showNotification("Please enter complete OTP", "error");
      return;
    }

    submitButton.classList.add("loading");
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Verifying...';

    const verifyData = {
      temp_user_id: userId,
      otp_code: enteredOTP,
      otp_type: "registration",
    };

    console.log("📤 Sending OTP verification with data:", verifyData);

    const response = await apiRequest(
      API_ENDPOINTS.VERIFY_OTP,
      "POST",
      verifyData
    );

    console.log("📥 OTP Verification Response:", response);

    if (response.success) {
      // 🔥 NEW FLOW: User created but NOT logged in
      const responseData = response.data?.data || response.data;
      const user = responseData.user;

      console.log("✅ OTP verified! User created:", user);
      console.log("📌 NO TOKEN - User must login separately");

      // Clean up temporary data
      storage.removeItem("tempUserId");
      storage.removeItem("tempUserEmail");

      otpInputs.forEach((input) => {
        input.classList.remove("error");
        input.classList.add("success");
      });

      // Show notification
      showNotification(
        "Registration successful! Redirecting to login...",
        "success"
      );

      // 🎉 UPDATED: Show success modal with login redirect
      setTimeout(() => {
        if (window.successModal) {
          window.successModal.show(user.full_name);
        } else {
          // Fallback: redirect directly to login
          window.location.href = "login.html";
        }
      }, 800);
    } else {
      otpInputs.forEach((input) => {
        input.classList.add("error");
        input.classList.remove("success");
      });

      const otpError = document.getElementById("otpError");
      if (otpError) {
        otpError.textContent = response.data.message || "Invalid OTP";
        otpError.classList.add("show");
      }

      submitButton.classList.remove("loading");
      submitButton.disabled = false;
      submitButton.innerHTML =
        '<i class="fas fa-check-circle"></i> Complete Registration';

      showNotification(
        response.data.message || "Invalid OTP. Please try again.",
        "error"
      );
    }
  });
}

console.log("✨ Registration Form Features:");
console.log("   - Multi-step form with validation");
console.log("   - Real-time password strength meter");
console.log("   - Backend API integration");
console.log("   - OTP verification system");
console.log("   - NO auto-login - redirect to login page");
console.log(
  "🎨 Current Theme: " +
    (document.documentElement.getAttribute("data-theme") || "light")
);
