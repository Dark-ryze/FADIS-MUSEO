(function () {
      "use strict";

      var html = document.documentElement;
      var MODE_KEY = "focine-mode";
      var A11Y_KEY = "focine-a11y";

      var modeSwitch = document.getElementById("modeSwitch");

      function applyMode(mode) {
        html.setAttribute("data-mode", mode);
        modeSwitch.setAttribute("aria-pressed", mode === "digital" ? "true" : "false");
        modeSwitch.setAttribute("aria-label", "Cambiar a modo " + (mode === "digital" ? "Antiguo" : "Digital") + " (modo actual: " + (mode === "digital" ? "Digital" : "Antiguo") + ")");
        try { localStorage.setItem(MODE_KEY, mode); } catch (e) { }
      }

      (function initMode() {
        var saved = null;
        try { saved = localStorage.getItem(MODE_KEY); } catch (e) { }
        applyMode(saved === "digital" ? "digital" : "antiguo");
      })();

      modeSwitch.addEventListener("click", function () {
        var current = html.getAttribute("data-mode");
        applyMode(current === "digital" ? "antiguo" : "digital");
      });

      var navToggle = document.getElementById("navToggle");
      var mainNav = document.getElementById("mainNav");
      navToggle.addEventListener("click", function () {
        var isOpen = mainNav.classList.toggle("open");
        navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
      mainNav.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () {
          mainNav.classList.remove("open");
          navToggle.setAttribute("aria-expanded", "false");
        });
      });

      var revealEls = document.querySelectorAll("[data-reveal]");
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              io.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
        revealEls.forEach(function (el) { io.observe(el); });
      } else {
        revealEls.forEach(function (el) { el.classList.add("is-visible"); });
      }

      var scroller = document.getElementById("timelineScroller");
      var fill = document.getElementById("timelineFill");
      function updateTimelineFill() {
        var max = scroller.scrollWidth - scroller.clientWidth;
        var pct = max > 0 ? (scroller.scrollLeft / max) * 100 : 0;
        fill.style.width = pct + "%";
      }
      scroller.addEventListener("scroll", updateTimelineFill, { passive: true });
      updateTimelineFill();

      var canvas = document.getElementById("meshCanvas");
      var ctx = canvas.getContext("2d");
      var particles = [];
      var W, H;

      function resizeCanvas() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = Math.min(window.innerHeight * 1.4, 1600);
      }
      function initParticles() {
        particles = [];
        var count = Math.min(70, Math.floor((W * H) / 26000));
        for (var i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.25
          });
        }
      }
      var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function drawMesh() {
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(56,230,212,0.28)";
        ctx.fillStyle = "rgba(56,230,212,0.65)";
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          if (!reduceMotion) {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > W) p.vx *= -1;
            if (p.y < 0 || p.y > H) p.vy *= -1;
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
          ctx.fill();
          for (var j = i + 1; j < particles.length; j++) {
            var q = particles[j];
            var dx = p.x - q.x, dy = p.y - q.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 130) {
              ctx.globalAlpha = 1 - dist / 130;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          }
        }
        if (!reduceMotion) { requestAnimationFrame(drawMesh); }
      }

      resizeCanvas();
      initParticles();
      requestAnimationFrame(drawMesh);
      window.addEventListener("resize", function () {
        resizeCanvas();
        initParticles();
        if (reduceMotion) { drawMesh(); }
      });

      var defaultState = {
        audio: false,
        contrasteAlto: false,
        contrasteOscuro: false,
        saturacion: false,
        zoom: false,
        espaciado: false,
        resaltado: false,
        colorBlind: "none",
        font: "default",
        cursor: "normal",
        tipografiaOpen: false,
        cursorOpen: false,
        profiles: { motora: false, ceguera: false, daltonismo: false, dislexia: false }
      };

      var state = loadState();

      function loadState() {
        var s = null;
        try { s = JSON.parse(localStorage.getItem(A11Y_KEY)); } catch (e) { }
        var merged = JSON.parse(JSON.stringify(defaultState));
        if (s && typeof s === "object") {
          for (var k in defaultState) {
            if (k === "profiles" && s.profiles) {
              for (var p in defaultState.profiles) {
                if (typeof s.profiles[p] === "boolean") merged.profiles[p] = s.profiles[p];
              }
            } else if (k in s) {
              merged[k] = s[k];
            }
          }
        }
        return merged;
      }

      function saveState() {
        try { localStorage.setItem(A11Y_KEY, JSON.stringify(state)); } catch (e) { }
      }

      var launcher = document.getElementById("a11yLauncher");
      var panel = document.getElementById("a11yPanel");
      var closeBtn = document.getElementById("a11yClose");
      var statusBox = document.getElementById("a11yStatus");
      var statusText = document.getElementById("a11yStatusText");
      var resetBtn = document.getElementById("a11yReset");

      var toggleCards = {
        audio: document.getElementById("cardAudio"),
        saturacion: document.getElementById("cardSaturacion"),
        zoom: document.getElementById("cardZoom"),
        espaciado: document.getElementById("cardEspaciado"),
        resaltado: document.getElementById("cardResaltado")
      };
      var contrastCards = {
        alto: document.getElementById("cardContrasteAlto"),
        oscuro: document.getElementById("cardContrasteOscuro")
      };
      var expandCards = {
        tipografia: document.getElementById("cardTipografia"),
        cursor: document.getElementById("cardCursor")
      };
      var subpanels = {
        daltonismo: document.getElementById("subpanelDaltonismo"),
        tipografia: document.getElementById("subpanelTipografia"),
        cursor: document.getElementById("subpanelCursor")
      };
      var profileChips = {
        motora: document.getElementById("profileMotora"),
        ceguera: document.getElementById("profileCeguera"),
        daltonismo: document.getElementById("profileDaltonismo"),
        dislexia: document.getElementById("profileDislexia")
      };
      var colorBlindChips = document.querySelectorAll("[data-color-blind]");
      var fontChips = document.querySelectorAll("[data-font]");
      var cursorChips = document.querySelectorAll("[data-cursor]");

      function openPanel() {
        panel.classList.add("open");
        launcher.setAttribute("aria-expanded", "true");
        var firstFocusable = panel.querySelector("button");
        if (firstFocusable) firstFocusable.focus();
        document.addEventListener("keydown", onPanelKeydown);
        document.addEventListener("click", onOutsideClick, true);
      }
      function closePanel() {
        panel.classList.remove("open");
        launcher.setAttribute("aria-expanded", "false");
        document.removeEventListener("keydown", onPanelKeydown);
        document.removeEventListener("click", onOutsideClick, true);
        launcher.focus();
      }
      function onPanelKeydown(e) {
        if (e.key === "Escape") { closePanel(); }
      }
      function onOutsideClick(e) {
        if (!panel.contains(e.target) && e.target !== launcher && !launcher.contains(e.target)) {
          closePanel();
        }
      }
      launcher.addEventListener("click", function () {
        if (panel.classList.contains("open")) closePanel(); else openPanel();
      });
      closeBtn.addEventListener("click", closePanel);

      function applyFilters() {
        var filters = [];
        if (state.colorBlind && state.colorBlind !== "none") { filters.push("url(#cb-" + state.colorBlind + ")"); }
        if (state.contrasteAlto) { filters.push("contrast(1.3)"); }
        if (state.saturacion) { filters.push("saturate(1.65)"); }
        html.style.filter = filters.join(" ");
      }

      function applyClass(className, active) {
        html.classList.toggle(className, !!active);
      }

      var daltonismoSubpanelForced = false;

      function render() {
        applyClass("a11y-contraste-alto", state.contrasteAlto);
        applyClass("a11y-dark", state.contrasteOscuro);
        applyClass("a11y-zoom", state.zoom);
        applyClass("a11y-espaciado", state.espaciado);
        applyClass("a11y-resaltado", state.resaltado);
        applyClass("a11y-audio-hint", state.audio);

        applyClass("a11y-font-opendyslexic", state.font === "opendyslexic");
        applyClass("a11y-font-sans", state.font === "sans");
        applyClass("a11y-font-serif", state.font === "serif");

        applyClass("a11y-cursor-grande", state.cursor === "grande");
        applyClass("a11y-cursor-extragrande", state.cursor === "extragrande");

        applyFilters();

        setPressed(toggleCards.audio, state.audio);
        setPressed(toggleCards.saturacion, state.saturacion);
        setPressed(toggleCards.zoom, state.zoom);
        setPressed(toggleCards.espaciado, state.espaciado);
        setPressed(toggleCards.resaltado, state.resaltado);

        setPressed(contrastCards.alto, state.contrasteAlto);
        setPressed(contrastCards.oscuro, state.contrasteOscuro);

        colorBlindChips.forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip.getAttribute("data-color-blind") === state.colorBlind ? "true" : "false");
        });
        fontChips.forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip.getAttribute("data-font") === state.font ? "true" : "false");
        });
        cursorChips.forEach(function (chip) {
          chip.setAttribute("aria-pressed", chip.getAttribute("data-cursor") === state.cursor ? "true" : "false");
        });

        expandCards.tipografia.setAttribute("aria-expanded", state.tipografiaOpen ? "true" : "false");
        expandCards.cursor.setAttribute("aria-expanded", state.cursorOpen ? "true" : "false");
        subpanels.tipografia.hidden = !state.tipografiaOpen;
        subpanels.cursor.hidden = !state.cursorOpen;
        subpanels.daltonismo.hidden = !daltonismoSubpanelForced;

        for (var key in profileChips) {
          setPressed(profileChips[key], state.profiles[key]);
        }

        var anyActive = state.audio || state.contrasteAlto || state.contrasteOscuro || state.saturacion ||
          state.zoom || state.espaciado || state.resaltado || state.colorBlind !== "none" ||
          state.font !== "default" || state.cursor !== "normal";
        statusBox.classList.toggle("has-active", anyActive);
        statusText.textContent = anyActive ? "Ajustes de accesibilidad activos" : "Ningún perfil activado";

        saveState();
      }

      function setPressed(el, pressed) {
        if (el) el.setAttribute("aria-pressed", pressed ? "true" : "false");
      }

      Object.keys(toggleCards).forEach(function (key) {
        toggleCards[key].addEventListener("click", function () {
          state[key] = !state[key];
          render();
        });
      });

      contrastCards.alto.addEventListener("click", function () {
        state.contrasteAlto = !state.contrasteAlto;
        render();
      });
      contrastCards.oscuro.addEventListener("click", function () {
        state.contrasteOscuro = !state.contrasteOscuro;
        render();
      });

      expandCards.tipografia.addEventListener("click", function () {
        state.tipografiaOpen = !state.tipografiaOpen;
        if (state.tipografiaOpen) state.cursorOpen = false;
        render();
      });
      expandCards.cursor.addEventListener("click", function () {
        state.cursorOpen = !state.cursorOpen;
        if (state.cursorOpen) state.tipografiaOpen = false;
        render();
      });

      colorBlindChips.forEach(function (chip) {
        chip.addEventListener("click", function () {
          state.colorBlind = chip.getAttribute("data-color-blind");
          daltonismoSubpanelForced = true;
          render();
        });
      });

      fontChips.forEach(function (chip) {
        chip.addEventListener("click", function () {
          state.font = chip.getAttribute("data-font");
          render();
        });
      });

      cursorChips.forEach(function (chip) {
        chip.addEventListener("click", function () {
          state.cursor = chip.getAttribute("data-cursor");
          render();
        });
      });

      Object.keys(profileChips).forEach(function (key) {
        profileChips[key].addEventListener("click", function () {
          var turningOn = !state.profiles[key];
          state.profiles[key] = turningOn;

          if (key === "ceguera") {
            state.audio = turningOn;
          }
          if (key === "motora") {
            state.cursor = turningOn ? "grande" : "normal";
            if (turningOn) state.espaciado = true;
          }
          if (key === "daltonismo") {
            daltonismoSubpanelForced = turningOn;
            if (!turningOn) { state.colorBlind = "none"; }
          }
          if (key === "dislexia") {
            state.font = turningOn ? "opendyslexic" : "default";
            if (turningOn) state.espaciado = true;
          }
          render();
        });
      });

      resetBtn.addEventListener("click", function () {
        state = JSON.parse(JSON.stringify(defaultState));
        daltonismoSubpanelForced = false;
        render();
      });

      daltonismoSubpanelForced = state.colorBlind !== "none";
      render();

    })();