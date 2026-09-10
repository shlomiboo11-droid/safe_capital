// Landing page interactions: scroll animations, before/after slider, WhatsApp FAB, smooth scroll

document.addEventListener('DOMContentLoaded', function () {

    // 1. IntersectionObserver for .fade-in-up elements
    const fadeObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                const el = entry.target;
                const delay = el.dataset.delay;
                if (delay) {
                    el.style.transitionDelay = delay + 'ms';
                }
                el.classList.add('visible');
                fadeObserver.unobserve(el);
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.fade-in-up').forEach(function (el) {
        fadeObserver.observe(el);
    });

    // 2. Before/After Slider
    document.querySelectorAll('[data-ba]').forEach(function (container) {
        var dragging = false;
        var afterEl = container.querySelector('.ba-after');
        var handle = container.querySelector('.ba-handle');
        var labelBefore = container.querySelector('.ba-label-before');
        var labelAfter = container.querySelector('.ba-label-after');

        function getPercent(clientX) {
            var rect = container.getBoundingClientRect();
            var x = clientX - rect.left;
            var pct = (x / rect.width) * 100;
            return Math.max(0, Math.min(100, pct));
        }

        function update(pct) {
            if (afterEl) afterEl.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
            if (handle) handle.style.left = pct + '%';
            // Fade labels based on handle position
            if (labelBefore) labelBefore.style.opacity = pct < 85 ? '1' : '0';
            if (labelAfter) labelAfter.style.opacity = pct > 15 ? '1' : '0';
        }

        container.addEventListener('mousedown', function (e) {
            e.preventDefault();
            dragging = true;
            update(getPercent(e.clientX));
        });

        container.addEventListener('touchstart', function (e) {
            dragging = true;
            update(getPercent(e.touches[0].clientX));
        }, { passive: true });

        window.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            update(getPercent(e.clientX));
        });

        window.addEventListener('touchmove', function (e) {
            if (!dragging) return;
            update(getPercent(e.touches[0].clientX));
        }, { passive: true });

        window.addEventListener('mouseup', function () { dragging = false; });
        window.addEventListener('touchend', function () { dragging = false; });
    });

    // 3. WhatsApp FAB visibility — show after scrolling past hero
    var fab = document.querySelector('.whatsapp-fab');
    var hero = document.getElementById('hero');
    if (fab && hero) {
        function checkFab() {
            var heroBottom = hero.offsetTop + hero.offsetHeight;
            if (window.scrollY > heroBottom) {
                fab.classList.add('visible');
            } else {
                fab.classList.remove('visible');
            }
        }
        window.addEventListener('scroll', checkFab, { passive: true });
        checkFab();
    }

    // 4. Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            var targetId = link.getAttribute('href');
            if (targetId === '#') return;
            var target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

});
