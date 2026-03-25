// ============================================
// SHARED STORAGE UTILITY - USE ACROSS ALL PAGES
// Prevents "Identifier 'storage' has already been declared" errors
// ============================================

// Only declare once - check if already exists
if (typeof window.safeStorage === "undefined") {
  window.safeStorage = {
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

  console.log("✅ Safe storage utility initialized globally");
} else {
  console.log("ℹ️ Safe storage already exists, skipping initialization");
}

// Also create a local alias for backward compatibility
const storage = window.safeStorage;
