/**
 * main.js — Luxury Birthday Website
 * ============================================================
 * Handles: loading screen, door interaction, page transition,
 *          music toggle, easter egg, particle canvas.
 *
 * Rules:
 *  - Vanilla JS only, no frameworks
 *  - Every DOM query is null-safe
 *  - No global variable pollution (IIFE wrapper)
 *  - No uncaught exceptions
 *  - All audit fixes from code review applied
 * ============================================================
 */

(function () {
  "use strict";

  /* ============================================================
     CONFIGURATION
     All timing values in one place — edit here only.
     ============================================================ */

  const CONFIG = {
    loading: {
      barDuration:      2200,   // ms — loading bar fill duration
      line1Delay:        300,   // ms — delay before line 1 fades in
      line2Delay:        900,   // ms — delay before line 2 fades in
      exitPause:         400,   // ms — breath after bar completes before exit
      exitFadeDuration:  800,   // ms — loading screen fade-out
      maxDuration:      6000,   // ms — hard safety cap, forces exit no matter what
    },
    door: {
      transitionDelay:  1800,   // ms — after door-is-open class, before page transition
    },
    pageTransition: {
      fadeDuration:      700,   // ms — overlay fade duration (matches CSS --dur-slow)
      redirectDelay:    1200,   // ms — wait after fade starts before redirect fires
      href:          "wish.html",
    },
    particles: {
      count:              50,
      minRadius:         0.8,
      maxRadius:         2.2,
      minSpeed:         0.08,
      maxSpeed:          0.30,
      minOpacity:       0.12,
      maxOpacity:        0.50,
      color:      "212, 175, 55",   // RGB of --color-gold
    },
  };


  /* ============================================================
     UTILITIES
     ============================================================ */

  /** Safe querySelector — never throws */
  function qs(selector, root) {
    try { return (root || document).querySelector(selector); }
    catch { return null; }
  }

  /** Random float between min and max */
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  /** Clamp value between min and max */
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  /** Promise-based delay */
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Prefixed console log for easy filtering */
  function log(msg, ...args) {
    console.log(`[Birthday] ${msg}`, ...args);
  }

  /** Check user's motion preference */
  function prefersReducedMotion() {
    return window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  }


  /* ============================================================
     SECTION 1 — LOADING SCREEN
     ============================================================
     Three-layer safety guarantee:
       1. Normal async sequence → finally() always calls exit
       2. Hard 6-second cap calls forceExit regardless
       3. dataset.exited flag prevents double-exit
     ============================================================ */

  function initLoadingScreen() {
    const screen   = qs("#loadingScreen");
    const mainPage = qs("#mainPage");

    if (!screen) {
      log("No loading screen found — revealing main page directly.");
      revealMainPage(mainPage);
      return;
    }

    log("Loading screen: start.");
    document.body.classList.add("no-scroll");

    /* Hard safety cap — fires if anything in the sequence hangs */
    const safetyTimer = setTimeout(() => {
      log("SAFETY CAP triggered — forcing exit.");
      forceExitLoadingScreen(screen, mainPage);
    }, CONFIG.loading.maxDuration);

    runLoadingSequence(screen)
      .catch((err) => {
        log("Loading sequence non-fatal error:", err);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        exitLoadingScreen(screen, mainPage);
      });
  }

  async function runLoadingSequence(screen) {
    const barFill = qs("#loadingBarFill", screen);
    const line1   = qs("#loadingLine1",   screen);
    const line2   = qs("#loadingLine2",   screen);

    if (prefersReducedMotion()) {
      /* Skip animation entirely for accessibility */
      if (line1)   line1.style.opacity  = "1";
      if (line2)   line2.style.opacity  = "1";
      if (barFill) barFill.style.width  = "100%";
      await wait(600);
      return;
    }

    /* Line 1 */
    await wait(CONFIG.loading.line1Delay);
    if (line1) {
      line1.style.transition = "opacity 600ms ease";
      line1.style.opacity    = "1";
    }

    /* Line 2 */
    await wait(CONFIG.loading.line2Delay - CONFIG.loading.line1Delay);
    if (line2) {
      line2.style.transition = "opacity 600ms ease";
      line2.style.opacity    = "1";
    }

    /* Bar fills from this exact moment — wait its full duration */
    if (barFill) {
      barFill.style.transition = `width ${CONFIG.loading.barDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      void barFill.offsetWidth; /* force reflow so transition fires from 0 */
      barFill.style.width = "100%";
    }

    /* Wait for bar to fully complete, then a short breath before exit */
    await wait(CONFIG.loading.barDuration + CONFIG.loading.exitPause);

    log("Loading sequence complete.");
  }

  function exitLoadingScreen(screen, mainPage) {
    if (!screen || screen.dataset.exited) return;
    screen.dataset.exited = "true";

    log("Loading screen: fading out.");

    screen.style.transition    = `opacity ${CONFIG.loading.exitFadeDuration}ms ease`;
    screen.style.opacity       = "0";
    screen.style.pointerEvents = "none";

    setTimeout(() => {
      screen.style.display = "none";
      revealMainPage(mainPage);
      log("Loading screen: removed. Main page revealed.");
    }, CONFIG.loading.exitFadeDuration + 50);
  }

  function forceExitLoadingScreen(screen, mainPage) {
    if (!screen || screen.dataset.exited) return;
    screen.dataset.exited      = "true";
    screen.style.display       = "none";
    screen.style.opacity       = "0";
    screen.style.pointerEvents = "none";
    revealMainPage(mainPage);
    log("Loading screen: force removed.");
  }

  function revealMainPage(mainPage) {
    document.body.classList.remove("no-scroll");

    if (!mainPage) {
      log("WARNING: #mainPage not found.");
      return;
    }

    mainPage.removeAttribute("aria-hidden");
    mainPage.style.opacity    = "1";
    mainPage.style.visibility = "visible";

    log("Main page: visible.");
  }


  /* ============================================================
     SECTION 2 — DOOR INTERACTION
     ============================================================
     CSS class `door-is-open` drives all visual transforms.
     JS only adds the class and schedules the page transition.
     Light burst is handled entirely by CSS (transition delay
     set on .door-light-burst in style.css) — no JS opacity
     override, no race condition.
     ============================================================ */

  function initDoor() {
    const doorFrame = qs("#doorFrame");

    if (!doorFrame) {
      log("Door frame not found — skipping.");
      return;
    }

    log("Door: init.");

    let isOpen = false;

    function openDoor() {
      if (isOpen) return;
      isOpen = true;

      log("Door: opening.");

      /* Prevent any further interaction immediately */
      doorFrame.style.pointerEvents = "none";
      doorFrame.setAttribute("aria-disabled", "true");

      /* Single class toggle — all animation is CSS-driven */
      doorFrame.classList.add("door-is-open");

      /* Schedule page transition after door animation completes */
      setTimeout(() => {
        log("Door: open. Triggering page transition.");
        triggerPageTransition();
      }, CONFIG.door.transitionDelay);
    }

    doorFrame.addEventListener("click", openDoor);

    doorFrame.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDoor();
      }
    });
  }


  /* ============================================================
     SECTION 3 — PAGE TRANSITION & REDIRECT
     ============================================================ */

  function triggerPageTransition() {
    const overlay = qs("#pageTransition");

    if (!overlay) {
      log("Page transition overlay not found — redirecting immediately.");
      redirect();
      return;
    }

    overlay.style.transition    = `opacity ${CONFIG.pageTransition.fadeDuration}ms ease`;
    overlay.style.opacity       = "1";
    overlay.style.pointerEvents = "all";
    overlay.classList.add("is-active");

    log("Page transition: overlay active.");

    setTimeout(redirect, CONFIG.pageTransition.redirectDelay);
  }

  function redirect() {
    log(`Redirecting to ${CONFIG.pageTransition.href}`);
    try {
      window.location.href = CONFIG.pageTransition.href;
    } catch (err) {
      log("Redirect failed:", err);
    }
  }


  /* ============================================================
     SECTION 4 — MUSIC TOGGLE
     ============================================================
     Reads audio.paused directly — no shadow isPlaying variable
     that can fall out of sync with real audio state.
     ============================================================ */

  function initMusic() {
    const btn   = qs("#musicToggle");
    const audio = qs("#bgMusic");

    if (!btn || !audio) {
      log("Music elements not found — skipping.");
      return;
    }

    /* Fetch label only after null-check on btn */
    const label = qs("#musicLabel");

    log("Music: init.");

    btn.addEventListener("click", () => {
      if (audio.paused) {
        /* --- PLAY --- */
        const playPromise = audio.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              btn.classList.add("is-playing");
              if (label) label.textContent = "Pause Music";
              log("Music: playing.");
            })
            .catch((err) => {
              /* Browser autoplay policy block — not a crash */
              log("Music: blocked by browser policy:", err.message);
            });
        } else {
          /* Legacy browsers that return no Promise */
          btn.classList.add("is-playing");
          if (label) label.textContent = "Pause Music";
        }
      } else {
        /* --- PAUSE --- */
        audio.pause();
        btn.classList.remove("is-playing");
        if (label) label.textContent = "Play Music";
        log("Music: paused.");
      }
    });
  }


  /* ============================================================
     SECTION 5 — EASTER EGG
     ============================================================ */

  function initEasterEgg() {
    const egg   = qs("#easterEgg");
    const toast = qs("#easterEggToast");

    if (!egg || !toast) {
      log("Easter egg elements not found — skipping.");
      return;
    }

    log("Easter egg: init.");

    let hideTimer = null;

    egg.addEventListener("click", () => {
      log("Easter egg: triggered.");

      clearTimeout(hideTimer);
      toast.classList.add("is-visible");

      hideTimer = setTimeout(() => {
        toast.classList.remove("is-visible");
      }, 3000);
    });
  }


  /* ============================================================
     SECTION 6 — PARTICLE CANVAS
     ============================================================
     - time converted to seconds before pulse math — prevents
       imperceptible rapid oscillation from raw rAF timestamp
     - Skipped entirely if prefers-reduced-motion is set
     - rAF paused when tab is hidden (saves CPU)
     ============================================================ */

  function initParticles() {
    if (prefersReducedMotion()) {
      log("Particles: skipped (prefers-reduced-motion).");
      return;
    }

    const canvas = qs("#particleCanvas");
    if (!canvas) {
      log("Particle canvas not found — skipping.");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      log("Canvas 2D context unavailable — skipping.");
      return;
    }

    log("Particles: init.");

    let particles = [];
    let rafId     = null;
    let W = 0;
    let H = 0;

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function createParticle() {
      return {
        x:       rand(0, W),
        y:       rand(0, H),
        r:       rand(CONFIG.particles.minRadius, CONFIG.particles.maxRadius),
        vx:      rand(-0.15, 0.15),
        vy:     -rand(CONFIG.particles.minSpeed, CONFIG.particles.maxSpeed),
        opacity: rand(CONFIG.particles.minOpacity, CONFIG.particles.maxOpacity),
        pulse:   rand(0.4, 1.2),         // cycles per second — human-perceivable range
        phase:   rand(0, Math.PI * 2),
      };
    }

    function buildParticles() {
      particles = [];
      for (let i = 0; i < CONFIG.particles.count; i++) {
        particles.push(createParticle());
      }
    }

    function tick(time) {
      const t = time * 0.001; // convert ms → seconds

      ctx.clearRect(0, 0, W, H);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        /* Gentle shimmer using seconds-based time */
        const pulsed = p.opacity + Math.sin(t * p.pulse + p.phase) * 0.08;
        const alpha  = clamp(pulsed, 0.04, 0.58);

        /* Wrap around edges */
        if (p.y < -p.r * 2)    p.y = H + p.r;
        if (p.x < -p.r * 2)    p.x = W + p.r;
        if (p.x > W + p.r * 2) p.x = -p.r;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${CONFIG.particles.color}, ${alpha})`;
        ctx.fill();
      });

      rafId = requestAnimationFrame(tick);
    }

    /* Pause rAF when tab is hidden — resume when visible */
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else {
        if (rafId === null) {
          rafId = requestAnimationFrame(tick);
        }
      }
    });

    /* Debounced resize handler */
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        buildParticles();
      }, 200);
    });

    resize();
    buildParticles();
    rafId = requestAnimationFrame(tick);

    log("Particles: running.");
  }


  /* ============================================================
     ENTRY POINT
     ============================================================ */

  function init() {
    log("=== Birthday page: initialising ===");

    initParticles();      // canvas starts immediately — behind everything
    initLoadingScreen();  // owns its own async sequence + safety cap
    initDoor();           // attaches click + keyboard handlers
    initMusic();          // music toggle
    initEasterEgg();      // secret star

    log("=== All modules ready ===");
  }

  /* Works whether script is deferred, async, or at bottom of body */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();