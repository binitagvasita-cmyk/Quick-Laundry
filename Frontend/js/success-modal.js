// ============================================
// SUCCESS MODAL FUNCTIONALITY - UPDATED
// Redirects to login page instead of home
// ============================================

class SuccessModal {
  constructor() {
    this.overlay = null;
    this.modal = null;
    this.init();
  }

  init() {
    this.overlay = document.getElementById('successModalOverlay');
    if (!this.overlay) {
      console.warn('Success modal overlay not found');
      return;
    }

    // Continue to Login button (updated from "Continue to Home")
    const continueBtn = document.getElementById('continueToHome');
    if (continueBtn) {
      // Update button text and icon
      continueBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Continue to Login';
      
      continueBtn.addEventListener('click', () => {
        this.hide();
        setTimeout(() => {
          // 🔥 CHANGED: Redirect to login page instead of home
          window.location.href = 'login.html';
        }, 300);
      });
    }

    // Close on overlay click - redirect to login
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 300);
      }
    });
  }

  show(userName = '') {
    if (!this.overlay) return;

    // Update modal title
    const modalTitle = this.overlay.querySelector('.success-modal-title');
    if (modalTitle) {
      modalTitle.textContent = 'Registration Complete!';
    }

    // Update welcome message with user name if provided
    if (userName) {
      const messageEl = this.overlay.querySelector('.success-message');
      if (messageEl) {
        messageEl.innerHTML = `
          Congratulations <strong>${userName}</strong>! Your account has been successfully created and verified.
          <br><br>
          Please login with your credentials to access your account.
        `;
      }
    }

    // Update features list to show login benefits
    const featureList = this.overlay.querySelector('.feature-list');
    if (featureList) {
      featureList.innerHTML = `
        <div class="feature-item">
          <i class="fas fa-check-circle"></i>
          <span>Email verified successfully</span>
        </div>
        <div class="feature-item">
          <i class="fas fa-check-circle"></i>
          <span>Account activated and ready</span>
        </div>
        <div class="feature-item">
          <i class="fas fa-check-circle"></i>
          <span>Login to access all features</span>
        </div>
        <div class="feature-item">
          <i class="fas fa-check-circle"></i>
          <span>Start booking your first service</span>
        </div>
      `;
    }

    // Update "What's Next" title
    const whatsNextTitle = this.overlay.querySelector('.success-features h4');
    if (whatsNextTitle) {
      whatsNextTitle.innerHTML = '<i class="fas fa-arrow-right"></i> Next Steps';
    }

    // Show modal
    this.overlay.classList.add('active');
    
    // Create confetti effect
    this.createConfetti();

    // Play success sound (optional - uncomment if you have sound file)
    // this.playSuccessSound();
  }

  hide() {
    if (!this.overlay) return;
    this.overlay.classList.remove('active');
  }

  createConfetti() {
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'confetti-container';
    document.body.appendChild(confettiContainer);

    const colors = ['#10b981', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#3b82f6'];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        
        confettiContainer.appendChild(confetti);

        // Remove confetti after animation
        setTimeout(() => {
          confetti.remove();
        }, 3500);
      }, i * 30);
    }

    // Remove container after all confetti is done
    setTimeout(() => {
      confettiContainer.remove();
    }, 4000);
  }

  playSuccessSound() {
    // Optional: Add success sound
    try {
      const audio = new Audio('assets/sounds/success.mp3');
      audio.volume = 0.3;
      audio.play().catch(e => console.log('Could not play sound:', e));
    } catch (e) {
      console.log('Sound not available');
    }
  }
}

// Create global instance
const successModal = new SuccessModal();

// Export for use in other files
if (typeof window !== 'undefined') {
  window.successModal = successModal;
}

console.log('✨ Success Modal System Initialized!');
console.log('📌 Modal will redirect to LOGIN page after registration');