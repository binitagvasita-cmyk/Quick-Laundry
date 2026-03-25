// ============================================
// REVIEW PAGE JAVASCRIPT - ENHANCED WITH LOGIN
// With Image Upload, Filtering, and Authentication
// ============================================

console.log("⭐ Enhanced Review JavaScript Loading...");

// API Base URL
const API_BASE_URL = window.location.origin;

// Global variables
let allReviews = [];
let filteredReviews = [];
let currentPage = 1;
const reviewsPerPage = 12;
let selectedImages = [];
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

// ============================================
// AUTHENTICATION HELPER FUNCTIONS
// ============================================

function isUserLoggedIn() {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const jwtToken = localStorage.getItem("jwtToken");
  return isLoggedIn && jwtToken;
}

function getUserData() {
  return {
    isLoggedIn: localStorage.getItem("isLoggedIn") === "true",
    userName: localStorage.getItem("userName"),
    userEmail: localStorage.getItem("userEmail"),
    jwtToken: localStorage.getItem("jwtToken"),
  };
}

function showLoginPrompt() {
  // Create a beautiful login prompt modal
  const promptHTML = `
        <div class="login-prompt-modal" id="loginPromptModal">
            <div class="login-prompt-backdrop" onclick="closeLoginPrompt()"></div>
            <div class="login-prompt-container">
                <div class="login-prompt-icon">
                    <i class="fas fa-user-lock"></i>
                </div>
                <h2 class="login-prompt-title">Login Required</h2>
                <p class="login-prompt-text">
                    You need to be logged in to write a review. Please login or create an account to continue.
                </p>
                <div class="login-prompt-actions">
                    <button class="btn-login-prompt" onclick="redirectToLogin()">
                        <i class="fas fa-sign-in-alt"></i>
                        <span>Login</span>
                    </button>
                    <button class="btn-signup-prompt" onclick="redirectToSignup()">
                        <i class="fas fa-user-plus"></i>
                        <span>Sign Up</span>
                    </button>
                </div>
                <button class="btn-close-prompt" onclick="closeLoginPrompt()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;

  // Add to page
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = promptHTML;
  document.body.appendChild(tempDiv.firstElementChild);

  // Add styles dynamically
  if (!document.getElementById("login-prompt-styles")) {
    const styles = document.createElement("style");
    styles.id = "login-prompt-styles";
    styles.textContent = `
            .login-prompt-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s ease;
            }
            
            .login-prompt-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(8px);
            }
            
            .login-prompt-container {
                position: relative;
                background: var(--secondary-bg, white);
                border-radius: 30px;
                padding: 3rem 2.5rem;
                max-width: 500px;
                width: 90%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideUp 0.4s ease;
            }
            
            [data-theme="dark"] .login-prompt-container {
                background: #1a0f2e;
                border: 2px solid rgba(167, 139, 250, 0.3);
            }
            
            .login-prompt-icon {
                width: 80px;
                height: 80px;
                background: linear-gradient(135deg, #6B46C1, #9333EA);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 1.5rem;
                font-size: 2.5rem;
                color: white;
            }
            
            .login-prompt-title {
                font-size: 2rem;
                font-weight: 800;
                color: var(--text-primary, #1a202c);
                margin-bottom: 1rem;
            }
            
            .login-prompt-text {
                font-size: 1.1rem;
                color: var(--text-secondary, #64748b);
                margin-bottom: 2rem;
                line-height: 1.6;
            }
            
            .login-prompt-actions {
                display: flex;
                gap: 1rem;
                justify-content: center;
            }
            
            .btn-login-prompt,
            .btn-signup-prompt {
                flex: 1;
                padding: 1rem 2rem;
                border: none;
                border-radius: 15px;
                font-size: 1rem;
                font-weight: 700;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.75rem;
                transition: all 0.3s ease;
            }
            
            .btn-login-prompt {
                background: linear-gradient(135deg, #6B46C1, #9333EA);
                color: white;
                box-shadow: 0 8px 20px rgba(107, 70, 193, 0.4);
            }
            
            .btn-login-prompt:hover {
                transform: translateY(-3px);
                box-shadow: 0 12px 30px rgba(107, 70, 193, 0.5);
            }
            
            .btn-signup-prompt {
                background: var(--primary-bg, #f8fafc);
                color: var(--text-primary, #1a202c);
                border: 2px solid var(--border-color, #e2e8f0);
            }
            
            .btn-signup-prompt:hover {
                background: var(--secondary-bg, white);
                border-color: #6B46C1;
                transform: translateY(-3px);
            }
            
            .btn-close-prompt {
                position: absolute;
                top: 1.5rem;
                right: 1.5rem;
                width: 40px;
                height: 40px;
                background: var(--primary-bg, #f8fafc);
                border: 2px solid var(--border-color, #e2e8f0);
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                color: var(--text-secondary, #64748b);
                transition: all 0.3s ease;
            }
            
            .btn-close-prompt:hover {
                background: #ef4444;
                color: white;
                border-color: #ef4444;
                transform: rotate(90deg);
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(50px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
    document.head.appendChild(styles);
  }

  // Animate in
  setTimeout(() => {
    const modal = document.getElementById("loginPromptModal");
    if (modal) {
      modal.style.opacity = "1";
    }
  }, 10);
}

function closeLoginPrompt() {
  const modal = document.getElementById("loginPromptModal");
  if (modal) {
    modal.style.animation = "fadeOut 0.3s ease";
    setTimeout(() => modal.remove(), 300);
  }
}

function redirectToLogin() {
  localStorage.setItem("redirectAfterLogin", window.location.pathname);
  window.location.href = "login.html";
}

function redirectToSignup() {
  localStorage.setItem("redirectAfterLogin", window.location.pathname);
  window.location.href = "registration.html";
}

// Make functions available globally
window.closeLoginPrompt = closeLoginPrompt;
window.redirectToLogin = redirectToLogin;
window.redirectToSignup = redirectToSignup;

// Update authentication UI elements
function updateAuthUI() {
  const userData = getUserData();

  // Update write review buttons to show user status
  const writeReviewBtns = document.querySelectorAll(
    ".btn-write-review-primary, #writeReviewBtnHero, #writeReviewBtnCTA, #firstReviewBtn"
  );

  writeReviewBtns.forEach((btn) => {
    if (btn) {
      if (userData.isLoggedIn) {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      }
    }
  });
}

// ============================================
// WAIT FOR DOM
// ============================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initReviewPage);
} else {
  initReviewPage();
}

function initReviewPage() {
  console.log("🎯 Initializing Enhanced Review Page...");

  // Check authentication status
  updateAuthUI();

  // Initialize all components
  initializeModal();
  initializeStarRating();
  initializeImageUpload();
  initializeFilters();
  initializeFormHandlers();

  // Load data
  loadReviewStats();
  loadReviews();

  console.log("✅ Review page initialized!");
}

// ============================================
// MODAL MANAGEMENT
// ============================================

function initializeModal() {
  const writeReviewBtns = [
    document.getElementById("writeReviewBtnHero"),
    document.getElementById("writeReviewBtnCTA"),
    document.getElementById("firstReviewBtn"),
  ];

  const modal = document.getElementById("reviewModal");
  const modalBackdrop = document.getElementById("modalBackdrop");
  const modalClose = document.getElementById("modalClose");
  const btnCancel = document.getElementById("btnCancel");

  // Open modal - with authentication check
  writeReviewBtns.forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", () => {
        // Check if user is logged in
        if (!isUserLoggedIn()) {
          console.log("❌ User not logged in");
          showNotification("Please login to write a review", "error");
          showLoginPrompt();
          return;
        }

        console.log("✅ User is logged in, opening review modal");
        openModal();
      });
    }
  });

  // Close modal
  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);

  // ESC key to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      closeModal();
    }
  });
}

function openModal() {
  const modal = document.getElementById("reviewModal");
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  const modal = document.getElementById("reviewModal");
  const form = document.getElementById("reviewForm");

  modal.classList.remove("active");
  document.body.style.overflow = "";

  // Reset form
  form.reset();
  selectedRating = 0;
  updateStarSelection(0);
  selectedImages = [];
  updateImagePreview();

  // Reset character count
  const charCount = document.querySelector(".char-count");
  if (charCount) {
    charCount.textContent = "0 / 1000 characters";
  }
}

// ============================================
// STAR RATING SYSTEM
// ============================================

let selectedRating = 0;
const ratingDescriptions = {
  1: "😞 Poor - Not satisfied",
  2: "😐 Fair - Below expectations",
  3: "🙂 Good - Meets expectations",
  4: "😊 Very Good - Exceeded expectations",
  5: "🤩 Excellent - Outstanding service!",
};

function initializeStarRating() {
  const starRating = document.getElementById("starRating");
  const ratingInput = document.getElementById("ratingInput");
  const ratingDescription = document.getElementById("ratingDescription");

  if (!starRating) return;

  const starBtns = starRating.querySelectorAll(".star-btn");

  starBtns.forEach((btn, index) => {
    const rating = index + 1;

    // Click event
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      selectedRating = rating;
      ratingInput.value = rating;
      updateStarSelection(rating);
      ratingDescription.textContent = ratingDescriptions[rating];
    });

    // Hover event
    btn.addEventListener("mouseenter", () => {
      updateStarSelection(rating);
      ratingDescription.textContent = ratingDescriptions[rating];
    });
  });

  // Reset to selected rating on mouse leave
  starRating.addEventListener("mouseleave", () => {
    updateStarSelection(selectedRating);
    if (selectedRating > 0) {
      ratingDescription.textContent = ratingDescriptions[selectedRating];
    } else {
      ratingDescription.textContent = "Tap to rate";
    }
  });
}

function updateStarSelection(rating) {
  const starBtns = document.querySelectorAll(".star-btn");
  starBtns.forEach((btn, index) => {
    const star = btn.querySelector("i");
    if (index < rating) {
      star.className = "fas fa-star";
      btn.classList.add("active");
    } else {
      star.className = "far fa-star";
      btn.classList.remove("active");
    }
  });
}

// ============================================
// IMAGE UPLOAD SYSTEM
// ============================================

function initializeImageUpload() {
  const imageUpload = document.getElementById("imageUpload");
  const imageUploadArea = document.getElementById("imageUploadArea");

  if (!imageUpload || !imageUploadArea) return;

  // Click to upload
  imageUploadArea.addEventListener("click", () => {
    imageUpload.click();
  });

  // File input change
  imageUpload.addEventListener("change", (e) => {
    handleFiles(e.target.files);
  });

  // Drag and drop
  imageUploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    imageUploadArea.classList.add("drag-over");
  });

  imageUploadArea.addEventListener("dragleave", () => {
    imageUploadArea.classList.remove("drag-over");
  });

  imageUploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    imageUploadArea.classList.remove("drag-over");
    handleFiles(e.dataTransfer.files);
  });
}

function handleFiles(files) {
  const fileArray = Array.from(files);

  // Check total number of images
  if (selectedImages.length + fileArray.length > MAX_IMAGES) {
    showNotification(`You can only upload up to ${MAX_IMAGES} images`, "error");
    return;
  }

  fileArray.forEach((file) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      showNotification(`${file.name} is not an image file`, "error");
      return;
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE) {
      showNotification(`${file.name} is too large. Max size is 5MB`, "error");
      return;
    }

    // Create image object
    const reader = new FileReader();
    reader.onload = (e) => {
      selectedImages.push({
        file: file,
        dataUrl: e.target.result,
        name: file.name,
      });
      updateImagePreview();
    };
    reader.readAsDataURL(file);
  });
}

function updateImagePreview() {
  const imagePreviewContainer = document.getElementById(
    "imagePreviewContainer"
  );
  const previewGrid = document.getElementById("previewGrid");

  if (!imagePreviewContainer || !previewGrid) return;

  if (selectedImages.length === 0) {
    imagePreviewContainer.style.display = "none";
    return;
  }

  imagePreviewContainer.style.display = "block";
  previewGrid.innerHTML = "";

  selectedImages.forEach((img, index) => {
    const previewItem = document.createElement("div");
    previewItem.className = "preview-item";
    previewItem.innerHTML = `
            <img src="${img.dataUrl}" alt="${img.name}">
            <button type="button" class="preview-remove" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
        `;

    // Remove image
    const removeBtn = previewItem.querySelector(".preview-remove");
    removeBtn.addEventListener("click", () => {
      removeImage(index);
    });

    previewGrid.appendChild(previewItem);
  });
}

function removeImage(index) {
  selectedImages.splice(index, 1);
  updateImagePreview();

  // Reset file input
  const imageUpload = document.getElementById("imageUpload");
  if (imageUpload) {
    imageUpload.value = "";
  }
}

// ============================================
// FORM HANDLERS
// ============================================

function initializeFormHandlers() {
  const reviewForm = document.getElementById("reviewForm");
  const reviewText = document.getElementById("reviewText");
  const charCount = document.querySelector(".char-count");

  if (!reviewForm || !reviewText) return;

  // Character count
  reviewText.addEventListener("input", (e) => {
    const count = e.target.value.length;
    if (charCount) {
      charCount.textContent = `${count} / 1000 characters`;

      if (count > 1000) {
        charCount.style.color = "#ef4444";
      } else if (count >= 20) {
        charCount.style.color = "#10b981";
      } else {
        charCount.style.color = "var(--text-secondary)";
      }
    }
  });

  // Form submission
  reviewForm.addEventListener("submit", handleFormSubmit);
}

async function handleFormSubmit(e) {
  e.preventDefault();

  // Double-check authentication before submission
  if (!isUserLoggedIn()) {
    showNotification("Please login to submit a review", "error");
    showLoginPrompt();
    return;
  }

  // Validate rating
  if (selectedRating === 0) {
    showNotification("Please select a rating", "error");
    return;
  }

  // Validate review text
  const reviewText = document.getElementById("reviewText").value.trim();
  if (reviewText.length < 20) {
    showNotification("Review must be at least 20 characters long", "error");
    return;
  }

  // Check terms acceptance
  const termsAccept = document.getElementById("termsAccept");
  if (termsAccept && !termsAccept.checked) {
    showNotification("Please accept the terms to submit your review", "error");
    return;
  }

  // Get JWT token
  const jwtToken = localStorage.getItem("jwtToken");
  if (!jwtToken) {
    showNotification("Authentication error. Please login again", "error");
    closeModal();
    showLoginPrompt();
    return;
  }

  // Prepare form data
  const formData = new FormData();
  formData.append("rating", selectedRating);
  formData.append("reviewText", reviewText);

  const serviceType = document.getElementById("serviceType");
  if (serviceType) {
    formData.append("serviceType", serviceType.value);
  }

  // Add images
  selectedImages.forEach((img) => {
    formData.append("images", img.file);
  });

  // Disable submit button
  const submitBtn = document.getElementById("btnSubmit");
  const originalHTML = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> <span>Submitting...</span>';

  try {
    const response = await fetch(`${API_BASE_URL}/api/reviews/add`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      showNotification(
        "Thank you! Your review has been submitted for approval 🎉",
        "success"
      );
      closeModal();

      // Reload reviews after 1 second
      setTimeout(() => {
        loadReviews();
        loadReviewStats();
      }, 1000);
    } else {
      // Check if error is authentication-related
      if (response.status === 401 || response.status === 403) {
        showNotification("Session expired. Please login again", "error");
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("jwtToken");
        closeModal();
        showLoginPrompt();
      } else {
        showNotification(result.message || "Failed to submit review", "error");
      }
    }
  } catch (error) {
    console.error("❌ Error submitting review:", error);
    showNotification("Failed to submit review. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHTML;
  }
}

// ============================================
// LOAD REVIEW STATISTICS
// ============================================

async function loadReviewStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/reviews/stats`);
    const result = await response.json();

    if (result.success) {
      const { totalReviews, averageRating, ratingDistribution } = result.data;

      // Update hero stats
      const heroAverageRating = document.getElementById("heroAverageRating");
      const heroTotalReviews = document.getElementById("heroTotalReviews");

      if (heroAverageRating)
        heroAverageRating.textContent = averageRating.toFixed(1);
      if (heroTotalReviews) heroTotalReviews.textContent = totalReviews;

      // Update main stats
      const mainAverageRating = document.getElementById("mainAverageRating");
      const mainTotalReviews = document.getElementById("mainTotalReviews");

      if (mainAverageRating)
        mainAverageRating.textContent = averageRating.toFixed(1);
      if (mainTotalReviews)
        mainTotalReviews.textContent = `Based on ${totalReviews} reviews`;

      // Update star display
      updateStarDisplay("mainAverageStars", averageRating);

      // Update rating bars
      const total = totalReviews || 1;
      updateRatingBar(5, ratingDistribution.fiveStar, total);
      updateRatingBar(4, ratingDistribution.fourStar, total);
      updateRatingBar(3, ratingDistribution.threeStar, total);
      updateRatingBar(2, ratingDistribution.twoStar, total);
      updateRatingBar(1, ratingDistribution.oneStar, total);

      console.log(
        `✅ Stats loaded: ${totalReviews} reviews, ${averageRating.toFixed(
          1
        )} avg`
      );
    }
  } catch (error) {
    console.error("❌ Error loading stats:", error);
  }
}

function updateStarDisplay(elementId, rating) {
  const container = document.getElementById(elementId);
  if (!container) return;

  const stars = container.querySelectorAll("i");
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  stars.forEach((star, index) => {
    if (index < fullStars) {
      star.className = "fas fa-star";
    } else if (index === fullStars && hasHalfStar) {
      star.className = "fas fa-star-half-alt";
    } else {
      star.className = "far fa-star";
    }
  });
}

function updateRatingBar(rating, count, total) {
  const percentage = (count / total) * 100;
  const barFill = document.getElementById(`bar${rating}`);
  const barCount = document.getElementById(`count${rating}`);

  if (barFill) {
    setTimeout(() => {
      barFill.style.width = `${percentage}%`;
    }, 100);
  }

  if (barCount) {
    barCount.textContent = count;
  }
}

// ============================================
// LOAD REVIEWS
// ============================================

async function loadReviews() {
  const loadingState = document.getElementById("loadingState");
  const emptyState = document.getElementById("emptyState");
  const reviewsGrid = document.getElementById("reviewsGrid");

  if (loadingState) loadingState.style.display = "block";
  if (emptyState) emptyState.style.display = "none";
  if (reviewsGrid) reviewsGrid.innerHTML = "";

  try {
    const response = await fetch(`${API_BASE_URL}/api/reviews`);
    const result = await response.json();

    if (loadingState) loadingState.style.display = "none";

    if (result.success && result.data.reviews.length > 0) {
      allReviews = result.data.reviews;
      applyFilters();
      console.log(`✅ Loaded ${allReviews.length} reviews`);
    } else {
      if (emptyState) emptyState.style.display = "block";
      console.log("ℹ️ No reviews found");
    }
  } catch (error) {
    console.error("❌ Error loading reviews:", error);
    if (loadingState) loadingState.style.display = "none";
    if (emptyState) emptyState.style.display = "block";
  }
}

function displayReviews(reviews) {
  const reviewsGrid = document.getElementById("reviewsGrid");
  const emptyState = document.getElementById("emptyState");

  if (!reviewsGrid) return;

  reviewsGrid.innerHTML = "";

  if (reviews.length === 0) {
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  reviews.forEach((review, index) => {
    const reviewCard = createReviewCard(review);
    reviewCard.style.animationDelay = `${index * 0.05}s`;
    reviewsGrid.appendChild(reviewCard);
  });
}

function createReviewCard(review) {
  const card = document.createElement("div");
  card.className = `review-card ${review.isFeatured ? "featured" : ""}`;
  card.style.animation = "fadeInUp 0.5s ease forwards";

  const initials = getInitials(review.userName);
  const timeAgo = getTimeAgo(review.createdAt);

  card.innerHTML = `
        <div class="review-header">
            <div class="reviewer-info">
                <div class="reviewer-avatar">${initials}</div>
                <div class="reviewer-details">
                    <h4>${escapeHtml(review.userName)}</h4>
                    <span class="review-date">${timeAgo}</span>
                </div>
            </div>
            <div class="review-stars">
                ${generateStars(review.rating)}
            </div>
        </div>
        
        <div class="review-body">
            <p class="review-text">${escapeHtml(review.reviewText)}</p>
        </div>
        
        ${
          review.images && review.images.length > 0
            ? `
            <div class="review-images">
                ${review.images
                  .map(
                    (img) => `
                    <div class="review-image-item">
                        <img src="${API_BASE_URL}${img}" alt="Review image" onerror="this.style.display='none'">
                    </div>
                `
                  )
                  .join("")}
            </div>
        `
            : ""
        }
        
        <div class="review-footer">
            ${
              review.serviceType
                ? `
                <span class="service-badge">
                    <i class="fas fa-concierge-bell"></i>
                    ${escapeHtml(review.serviceType)}
                </span>
            `
                : "<span></span>"
            }
            
            ${
              review.isFeatured
                ? `
                <span class="featured-badge">
                    <i class="fas fa-crown"></i>
                    Featured
                </span>
            `
                : ""
            }
        </div>
    `;

  return card;
}

function generateStars(rating) {
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    stars += `<i class="fas fa-star"></i>`;
  }
  return stars;
}

function getInitials(name) {
  if (!name) return "??";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval !== 1 ? "s" : ""} ago`;
    }
  }

  return "Just now";
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// FILTER SYSTEM
// ============================================

function initializeFilters() {
  const filterRating = document.getElementById("filterRating");
  const filterService = document.getElementById("filterService");
  const sortBy = document.getElementById("sortBy");

  if (filterRating) filterRating.addEventListener("change", applyFilters);
  if (filterService) filterService.addEventListener("change", applyFilters);
  if (sortBy) sortBy.addEventListener("change", applyFilters);
}

function applyFilters() {
  const filterRating = document.getElementById("filterRating");
  const filterService = document.getElementById("filterService");
  const sortBy = document.getElementById("sortBy");

  const filterRatingValue = filterRating ? filterRating.value : "all";
  const filterServiceValue = filterService ? filterService.value : "all";
  const sortByValue = sortBy ? sortBy.value : "newest";

  // Filter reviews
  filteredReviews = allReviews.filter((review) => {
    const ratingMatch =
      filterRatingValue === "all" ||
      review.rating === parseInt(filterRatingValue);
    const serviceMatch =
      filterServiceValue === "all" || review.serviceType === filterServiceValue;
    return ratingMatch && serviceMatch;
  });

  // Sort reviews
  filteredReviews.sort((a, b) => {
    switch (sortByValue) {
      case "newest":
        return new Date(b.createdAt) - new Date(a.createdAt);
      case "oldest":
        return new Date(a.createdAt) - new Date(b.createdAt);
      case "highest":
        return b.rating - a.rating;
      case "lowest":
        return a.rating - b.rating;
      default:
        return 0;
    }
  });

  displayReviews(filteredReviews);
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
          type === "success"
            ? "#10b981"
            : type === "error"
            ? "#ef4444"
            : "#3b82f6"
        };
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        z-index: 10001;
        animation: slideInRight 0.3s ease;
        max-width: 400px;
    `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Add notification animations
if (!document.getElementById("notification-styles")) {
  const style = document.createElement("style");
  style.id = "notification-styles";
  style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
  document.head.appendChild(style);
}

// ============================================
// CHECK FOR REDIRECT AFTER LOGIN
// ============================================

window.addEventListener("load", () => {
  const redirectAfterLogin = localStorage.getItem("redirectAfterLogin");
  if (redirectAfterLogin && isUserLoggedIn()) {
    localStorage.removeItem("redirectAfterLogin");
    const userData = getUserData();
    showNotification(`Welcome back, ${userData.userName}!`, "success");
  }
});

console.log(
  "✨ Enhanced Review JavaScript with Login Integration Loaded Successfully!"
);
