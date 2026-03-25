// ============================================
// CONTACT PAGE JAVASCRIPT
// ============================================

console.log("📧 Contact Page JavaScript Loaded!");

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ DOM loaded, initializing contact page...");

    // ============================================
    // GET DOM ELEMENTS
    // ============================================
    
    const contactForm = document.getElementById('contactForm');
    const messageTextarea = document.getElementById('message');
    const charCount = document.querySelector('.char-count');
    const faqItems = document.querySelectorAll('.faq-item');
    const ctaButtons = document.querySelectorAll('.cta-btn');

    // ============================================
    // CHARACTER COUNTER FOR MESSAGE
    // ============================================
    
    if (messageTextarea && charCount) {
        const maxLength = 500;
        
        messageTextarea.addEventListener('input', function() {
            const currentLength = this.value.length;
            charCount.textContent = `${currentLength} / ${maxLength}`;
            
            // Color change when approaching limit
            if (currentLength > maxLength * 0.9) {
                charCount.style.color = '#ef4444';
            } else if (currentLength > maxLength * 0.7) {
                charCount.style.color = '#f59e0b';
            } else {
                charCount.style.color = 'var(--text-secondary)';
            }
            
            // Enforce max length
            if (currentLength > maxLength) {
                this.value = this.value.substring(0, maxLength);
                charCount.textContent = `${maxLength} / ${maxLength}`;
            }
        });
    }

    // ============================================
    // FORM VALIDATION & SUBMISSION
    // ============================================
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = {
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value
            };
            
            // Validate form
            if (!validateForm(formData)) {
                return;
            }
            
            // Submit form
            submitContactForm(formData);
        });
    }

    // ============================================
    // FORM VALIDATION
    // ============================================
    
    function validateForm(data) {
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            showNotification('Please enter a valid email address', 'error');
            return false;
        }
        
        // Phone validation (basic)
        const phoneRegex = /^[\d\s+()-]{10,}$/;
        if (!phoneRegex.test(data.phone)) {
            showNotification('Please enter a valid phone number', 'error');
            return false;
        }
        
        // Message length
        if (data.message.length < 10) {
            showNotification('Message must be at least 10 characters long', 'error');
            return false;
        }
        
        // Subject selection
        if (!data.subject) {
            showNotification('Please select a subject', 'error');
            return false;
        }
        
        return true;
    }

    // ============================================
    // SUBMIT CONTACT FORM
    // ============================================
    
    function submitContactForm(data) {
        const submitBtn = contactForm.querySelector('.form-submit-btn');
        
        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Sending...</span>';
        
        // Simulate API call (replace with actual API call)
        setTimeout(() => {
            // Success
            console.log('📤 Form submitted:', data);
            
            // Store in localStorage (for demo - replace with API)
            try {
                const submissions = JSON.parse(localStorage.getItem('contactSubmissions') || '[]');
                submissions.push({
                    ...data,
                    timestamp: new Date().toISOString()
                });
                localStorage.setItem('contactSubmissions', JSON.stringify(submissions));
            } catch (e) {
                console.warn('Could not save to localStorage:', e);
            }
            
            // Reset form
            contactForm.reset();
            if (charCount) {
                charCount.textContent = '0 / 500';
                charCount.style.color = 'var(--text-secondary)';
            }
            
            // Show success message
            showNotification('Message sent successfully! We\'ll get back to you soon.', 'success');
            
            // Reset button
            submitBtn.classList.remove('loading');
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i><span>Send Message</span><div class="btn-shine"></div>';
            
            // Optional: Show thank you modal or redirect
            showThankYouMessage(data.firstName);
            
        }, 2000);
    }

    // ============================================
    // THANK YOU MESSAGE
    // ============================================
    
    function showThankYouMessage(name) {
        // Create thank you overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;
        
        overlay.innerHTML = `
            <div style="
                background: var(--primary-bg);
                padding: 3rem 2rem;
                border-radius: 24px;
                text-align: center;
                max-width: 500px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideUp 0.3s ease;
            ">
                <div style="
                    width: 100px;
                    height: 100px;
                    margin: 0 auto 1.5rem;
                    background: linear-gradient(135deg, #10b981, #059669);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: scaleIn 0.5s ease;
                ">
                    <i class="fas fa-check" style="font-size: 3rem; color: white;"></i>
                </div>
                <h2 style="
                    font-size: 2rem;
                    font-weight: 800;
                    color: var(--text-primary);
                    margin-bottom: 1rem;
                ">Thank You, ${name}!</h2>
                <p style="
                    font-size: 1.1rem;
                    color: var(--text-secondary);
                    line-height: 1.6;
                    margin-bottom: 2rem;
                ">Your message has been received. We'll get back to you within 24 hours.</p>
                <button onclick="this.closest('div[style*=fixed]').remove()" style="
                    padding: 1rem 2rem;
                    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.3s ease;
                ">Got it!</button>
            </div>
        `;
        
        // Add animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes scaleIn {
                from { transform: scale(0); }
                to { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(overlay);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            overlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => overlay.remove(), 300);
        }, 5000);
    }

    // ============================================
    // FAQ ACCORDION
    // ============================================
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            // Close other FAQs
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current FAQ
            item.classList.toggle('active');
            
            console.log('❓ FAQ toggled:', question.textContent.trim());
        });
    });

    // ============================================
    // CTA BUTTON HANDLERS
    // ============================================
    
    ctaButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const btnText = this.textContent.trim();
            
            if (btnText.includes('Call')) {
                window.location.href = 'tel:+919876543210';
                console.log('📞 Initiating phone call...');
            } else if (btnText.includes('Chat')) {
                showNotification('Live chat feature coming soon!', 'info');
                console.log('💬 Live chat clicked');
            }
        });
    });

    // ============================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // ============================================
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href && href !== '#') {
                e.preventDefault();
                
                const targetId = href.substring(1);
                const targetSection = document.getElementById(targetId);
                
                if (targetSection) {
                    targetSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    
                    console.log('🎯 Scrolled to:', targetId);
                }
            }
        });
    });

    // ============================================
    // NOTIFICATION SYSTEM
    // ============================================
    
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
            z-index: 10001;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Make notification global
    window.showNotification = showNotification;

    // ============================================
    // REAL-TIME FORM INPUT EFFECTS
    // ============================================
    
    const formInputs = document.querySelectorAll('.form-input, .form-select, .form-textarea');
    
    formInputs.forEach(input => {
        // Focus effect
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'translateX(5px)';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'translateX(0)';
        });
        
        // Input validation
        input.addEventListener('input', function() {
            if (this.validity.valid) {
                this.style.borderColor = '#10b981';
            } else if (this.value.length > 0) {
                this.style.borderColor = '#ef4444';
            } else {
                this.style.borderColor = 'var(--border-color)';
            }
        });
    });

    // ============================================
    // INTERSECTION OBSERVER FOR ANIMATIONS
    // ============================================
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe all animated elements
    document.querySelectorAll('.info-card, .faq-item, .form-group').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // ============================================
    // INFO CARD CLICK HANDLERS
    // ============================================
    
    const infoCardLinks = document.querySelectorAll('.info-card-link');
    
    infoCardLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const linkText = this.textContent.trim();
            console.log('🔗 Info card link clicked:', linkText);
            
            // You can add tracking or analytics here
        });
    });

    // ============================================
    // SOCIAL MEDIA CARDS TRACKING
    // ============================================
    
    const socialCards = document.querySelectorAll('.social-card');
    
    socialCards.forEach(card => {
        card.addEventListener('click', function(e) {
            const platform = this.querySelector('.social-card-title').textContent;
            const url = this.href;
            
            console.log(`📱 Redirecting to ${platform}: ${url}`);
            
            // Track social media clicks (for analytics)
            trackSocialClick(platform, url);
            
            // Show notification
            showNotification(`Opening ${platform}...`, 'info');
        });
    });
    
    function trackSocialClick(platform, url) {
        try {
            const clicks = JSON.parse(localStorage.getItem('socialClicks') || '{}');
            clicks[platform] = (clicks[platform] || 0) + 1;
            localStorage.setItem('socialClicks', JSON.stringify(clicks));
            console.log(`✅ Social click tracked: ${platform}`);
        } catch (e) {
            console.warn('Could not track social click:', e);
        }
    }
    
    // WhatsApp specific - add message parameter
    const whatsappCard = document.querySelector('.whatsapp-card');
    if (whatsappCard) {
        whatsappCard.addEventListener('click', function(e) {
            e.preventDefault();
            const phoneNumber = '919876543210';
            const message = encodeURIComponent('Hi! I have a question about Quick Laundry services.');
            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
            window.open(whatsappUrl, '_blank');
            showNotification('Opening WhatsApp...', 'success');
        });
    }

    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================
    
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + K to focus on message textarea
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (messageTextarea) {
                messageTextarea.focus();
                messageTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                console.log('⌨️ Focused on message textarea');
            }
        }
    });

    // ============================================
    // AUTO-SAVE FORM (DRAFT)
    // ============================================
    
    let autoSaveTimeout;
    
    function autoSaveForm() {
        if (!contactForm) return;
        
        const formData = {
            firstName: document.getElementById('firstName')?.value || '',
            lastName: document.getElementById('lastName')?.value || '',
            email: document.getElementById('email')?.value || '',
            phone: document.getElementById('phone')?.value || '',
            subject: document.getElementById('subject')?.value || '',
            message: document.getElementById('message')?.value || ''
        };
        
        try {
            localStorage.setItem('contactFormDraft', JSON.stringify(formData));
            console.log('💾 Form draft auto-saved');
        } catch (e) {
            console.warn('Could not auto-save form:', e);
        }
    }
    
    // Auto-save on input with debounce
    formInputs.forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(autoSaveForm, 1000);
        });
    });
    
    // Load draft on page load
    function loadFormDraft() {
        try {
            const draft = localStorage.getItem('contactFormDraft');
            if (draft) {
                const data = JSON.parse(draft);
                
                if (data.firstName) document.getElementById('firstName').value = data.firstName;
                if (data.lastName) document.getElementById('lastName').value = data.lastName;
                if (data.email) document.getElementById('email').value = data.email;
                if (data.phone) document.getElementById('phone').value = data.phone;
                if (data.subject) document.getElementById('subject').value = data.subject;
                if (data.message) {
                    document.getElementById('message').value = data.message;
                    // Update character count
                    if (charCount) {
                        charCount.textContent = `${data.message.length} / 500`;
                    }
                }
                
                console.log('📝 Form draft loaded');
            }
        } catch (e) {
            console.warn('Could not load form draft:', e);
        }
    }
    
    loadFormDraft();
    
    // Clear draft on successful submission
    window.addEventListener('formSubmitted', () => {
        try {
            localStorage.removeItem('contactFormDraft');
            console.log('🗑️ Form draft cleared');
        } catch (e) {
            console.warn('Could not clear form draft:', e);
        }
    });

    console.log("🎉 Contact page fully initialized!");
    console.log("📋 Features:");
    console.log("   - Form validation");
    console.log("   - Character counter");
    console.log("   - FAQ accordion");
    console.log("   - Auto-save draft");
    console.log("   - Smooth animations");
    console.log("   - Keyboard shortcuts (Ctrl+K)");
});