/**
 * Reebow TECH - Main Application & PWA Script
 * Handles initialization, service worker registration, PWA installation prompts,
 * and mobile navigation interactivity.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('[PWA] Service Worker registered successfully:', reg.scope))
                .catch(err => console.error('[PWA] Service Worker registration failed:', err));
        });
    }

    // 2. Custom Install Banner & PWA Prompt Logic
    let deferredPrompt = null;
    const banner = document.getElementById('pwa-banner');
    const installBtn = document.getElementById('pwa-install');
    const dismissBtn = document.getElementById('pwa-dismiss');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        
        // Display the custom install banner after a 10-second delay on the page
        setTimeout(() => {
            if (banner) {
                banner.removeAttribute('hidden');
                banner.style.pointerEvents = 'auto';
            }
        }, 10000);
    });

    installBtn?.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] User install choice outcome:', outcome);
        
        // Clear the deferred prompt variable, as it can no longer be used
        deferredPrompt = null;
        
        // Hide the banner safely by adding hidden and disabling clicks
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

    // 3. Mobile Navigation Toggle & Touch Lock Prevention Fix
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.getElementById('nav-menu');

    // Ensure safe default state so the dropdown doesn't trap touch events when hidden
    if (navMenu && navMenu.hasAttribute('hidden')) {
        navMenu.style.pointerEvents = 'none';
    }

    navToggle?.addEventListener('click', () => {
        const isHidden = navMenu.hasAttribute('hidden');
        if (isHidden) {
            navMenu.removeAttribute('hidden');
            navToggle.setAttribute('aria-expanded', 'true');
            navMenu.style.pointerEvents = 'auto'; // Allow input interaction when menu opens
        } else {
            navMenu.setAttribute('hidden', '');
            navToggle.setAttribute('aria-expanded', 'false');
            navMenu.style.pointerEvents = 'none'; // Prevent invisible layer from blocking clicks
        }
    });

    // Close mobile dropdown automatically when clicking any link inside it
    navMenu?.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.setAttribute('hidden', '');
            navToggle?.setAttribute('aria-expanded', 'false');
            navMenu.style.pointerEvents = 'none';
        });
    });

    // 4. Pricing Tier Dynamic Toggle (Monthly / Yearly)
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

    // 5. Hero Section Interactive Frame Loader
    const heroPreview = document.getElementById('hero-preview');
    if (heroPreview) {
        heroPreview.innerHTML = `<iframe src="/visitor.html?demo=true&embed=true" style="width:100%; height:100%; border:none; border-radius: 8px;" title="Visitor Chat Live Preview"></iframe>`;
    }
});
