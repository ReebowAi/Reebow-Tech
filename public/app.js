/**
 * Aetheria Core — Autonomous Environment & Spatial Interaction Script
 * Manages holographic ambient lighting physics, PWA installation flows,
 * touch-safe navigation states, and dynamic pricing calculations.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Service Worker & Offline Runtime Initialization
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('[Core] Spatial Runtime active:', reg.scope))
                .catch(err => console.error('[Core] Runtime registration fault:', err));
        });
    }

    // 2. Quantum Ambient Light Interaction Engine
    const canvas = document.getElementById('ambient-environment-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width, height;
        let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, targetX: window.innerWidth / 2, targetY: window.innerHeight / 2 };

        function resizeEnvironment() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeEnvironment);
        resizeEnvironment();

        window.addEventListener('mousemove', (e) => {
            pointer.targetX = e.clientX;
            pointer.targetY = e.clientY;
        });

        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                pointer.targetX = e.touches[0].clientX;
                pointer.targetY = e.touches[0].clientY;
            }
        }, { passive: true });

        class QuantumLightNode {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 0.6;
                this.vy = (Math.random() - 0.5) * 0.6;
                this.radius = Math.random() * 220 + 90;
                this.color = Math.random() > 0.4 ? 'rgba(6, 182, 212, 0.14)' : 'rgba(168, 85, 247, 0.11)';
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                if (this.x < -50 || this.x > width + 50) this.vx *= -1;
                if (this.y < -50 || this.y > height + 50) this.vy *= -1;
            }

            draw() {
                ctx.beginPath();
                const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
                grad.addColorStop(0, this.color);
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const nodes = Array.from({ length: 8 }, () => new QuantumLightNode());

        function renderEnvironmentLoop() {
            ctx.clearRect(0, 0, width, height);

            // Inertial pointer calculation for responsive light tracking
            pointer.x += (pointer.targetX - pointer.x) * 0.04;
            pointer.y += (pointer.targetY - pointer.y) * 0.04;

            ctx.beginPath();
            const pointerGlow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 380);
            pointerGlow.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
            pointerGlow.addColorStop(1, 'transparent');
            ctx.fillStyle = pointerGlow;
            ctx.arc(pointer.x, pointer.y, 380, 0, Math.PI * 2);
            ctx.fill();

            nodes.forEach(node => {
                node.update();
                node.draw();
            });

            requestAnimationFrame(renderEnvironmentLoop);
        }
        renderEnvironmentLoop();
    }

    // 3. Custom Install Banner & PWA Prompt Logic
    let deferredPrompt = null;
    const banner = document.getElementById('pwa-banner');
    const installBtn = document.getElementById('pwa-install');
    const dismissBtn = document.getElementById('pwa-dismiss');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        setTimeout(() => {
            if (banner) {
                banner.removeAttribute('hidden');
                banner.style.pointerEvents = 'auto';
            }
        }, 12000);
    });

    installBtn?.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] User install choice outcome:', outcome);
        
        deferredPrompt = null;
        if (banner) {
            banner.setAttribute('hidden', '');
            banner.style.pointerEvents = 'none';
        }
    });

    dismissBtn?.addEventListener('click', () => {
        if (banner) {
            banner.setAttribute('hidden', '');
            banner.style.pointerEvents = 'none';
        }
    });

    // 4. Mobile Navigation Toggle & Touch Lock Prevention Fix
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (navMenu && navMenu.hasAttribute('hidden')) {
        navMenu.style.pointerEvents = 'none';
    }

    navToggle?.addEventListener('click', () => {
        const isHidden = navMenu.hasAttribute('hidden');
        if (isHidden) {
            navMenu.removeAttribute('hidden');
            navToggle.setAttribute('aria-expanded', 'true');
            navMenu.style.pointerEvents = 'auto';
        } else {
            navMenu.setAttribute('hidden', '');
            navToggle.setAttribute('aria-expanded', 'false');
            navMenu.style.pointerEvents = 'none';
        }
    });

    navMenu?.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.setAttribute('hidden', '');
            navToggle?.setAttribute('aria-expanded', 'false');
            navMenu.style.pointerEvents = 'none';
        });
    });

    // 5. Pricing Tier Dynamic Toggle (Monthly / Yearly)
    const billingToggle = document.getElementById('billing-toggle');
    billingToggle?.addEventListener('change', () => {
        const isYearly = billingToggle.checked;
        
        document.querySelectorAll('.pricing-card .amount').forEach(el => {
            const priceVal = isYearly ? el.dataset.yearly : el.dataset.monthly;
            el.textContent = `$${priceVal}`;
        });
        
        document.querySelectorAll('.pricing-card .period').forEach(el => {
            el.textContent = isYearly ? '/year' : '/month';
        });
    });

    // 6. Hero Section Interactive Frame Loader
    const heroPreview = document.getElementById('hero-preview');
    if (heroPreview) {
        heroPreview.innerHTML = `<iframe src="/visitor.html?demo=true&embed=true" style="width:100%; height:100%; border:none; border-radius: 8px;" title="Spatial Client Live Preview"></iframe>`;
    }
});
