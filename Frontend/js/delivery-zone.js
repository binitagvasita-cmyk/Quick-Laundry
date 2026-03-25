// ============================================
// DELIVERY ZONE — delivery-zone.js
// Cleanify Laundry | Satellite, Ahmedabad
// Handles pincode checker functionality only
// ============================================

(function () {
  "use strict";

  // Serviceable pincodes — 10 km from Satellite
  const AREA_PINCODES = {
    "380015": "Satellite / Prahlad Nagar / Jodhpur Village",
    "380054": "Bodakdev",
    "380051": "Vastrapur",
    "380061": "Anandnagar",
    "380059": "Thaltej",
    "380013": "Shyamal / Paldi",
    "380009": "Navrangpura",
    "380006": "Ambawadi",
    "380007": "Maninagar",
    "380058": "Science City Road",
    "380060": "Gota",
  };

  // ── Core check function ──────────────────────
  function checkPincodeArea() {
    const input = document.getElementById("pincodeCheckInput");
    const result = document.getElementById("pincodeCheckResult");
    if (!input || !result) return;

    const pin = input.value.trim();
    result.className = "dz-result";

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      result.innerHTML =
        '<i class="fas fa-exclamation-circle"></i> Please enter a valid 6-digit pincode.';
      result.classList.add("error");
      return;
    }

    if (AREA_PINCODES[pin]) {
      result.innerHTML =
        '<i class="fas fa-check-circle"></i> ✅ Yes! We deliver to <strong>' +
        AREA_PINCODES[pin] +
        "</strong> (" +
        pin +
        ")";
      result.classList.add("success");

      // Highlight matching chip if visible
      highlightAreaChip(pin);
    } else {
      result.innerHTML =
        '<i class="fas fa-times-circle"></i> ❌ Sorry, <strong>' +
        pin +
        "</strong> is outside our 10 km zone. " +
        '<a href="tel:+919876543210" style="color:#7c3aed;font-weight:700">Call us</a> to check!';
      result.classList.add("error");
    }
  }

  // Highlight area chip briefly on match
  function highlightAreaChip(pin) {
    const chips = document.querySelectorAll(".dz-area-chip");
    chips.forEach((chip) => chip.classList.remove("dz-chip-highlight"));

    chips.forEach((chip) => {
      const pinEl = chip.querySelector(".dz-area-pin");
      if (pinEl && pinEl.textContent.includes(pin)) {
        chip.classList.add("dz-chip-highlight");
        chip.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setTimeout(() => chip.classList.remove("dz-chip-highlight"), 2500);
      }
    });
  }

  // ── Input: allow digits only + live check on 6 digits ──
  function setupInputHandlers() {
    const input = document.getElementById("pincodeCheckInput");
    if (!input) return;

    input.addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, "").substring(0, 6);
      if (this.value.length === 6) checkPincodeArea();
      if (this.value.length < 6) {
        const result = document.getElementById("pincodeCheckResult");
        if (result) {
          result.textContent = "";
          result.className = "dz-result";
        }
      }
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") checkPincodeArea();
    });
  }

  // ── Chip hover: show area name tooltip ──────
  function setupChipEffects() {
    const chips = document.querySelectorAll(".dz-area-chip");
    chips.forEach((chip) => {
      chip.addEventListener("mouseenter", function () {
        const pinEl = this.querySelector(".dz-area-pin");
        const nameEl = this.querySelector(".dz-area-name");
        if (pinEl && nameEl) {
          this.title = nameEl.textContent + " — " + pinEl.textContent;
        }
      });
    });
  }

  // ── Init on DOM ready ────────────────────────
  function init() {
    setupInputHandlers();
    setupChipEffects();
    console.log("✅ Delivery Zone JS initialized");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose globally (HTML onclick still works)
  window.checkPincodeArea = checkPincodeArea;
})();