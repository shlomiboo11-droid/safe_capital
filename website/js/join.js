// ===== Join Page: Sticky Progress Bar + Scroll Coloring + Confetti =====
(function() {
    'use strict';

    const progressBar = document.getElementById('step-progress-bar');
    const progressLineFill = document.getElementById('progress-line-fill');
    const circles = document.querySelectorAll('.step-progress-circle');
    const stepSections = [];
    let confettiFired = false;

    // Collect step sections
    for (let i = 1; i <= 6; i++) {
        const section = document.getElementById('step-section-' + i);
        if (section) stepSections.push(section);
    }

    if (!progressBar || stepSections.length === 0) return;

    // --- Scroll handler: update progress bar ---
    function updateProgress() {
        const scrollY = window.scrollY || window.pageYOffset;
        const viewportH = window.innerHeight;
        const triggerPoint = viewportH * 0.4; // 40% from top

        // Add scrolled shadow
        if (scrollY > 200) {
            progressBar.classList.add('scrolled');
        } else {
            progressBar.classList.remove('scrolled');
        }

        // Determine active step
        let activeStep = 0;
        stepSections.forEach(function(section, index) {
            const rect = section.getBoundingClientRect();
            if (rect.top < triggerPoint) {
                activeStep = index + 1;
            }
        });

        // Update circles
        circles.forEach(function(circle, index) {
            const step = index + 1;
            circle.classList.remove('active', 'completed');
            if (step < activeStep) {
                circle.classList.add('completed');
            } else if (step === activeStep) {
                circle.classList.add('active');
            }
        });

        // Update fill line (RTL: fills from right to left, CSS right property)
        if (activeStep <= 1) {
            progressLineFill.style.width = '0%';
        } else {
            // Calculate percentage: (activeStep - 1) / (totalSteps - 1) * 100
            var pct = ((activeStep - 1) / (stepSections.length - 1)) * 100;
            progressLineFill.style.width = pct + '%';
        }

        // Check if user reached the last step for confetti
        if (activeStep >= 6 && !confettiFired) {
            var lastSection = stepSections[stepSections.length - 1];
            var lastRect = lastSection.getBoundingClientRect();
            if (lastRect.top < viewportH * 0.6) {
                confettiFired = true;
                launchConfetti();
            }
        }
    }

    // Throttled scroll listener
    var ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                updateProgress();
                ticking = false;
            });
            ticking = true;
        }
    });

    // Initial call
    updateProgress();

    // ===== Confetti Particle System =====
    function launchConfetti() {
        var canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        var particles = [];
        var colors = ['#022445', '#984349', '#1e3a5c', '#ff9599', '#adc8f2', '#ffdada', '#25D366', '#FFD700'];
        var totalParticles = 150;
        var gravity = 0.12;
        var friction = 0.99;
        var duration = 4000; // ms
        var startTime = Date.now();

        // Create particles
        for (var i = 0; i < totalParticles; i++) {
            particles.push({
                x: canvas.width * 0.5 + (Math.random() - 0.5) * canvas.width * 0.4,
                y: canvas.height * 0.3,
                vx: (Math.random() - 0.5) * 16,
                vy: -Math.random() * 14 - 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 6 + 3,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 12,
                shape: Math.random() > 0.5 ? 'rect' : 'circle',
                opacity: 1
            });
        }

        // Second burst from edges
        for (var j = 0; j < 80; j++) {
            var fromLeft = Math.random() > 0.5;
            particles.push({
                x: fromLeft ? 0 : canvas.width,
                y: canvas.height * 0.2 + Math.random() * canvas.height * 0.3,
                vx: fromLeft ? Math.random() * 10 + 2 : -(Math.random() * 10 + 2),
                vy: -Math.random() * 8 - 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 5 + 2,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                shape: Math.random() > 0.3 ? 'rect' : 'circle',
                opacity: 1
            });
        }

        function animate() {
            var elapsed = Date.now() - startTime;
            if (elapsed > duration) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            var fadeStart = duration * 0.6;
            var globalAlpha = elapsed > fadeStart ? 1 - (elapsed - fadeStart) / (duration - fadeStart) : 1;

            particles.forEach(function(p) {
                p.vy += gravity;
                p.vx *= friction;
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.rotationSpeed;
                p.opacity = globalAlpha;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;

                if (p.shape === 'rect') {
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            });

            requestAnimationFrame(animate);
        }

        animate();

        // Handle resize during animation
        var resizeHandler = function() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resizeHandler);
        setTimeout(function() {
            window.removeEventListener('resize', resizeHandler);
        }, duration);
    }
})();

// ===== Tax Accordion (Step 6) =====
function toggleTaxAccordion(btn) {
    var panel = btn.nextElementSibling;
    var icon = btn.querySelector('.tax-accordion-icon');
    var isOpen = panel.classList.contains('open');

    // Close all panels in the same section
    var parentSection = btn.closest('section');
    if (parentSection) {
        parentSection.querySelectorAll('.tax-accordion-panel').forEach(function(p) {
            p.classList.remove('open');
        });
        parentSection.querySelectorAll('.tax-accordion-icon').forEach(function(ic) {
            ic.classList.remove('open');
        });
        parentSection.querySelectorAll('.tax-accordion-btn').forEach(function(b) {
            b.removeAttribute('aria-expanded');
        });
    }

    // Toggle the clicked one
    if (!isOpen) {
        panel.classList.add('open');
        icon.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
    }
}
