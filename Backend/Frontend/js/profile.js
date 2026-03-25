// ============================================
// PROFILE PAGE - JAVASCRIPT (WITH THEME SYNC)
// ============================================

console.log("🎯 Profile Page JavaScript Loading...");

// ============================================
// API CONFIGURATION
// ============================================

const API_BASE_URL = window.location.origin + "/api";

// ============================================
// SAFE STORAGE WRAPPER
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

// ============================================
// THEME SYNCHRONIZATION - NEW ✅
// ============================================

function syncThemeFromParent() {
  try {
    // Try to get theme from parent window
    if (window.parent && window.parent !== window) {
      const parentTheme =
        window.parent.document.documentElement.getAttribute("data-theme");
      if (parentTheme) {
        document.documentElement.setAttribute("data-theme", parentTheme);
        console.log(`✅ Theme synced from parent: ${parentTheme}`);
        return;
      }
    }
  } catch (e) {
    // Cross-origin error - fallback to localStorage
    console.log(
      "Cannot access parent theme (cross-origin), using localStorage"
    );
  }

  // Fallback to localStorage
  const savedTheme = storage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  console.log(`✅ Theme loaded from localStorage: ${savedTheme}`);
}

// Listen for theme changes from parent
window.addEventListener("message", function (event) {
  if (event.data.type === "THEME_CHANGED") {
    const newTheme = event.data.theme;
    document.documentElement.setAttribute("data-theme", newTheme);
    storage.setItem("theme", newTheme);
    console.log(`✅ Theme updated from parent: ${newTheme}`);
  }
});

// Apply theme immediately
syncThemeFromParent();

// ============================================
// HELPER FUNCTIONS FOR DISABLED/READONLY INPUTS
// ============================================

function setDisabledInputValue(input, value) {
  if (!input) return;

  const wasDisabled = input.disabled;
  const wasReadOnly = input.readOnly;

  input.disabled = false;
  input.readOnly = false;
  input.value = value ?? "";
  input.dispatchEvent(new Event("input", { bubbles: true }));

  input.disabled = wasDisabled;
  input.readOnly = wasReadOnly;

  console.log(
    `✅ Set ${input.id} = "${value}" (disabled: ${wasDisabled}, readOnly: ${wasReadOnly})`
  );
}

function formatDateForInput(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d)) return "";
  return d.toISOString().split("T")[0];
}

// ============================================
// GET AUTHENTICATION TOKEN
// ============================================

function getAuthToken() {
  return storage.getItem("jwtToken");
}

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

// ============================================
// TOKEN EXPIRATION HANDLER
// ============================================

function handleTokenExpiration() {
  console.log("🔒 Token expired - redirecting to login");

  storage.removeItem("jwtToken");
  storage.removeItem("userData");

  showNotification("Your session has expired. Please login again.", "error");

  setTimeout(() => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "CLOSE_PROFILE" }, "*");
      window.parent.postMessage({ type: "TOKEN_EXPIRED" }, "*");
    } else {
      window.location.href = "/login.html";
    }
  }, 2000);
}

// ============================================
// API ERROR HANDLER
// ============================================

function handleApiError(response, result) {
  if (response.status === 401) {
    console.log("❌ Authentication failed:", result.message);
    handleTokenExpiration();
    return true;
  }
  return false;
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

function showNotification(message, type = "info") {
  const container = document.getElementById("notificationContainer");
  if (!container) return;

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;

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

  container.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideInRight 0.3s ease reverse";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ============================================
// LOADING STATE
// ============================================

function showLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.remove("hidden");
}

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.add("hidden");
}

// ============================================
// CLOSE PROFILE MODAL
// ============================================

function closeProfileModal() {
  if (window.parent) {
    window.parent.postMessage({ type: "CLOSE_PROFILE" }, "*");
  }
}

// ============================================
// SERVICE AREA — Cleanify Laundry, Satellite Ahmedabad (10 km)
// ============================================
const SERVICEABLE_PINCODES = {
  380015: "Satellite / Prahlad Nagar / Jodhpur Village",
  380054: "Bodakdev",
  380051: "Vastrapur",
  380061: "Anandnagar",
  380059: "Thaltej",
  380013: "Shyamal / Paldi",
  380009: "Navrangpura",
  380006: "Ambawadi",
  380007: "Maninagar",
  380058: "Science City Road",
  380060: "Gota",
};

// ============================================
// VALIDATION FUNCTIONS
// ============================================

function validatePincode(pincode) {
  if (!pincode) return { valid: false, message: "Pincode is required" };
  const cleaned = pincode.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(cleaned)) {
    return { valid: false, message: "Please enter a valid 6-digit pincode" };
  }
  if (!SERVICEABLE_PINCODES[cleaned]) {
    return {
      valid: false,
      message: `\u26a0\ufe0f Sorry! Pincode ${cleaned} is outside our 10 km delivery zone from Satellite, Ahmedabad. We serve: Satellite, Bodakdev, Vastrapur, Prahlad Nagar, Thaltej, Navrangpura, Ambawadi & nearby areas.`,
    };
  }
  return { valid: true, area: SERVICEABLE_PINCODES[cleaned] };
}

function cleanPincode(pincode) {
  if (!pincode) return "";
  return pincode.replace(/[\s-]/g, "").substring(0, 6);
}

// Live pincode feedback as user types
function setupPincodeListener(inputId, feedbackId) {
  const input = document.getElementById(inputId);
  const feedback = document.getElementById(feedbackId);
  if (!input) return;
  input.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").substring(0, 6);
    if (!feedback) return;
    if (this.value.length === 6) {
      const result = validatePincode(this.value);
      if (result.valid) {
        feedback.textContent = "\u2705 We deliver to " + result.area + "!";
        feedback.style.color = "#10b981";
      } else {
        feedback.textContent = result.message;
        feedback.style.color = "#ef4444";
      }
    } else {
      feedback.textContent = "";
    }
  });
}

// ============================================
// LOAD PROFILE DATA
// ============================================

async function loadProfileData() {
  showLoading();

  try {
    const token = getAuthToken();
    if (!token) {
      console.log("❌ No token found");
      handleTokenExpiration();
      return;
    }

    console.log("📡 Fetching profile data...");
    const response = await fetch(`${API_BASE_URL}/profile/`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    const result = await response.json();
    console.log("📦 Full API Response:", JSON.stringify(result, null, 2));

    if (handleApiError(response, result)) {
      return;
    }

    if (result.success && result.data) {
      populateProfileData(result.data);
    } else {
      throw new Error(result.message || "Failed to load profile");
    }
  } catch (error) {
    console.error("❌ Error loading profile:", error);
    showNotification("Failed to load profile data", "error");
  } finally {
    hideLoading();
  }
}

// ============================================
// POPULATE PROFILE DATA
// ============================================

function populateProfileData(data) {
  console.log("📋 Starting profile population with data:", data);

  if (!data.user) {
    console.error("❌ No user data in response");
    return;
  }

  const user = data.user;
  console.log("👤 User object:", user);

  // Profile Header
  const fullName = user.full_name || "User";
  const nameElement = document.getElementById("profileName");
  if (nameElement) {
    nameElement.textContent = fullName;
    console.log("✅ Profile Name set to:", fullName);
  }

  const email = user.email || "";
  const emailElement = document.getElementById("profileEmail");
  if (emailElement) {
    emailElement.textContent = email;
    console.log("✅ Profile Email set to:", email);
  }

  if (user.profile_picture) {
    const img = document.getElementById("profilePictureImg");
    const placeholder = document.getElementById("profilePicturePlaceholder");
    if (img && placeholder) {
      img.src = user.profile_picture;
      img.style.display = "block";
      placeholder.style.display = "none";
      console.log("✅ Profile picture set");
    }
  }

  if (user.is_verified || user.email_verified) {
    const badge = document.getElementById("verifiedBadge");
    if (badge) {
      badge.style.display = "inline-flex";
      console.log("✅ Verified badge shown");
    }
  }

  if (user.created_at) {
    try {
      const date = new Date(user.created_at);
      const memberSinceElement = document.getElementById("memberSince");
      if (memberSinceElement && !isNaN(date.getTime())) {
        memberSinceElement.textContent = date.getFullYear();
        console.log("✅ Member since:", date.getFullYear());
      }
    } catch (e) {
      console.error("Error parsing date:", e);
    }
  }

  // Personal Info Form
  console.log("📝 Populating form fields...");

  const fullNameInput = document.getElementById("fullName");
  const phoneInput = document.getElementById("phone");
  const dobInput = document.getElementById("dateOfBirth");
  const genderInput = document.getElementById("gender");
  const addressInput = document.getElementById("address");
  const cityInput = document.getElementById("city");
  const pincodeInput = document.getElementById("pincode");

  setDisabledInputValue(fullNameInput, user.full_name);
  setDisabledInputValue(phoneInput, user.phone);
  setDisabledInputValue(dobInput, formatDateForInput(user.date_of_birth));
  setDisabledInputValue(addressInput, user.address);
  setDisabledInputValue(cityInput, user.city);
  setDisabledInputValue(pincodeInput, user.pincode);

  if (genderInput) {
    const wasDisabled = genderInput.disabled;
    const wasReadOnly = genderInput.readOnly;

    genderInput.disabled = false;
    genderInput.readOnly = false;
    genderInput.value = user.gender || "";
    genderInput.dispatchEvent(new Event("change", { bubbles: true }));

    genderInput.disabled = wasDisabled;
    genderInput.readOnly = wasReadOnly;

    console.log(`✅ Gender set to: "${user.gender}"`);
  }

  // Preferences
  const emailNotifInput = document.getElementById("emailNotif");
  if (emailNotifInput) {
    emailNotifInput.checked = user.comm_email === 1 || user.comm_email === true;
    console.log("✅ Email notif:", emailNotifInput.checked);
  }

  const smsNotifInput = document.getElementById("smsNotif");
  if (smsNotifInput) {
    smsNotifInput.checked = user.comm_phone === 1 || user.comm_phone === true;
    console.log("✅ SMS notif:", smsNotifInput.checked);
  }

  const promoNotifInput = document.getElementById("promoNotif");
  if (promoNotifInput) {
    promoNotifInput.checked =
      user.comm_whatsapp === 1 || user.comm_whatsapp === true;
    console.log("✅ Promo notif:", promoNotifInput.checked);
  }

  console.log("✅ All profile data populated successfully!");

  if (data.orders) {
    loadOrders(data.orders);
    console.log("✅ Orders loaded:", data.orders.length);
  }

  if (data.addresses) {
    loadAddresses(data.addresses);
    console.log("✅ Addresses loaded:", data.addresses.length);
  }
}

// ============================================
// LOAD ORDERS
// ============================================

function loadOrders(orders) {
  const container = document.getElementById("ordersContainer");
  if (!container) return;

  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-shopping-bag"></i>
        <p>No orders found</p>
      </div>
    `;
    return;
  }

  container.innerHTML = orders
    .map(
      (order) => `
    <div class="order-card">
      <div class="order-header">
        <div>
          <div class="order-id">Order #${order.cart_id || order.id}</div>
          <div class="order-date">${formatDate(order.created_at)}</div>
        </div>
        <span class="order-status ${order.status}">${formatStatus(
        order.status
      )}</span>
      </div>
      <div class="order-details">
        <div class="order-detail">
          <i class="fas fa-tag"></i>
          <strong>${order.service_name}</strong>
        </div>
        <div class="order-detail">
          <i class="fas fa-shopping-cart"></i>
          Quantity: <strong>${order.quantity}</strong>
        </div>
        <div class="order-detail">
          <i class="fas fa-rupee-sign"></i>
          Total: <strong>₹${order.total_price}</strong>
        </div>
        <div class="order-detail">
          <i class="fas fa-calendar"></i>
          Pickup: <strong>${formatDate(order.pickup_date)}</strong>
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

// ============================================
// LOAD ADDRESSES
// ============================================

function loadAddresses(addresses) {
  const container = document.getElementById("addressesContainer");
  if (!container) return;

  if (!addresses || addresses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-map-marker-alt"></i>
        <p>No saved addresses</p>
      </div>
    `;
    return;
  }

  container.innerHTML = addresses
    .map(
      (address) => `
    <div class="address-card">
      ${
        address.is_default ? '<span class="address-default">Default</span>' : ""
      }
      <div class="address-type">
        <i class="fas fa-${
          address.type === "home"
            ? "home"
            : address.type === "work"
            ? "briefcase"
            : "map-marker-alt"
        }"></i>
        ${address.type.charAt(0).toUpperCase() + address.type.slice(1)}
      </div>
      <div class="address-name">${address.name}</div>
      <div class="address-details">
        ${address.street}<br>
        ${address.city}, ${address.state} ${address.zip}<br>
        ${address.landmark ? `Landmark: ${address.landmark}<br>` : ""}
        Phone: ${address.phone}
      </div>
      <div class="address-actions">
        <button class="btn-icon delete" onclick="deleteAddress(${
          address.address_id
        })">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `
    )
    .join("");
}

// ============================================
// UPDATE PERSONAL INFO
// ============================================

async function updatePersonalInfo(formData) {
  try {
    if (formData.pincode) {
      const pincodeCheck = validatePincode(formData.pincode);
      if (!pincodeCheck.valid) {
        showNotification(pincodeCheck.message, "error");
        return false;
      }
      formData.pincode = cleanPincode(formData.pincode);
    }

    console.log("📝 Updating profile with:", formData);

    const response = await fetch(`${API_BASE_URL}/profile/update`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(formData),
    });

    const result = await response.json();
    console.log("📦 Update response:", result);

    if (handleApiError(response, result)) {
      return false;
    }

    if (result.success) {
      showNotification("Profile updated successfully", "success");
      await loadProfileData();
      return true;
    } else {
      throw new Error(result.message || "Failed to update profile");
    }
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    showNotification(error.message || "Failed to update profile", "error");
    return false;
  }
}

// ============================================
// ADD ADDRESS
// ============================================

async function addAddress(formData) {
  try {
    if (formData.zip) {
      const zipCheck = validatePincode(formData.zip);
      if (!zipCheck.valid) {
        showNotification(zipCheck.message, "error");
        return false;
      }
      formData.zip = cleanPincode(formData.zip);
    }

    const response = await fetch(`${API_BASE_URL}/profile/addresses`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (handleApiError(response, result)) {
      return false;
    }

    if (result.success) {
      showNotification("Address added successfully", "success");
      loadProfileData();
      return true;
    } else {
      throw new Error(result.message || "Failed to add address");
    }
  } catch (error) {
    console.error("Error adding address:", error);
    showNotification(error.message || "Failed to add address", "error");
    return false;
  }
}

// ============================================
// DELETE ADDRESS
// ============================================

async function deleteAddress(addressId) {
  if (!confirm("Are you sure you want to delete this address?")) {
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/profile/addresses/${addressId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      }
    );

    const result = await response.json();

    if (handleApiError(response, result)) {
      return;
    }

    if (result.success) {
      showNotification("Address deleted successfully", "success");
      loadProfileData();
    } else {
      throw new Error(result.message || "Failed to delete address");
    }
  } catch (error) {
    console.error("Error deleting address:", error);
    showNotification(error.message || "Failed to delete address", "error");
  }
}

window.deleteAddress = deleteAddress;

// ============================================
// UPDATE PREFERENCES
// ============================================

async function updatePreferences(formData) {
  try {
    const response = await fetch(`${API_BASE_URL}/profile/preferences`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (handleApiError(response, result)) {
      return false;
    }

    if (result.success) {
      showNotification("Preferences updated successfully", "success");
      return true;
    } else {
      throw new Error(result.message || "Failed to update preferences");
    }
  } catch (error) {
    console.error("Error updating preferences:", error);
    showNotification(error.message || "Failed to update preferences", "error");
    return false;
  }
}

// ============================================
// UPLOAD PROFILE PICTURE
// ============================================

async function uploadProfilePicture(file) {
  try {
    const formData = new FormData();
    formData.append("image", file);

    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/profile/upload-picture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (handleApiError(response, result)) {
      return false;
    }

    if (result.success) {
      showNotification("Profile picture updated successfully", "success");

      const img = document.getElementById("profilePictureImg");
      const placeholder = document.getElementById("profilePicturePlaceholder");
      img.src = `${result.data.profile_picture}?t=${Date.now()}`;
      img.style.display = "block";
      placeholder.style.display = "none";

      return true;
    } else {
      throw new Error(result.message || "Failed to upload picture");
    }
  } catch (error) {
    console.error("Error uploading picture:", error);
    showNotification(error.message || "Failed to upload picture", "error");
    return false;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(status) {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Profile page DOM loaded");

  // Sync theme on load
  syncThemeFromParent();

  loadProfileData();

  const closeBtn = document.getElementById("profileCloseBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeProfileModal);
  }

  const tabs = document.querySelectorAll(".profile-tab");
  const tabContents = document.querySelectorAll(".profile-tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((tc) => tc.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`${tabName}Tab`).classList.add("active");
    });
  });

  const editPersonalBtn = document.getElementById("editPersonalBtn");
  const personalInfoForm = document.getElementById("personalInfoForm");
  const personalFormActions = document.getElementById("personalFormActions");
  const cancelPersonalBtn = document.getElementById("cancelPersonalBtn");

  let isEditMode = false;

  editPersonalBtn?.addEventListener("click", () => {
    isEditMode = !isEditMode;
    const formInputs = personalInfoForm.querySelectorAll("input, select");
    formInputs.forEach((input) => {
      if (input.id !== "email") {
        input.disabled = !isEditMode;
        input.readOnly = !isEditMode;
      }
    });

    if (isEditMode) {
      editPersonalBtn.innerHTML = '<i class="fas fa-times"></i> Cancel Edit';
      personalFormActions.style.display = "flex";
    } else {
      editPersonalBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
      personalFormActions.style.display = "none";
      loadProfileData();
    }
  });

  cancelPersonalBtn?.addEventListener("click", () => {
    isEditMode = false;
    editPersonalBtn.click();
  });

  personalInfoForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = {
      full_name: document.getElementById("fullName").value,
      phone: document.getElementById("phone").value,
      date_of_birth: document.getElementById("dateOfBirth").value || null,
      gender: document.getElementById("gender").value || null,
      address: document.getElementById("address").value,
      city: document.getElementById("city").value,
      pincode: document.getElementById("pincode").value || null,
    };

    const success = await updatePersonalInfo(formData);
    if (success) {
      isEditMode = false;
      editPersonalBtn.click();
    }
  });

  const uploadPictureBtn = document.getElementById("uploadPictureBtn");
  const profilePictureInput = document.getElementById("profilePictureInput");

  uploadPictureBtn?.addEventListener("click", () => {
    profilePictureInput.click();
  });

  profilePictureInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showNotification("Please select an image file", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showNotification("Image size should be less than 5MB", "error");
      return;
    }

    await uploadProfilePicture(file);
  });

  const addAddressBtn = document.getElementById("addAddressBtn");
  const addAddressModal = document.getElementById("addAddressModal");
  const closeAddressModal = document.getElementById("closeAddressModal");
  const cancelAddressBtn = document.getElementById("cancelAddressBtn");
  const addAddressForm = document.getElementById("addAddressForm");

  addAddressBtn?.addEventListener("click", () => {
    addAddressModal.classList.add("active");
  });

  closeAddressModal?.addEventListener("click", () => {
    addAddressModal.classList.remove("active");
  });

  cancelAddressBtn?.addEventListener("click", () => {
    addAddressModal.classList.remove("active");
  });

  addAddressModal?.addEventListener("click", (e) => {
    if (e.target === addAddressModal) {
      addAddressModal.classList.remove("active");
    }
  });

  addAddressForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = {
      type: document.getElementById("addressType").value,
      name: document.getElementById("addressName").value,
      phone: document.getElementById("addressPhone").value,
      street: document.getElementById("addressStreet").value,
      city: document.getElementById("addressCity").value,
      state: document.getElementById("addressState").value,
      zip: document.getElementById("addressZip").value,
      landmark: document.getElementById("addressLandmark").value || null,
      isDefault: document.getElementById("isDefault").checked,
    };

    const success = await addAddress(formData);
    if (success) {
      addAddressModal.classList.remove("active");
      addAddressForm.reset();
    }
  });

  const preferencesForm = document.getElementById("preferencesForm");
  preferencesForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = {
      emailNotif: document.getElementById("emailNotif").checked,
      smsNotif: document.getElementById("smsNotif").checked,
      promoNotif: document.getElementById("promoNotif").checked,
    };

    await updatePreferences(formData);
  });

  // ✅ Live pincode validation for profile pincode field
  setupPincodeListener("pincode", "pincodeFeedback");

  // ✅ Live pincode validation for add address modal
  setupPincodeListener("addressZip", "addressZipFeedback");

  console.log("🎉 Profile page initialized!");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeProfileModal();
  }
});

console.log("✨ Profile JavaScript loaded successfully!");
