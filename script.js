// =============================================
// JavaScript for teoni Volt Pro Website
// =============================================

'use strict';

// 1. ScrollSpy - Change active nav link based on scroll position
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('.nav-links a');

function updateActiveNavLink() {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= (sectionTop - 100)) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(current)) {
            link.classList.add('active');
        }
    });
}

// 2. Reveal on Scroll Animation
function revealElements() {
    const reveals = document.querySelectorAll('.reveal');
    reveals.forEach(el => {
        const windowHeight = window.innerHeight;
        const revealTop = el.getBoundingClientRect().top;
        const revealPoint = 150;

        if (revealTop < windowHeight - revealPoint) {
            el.classList.add('active');
        }
    });
}

// 3. Mobile Menu Toggle
const mobileMenu = document.getElementById('mobile-menu');
const navLinksContainer = document.querySelector('.nav-links');

function toggleMobileMenu() {
    mobileMenu.classList.toggle('active');
    navLinksContainer.classList.toggle('active');
}

// 4. Smooth Scrolling for Navigation Links
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                // Close mobile menu if open
                mobileMenu.classList.remove('active');
                navLinksContainer.classList.remove('active');
            }
        });
    });
}

// 5. Performance optimization - Throttle scroll events
let scrollTimeout;
function throttledScrollHandler() {
    if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout);
    }
    
    scrollTimeout = window.requestAnimationFrame(() => {
        updateActiveNavLink();
        revealElements();
    });
}

// 6. Image Gallery Modal
const modal = document.getElementById('imageModal');
const modalImg = document.getElementById('modalImage');
const modalClose = document.querySelector('.modal-close');

// Add click event to all portfolio images
document.addEventListener('DOMContentLoaded', function() {
    const portfolioImages = document.querySelectorAll('.portfolio-item img');
    
    portfolioImages.forEach(img => {
        img.addEventListener('click', function() {
            openModal(this.src, this.alt);
        });
    });
    
    // Close modal when clicking on close button or outside image
    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
    
    // Image loading optimization with lazy loading
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
});

function openModal(src, alt) {
    modal.classList.add('active');
    modalImg.src = src;
    modalImg.alt = alt;
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto'; // Restore scrolling
}

// 7. Image loading optimization
function optimizeImageLoading() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        // Add loading state
        img.classList.add('loading');
        
        img.addEventListener('load', function() {
            this.classList.remove('loading');
            this.classList.add('loaded');
        });
        
        img.addEventListener('error', function() {
            this.classList.remove('loading');
            this.classList.add('error');
            console.error(`Failed to load image: ${this.src}`);
        });
    });
}

// 7. WhatsApp button functionality
function initWhatsAppButton() {
    const whatsappBtn = document.querySelector('.whatsapp-float');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', (e) => {
            // Add tracking or analytics here
            if (typeof gtag !== 'undefined') {
                gtag('event', 'whatsapp_click', {
                    'event_category': 'engagement',
                    'event_label': 'whatsapp_button'
                });
            }
            console.log('WhatsApp button clicked');
        });
    }
}

// 8. Form validation (if forms are added later)
function validateForm(form) {
    const inputs = form.querySelectorAll('input, textarea, select');
    let isValid = true;
    
    inputs.forEach(input => {
        if (input.hasAttribute('required') && !input.value.trim()) {
            isValid = false;
            input.classList.add('error');
        } else {
            input.classList.remove('error');
        }
    });
    
    return isValid;
}

// 9. Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize smooth scrolling
    initSmoothScrolling();
    
    // Optimize image loading
    optimizeImageLoading();
    
    // Initialize WhatsApp button
    initWhatsAppButton();
    
    // Initialize mobile menu
    if (mobileMenu) {
        mobileMenu.addEventListener('click', toggleMobileMenu);
    }
    
    // Initial reveal check
    revealElements();
    
    // Initial active link check
    updateActiveNavLink();
    
    console.log('teoni Volt Pro website initialized successfully');
});

// 10. Window resize handler for responsive adjustments
let resizeTimeout;
window.addEventListener('resize', () => {
    if (resizeTimeout) {
        clearTimeout(resizeTimeout);
    }
    
    resizeTimeout = setTimeout(() => {
        // Handle responsive adjustments
        if (window.innerWidth > 768) {
            mobileMenu.classList.remove('active');
            navLinksContainer.classList.remove('active');
        }
    }, 250);
});

// 11. Scroll event listeners
window.addEventListener('scroll', throttledScrollHandler);

// 12. Page load optimizations
window.addEventListener('load', () => {
    // Remove loading states
    document.body.classList.add('loaded');
    
    // Final reveal check
    revealElements();
    
    console.log('Page fully loaded');
});

// 13. Error handling
window.addEventListener('error', (e) => {
    console.error('JavaScript error:', e.error);
});

// 14. Service Worker registration for PWA (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// 15. Export functions for potential external use
window.VoltPro = {
    toggleMobileMenu,
    updateActiveNavLink,
    revealElements,
    validateForm
};