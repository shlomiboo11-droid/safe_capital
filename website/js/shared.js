// Tailwind config (shared across all pages)
if (typeof tailwind !== 'undefined') {
    tailwind.config = {
        darkMode: "class",
        theme: {
            extend: {
                colors: {
                    "on-secondary-container": "#792b31",
                    "background": "#fbf9f6",
                    "on-primary-fixed-variant": "#2d486b",
                    "on-tertiary-fixed": "#1c1b1b",
                    "on-secondary-fixed": "#40010b",
                    "surface": "#fbf9f6",
                    "on-primary-container": "#8aa4cc",
                    "surface-container-highest": "#e4e2df",
                    "tertiary": "#242423",
                    "surface-container-high": "#eae8e5",
                    "primary-fixed": "#d3e3ff",
                    "surface-variant": "#e4e2df",
                    "primary-fixed-dim": "#adc8f2",
                    "inverse-on-surface": "#f2f0ed",
                    "on-background": "#1b1b1f",
                    "outline-variant": "#c4c6cf",
                    "on-secondary": "#ffffff",
                    "surface-bright": "#fbf9f6",
                    "primary": "#022445",
                    "on-primary-fixed": "#001c39",
                    "surface-tint": "#456084",
                    "secondary": "#984349",
                    "tertiary-fixed-dim": "#c8c6c5",
                    "on-tertiary-container": "#a4a2a2",
                    "surface-container-low": "#f5f3f0",
                    "secondary-container": "#ff9599",
                    "primary-container": "#1e3a5c",
                    "inverse-primary": "#adc8f2",
                    "on-tertiary-fixed-variant": "#474746",
                    "on-error-container": "#93000a",
                    "surface-container-lowest": "#ffffff",
                    "on-surface-variant": "#43474e",
                    "secondary-fixed-dim": "#ffb3b4",
                    "error": "#ba1a1a",
                    "on-error": "#ffffff",
                    "tertiary-fixed": "#e5e2e1",
                    "surface-dim": "#dbdad7",
                    "on-surface": "#1b1b1f",
                    "tertiary-container": "#393939",
                    "error-container": "#ffdad6",
                    "on-primary": "#ffffff",
                    "on-secondary-fixed-variant": "#7a2d33",
                    "on-tertiary": "#ffffff",
                    "secondary-fixed": "#ffdada",
                    "outline": "#74777f",
                    "surface-container": "#efeeeb",
                    "inverse-surface": "#30312f",
                    "whatsapp": "#25D366"
                },
                fontFamily: {
                    "headline": ["Heebo"],
                    "body": ["Heebo"],
                    "label": ["Inter"]
                },
                borderRadius: {"DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px"},
            },
        },
    };
}

// Portal link URL — portal is hosted on the admin server
const PORTAL_URL = (window.location.hostname === 'localhost')
  ? 'http://localhost:3000/portal/login.html'
  : 'https://safe-capital-admin.vercel.app/portal/login.html';

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    // Inject "אזור אישי" portal link into nav
    const navLinks = document.querySelector('.site-nav .nav-links');
    const mobileNavEl = document.querySelector('.site-nav .mobile-nav');
    if (navLinks) {
        const portalLink = document.createElement('a');
        portalLink.href = PORTAL_URL;
        portalLink.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle;margin-left:4px;">person</span>אזור אישי';
        portalLink.style.cssText = 'display:inline-flex;align-items:center;gap:2px;';
        navLinks.appendChild(portalLink);
    }
    if (mobileNavEl) {
        const mobilePortalLink = document.createElement('a');
        mobilePortalLink.href = PORTAL_URL;
        mobilePortalLink.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;vertical-align:middle;margin-left:4px;">person</span>אזור אישי';
        // Insert before the CTA button
        const mobileCta = mobileNavEl.querySelector('.mobile-cta');
        if (mobileCta) {
            mobileNavEl.insertBefore(mobilePortalLink, mobileCta);
        } else {
            mobileNavEl.appendChild(mobilePortalLink);
        }
    }

    // Standard site nav mobile menu
    const siteMenuBtn = document.querySelector('.site-nav .mobile-menu-btn');
    const siteMenuPanel = document.querySelector('.site-nav .mobile-nav');
    if (siteMenuBtn && siteMenuPanel) {
        siteMenuBtn.addEventListener('click', () => {
            siteMenuPanel.classList.toggle('open');
            const icon = siteMenuBtn.querySelector('.material-symbols-outlined');
            if (icon) icon.textContent = siteMenuPanel.classList.contains('open') ? 'close' : 'menu';
        });
    }

    // Legacy mobile menu toggle (backward compat)
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => mobileMenu.classList.toggle('open'));
    }

    // FAQ accordion
    document.querySelectorAll('.faq-item').forEach(item => {
        item.addEventListener('click', () => {
            const answer = item.querySelector('.faq-answer');
            const icon = item.querySelector('.faq-icon');
            const isOpen = answer.classList.contains('open');
            // Close all
            document.querySelectorAll('.faq-answer').forEach(a => a.classList.remove('open'));
            document.querySelectorAll('.faq-icon').forEach(i => i.classList.remove('open'));
            // Open clicked (if was closed)
            if (!isOpen) {
                answer.classList.add('open');
                icon.classList.add('open');
            }
        });
    });

    // Deal accordion
    document.querySelectorAll('.deal-header').forEach(header => {
        header.addEventListener('click', () => {
            const expanded = header.nextElementSibling;
            const arrow = header.querySelector('.deal-arrow');
            const label = header.querySelector('.deal-arrow-label');
            const isOpen = expanded.classList.contains('open');
            // Close all
            document.querySelectorAll('.deal-expanded').forEach(d => d.classList.remove('open'));
            document.querySelectorAll('.deal-arrow').forEach(a => a.classList.remove('open'));
            document.querySelectorAll('.deal-arrow-label').forEach(l => l.textContent = '\u05DC\u05E4\u05D9\u05E8\u05D5\u05D8 \u05DE\u05DC\u05D0');
            if (!isOpen) {
                expanded.classList.add('open');
                if (arrow) arrow.classList.add('open');
                if (label) label.textContent = '\u05E1\u05D2\u05D9\u05E8\u05D4';
            }
        });
    });

    // Tooltip toggles
    document.querySelectorAll('[data-tooltip]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = document.getElementById(btn.dataset.tooltip);
            if (target) target.classList.toggle('hidden');
        });
    });

    // Close tooltips on outside click
    document.addEventListener('click', () => {
        document.querySelectorAll('.tooltip-popup').forEach(t => t.classList.add('hidden'));
    });

    // ===== Carousel / Scroll-Snap with Dot Indicators =====
    function initCarousels() {
        document.querySelectorAll('.carousel-wrapper').forEach(wrapper => {
            const track = wrapper.querySelector('.carousel-track');
            const dotsContainer = wrapper.querySelector('.carousel-dots');
            if (!track || !dotsContainer) return;

            const cards = Array.from(track.children);
            if (cards.length === 0) return;

            // Create dots
            dotsContainer.innerHTML = '';
            cards.forEach((_, i) => {
                const dot = document.createElement('button');
                dot.classList.add('dot');
                dot.setAttribute('aria-label', 'Slide ' + (i + 1));
                if (i === 0) dot.classList.add('active');
                dot.addEventListener('click', () => {
                    cards[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
                });
                dotsContainer.appendChild(dot);
            });

            // Update dots on scroll
            let scrollTimeout;
            track.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    const trackRect = track.getBoundingClientRect();
                    const trackCenter = trackRect.left + trackRect.width / 2;
                    let closestIdx = 0;
                    let closestDist = Infinity;
                    cards.forEach((card, i) => {
                        const cardRect = card.getBoundingClientRect();
                        const cardCenter = cardRect.left + cardRect.width / 2;
                        const dist = Math.abs(cardCenter - trackCenter);
                        if (dist < closestDist) {
                            closestDist = dist;
                            closestIdx = i;
                        }
                    });
                    dotsContainer.querySelectorAll('.dot').forEach((dot, i) => {
                        dot.classList.toggle('active', i === closestIdx);
                    });
                }, 50);
            });
        });
    }

    // Only init carousels on mobile
    if (window.innerWidth < 768) {
        initCarousels();
    }
    window.addEventListener('resize', () => {
        if (window.innerWidth < 768) {
            initCarousels();
        }
    });

    // Form validation
    const form = document.getElementById('contact-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const successMsg = document.getElementById('form-success');
            if (successMsg) {
                form.classList.add('hidden');
                successMsg.classList.remove('hidden');
            }
        });
    }
});
