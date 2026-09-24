/* ============================================================
   AZURIA V4 — script.js
   Gestion : Navigation, Statut serveur, Copier IP,
             Animations d'entrée, Particules, Toast
   ============================================================ */

(function () {
  "use strict";

  /* ── Utilitaires ── */
  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }
  function $$(sel, ctx) {
    return Array.from((ctx || document).querySelectorAll(sel));
  }

  /* ============================================================
     NAVBAR SCROLL
     ============================================================ */
  function initNavbar() {
    var navbar = $(".navbar");
    if (!navbar) return;
    function onScroll() {
      if (window.scrollY > 20) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ── Mobile nav toggle ── */
  function initNavToggle() {
    var toggle = $(".nav-toggle");
    var links = $(".nav-links");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
    });
    // Fermer si on clique sur un lien
    $$(".nav-link, .nav-cta", links).forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
      });
    });
  }

  /* ============================================================
     TOAST NOTIFICATIONS
     ============================================================ */
  var toastTimer = null;
  function showToast(msg, duration) {
    var toast = $(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, duration || 2400);
  }

  /* ============================================================
     COPIER IP SERVEUR
     ============================================================ */
  function initCopyIP() {
    $$(".ip-block, .btn-copy-ip, [data-copy-ip], .server-status-pill, #server-status-container").forEach(function (el) {
      el.addEventListener("click", function () {
        var ip =
          el.dataset.ip ||
          el.querySelector(".ip-value")?.textContent?.trim() ||
          "playazuria.astraltechnologie.fr:25570";

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(ip)
            .then(function () {
              var copySpan = el.querySelector(".ip-copy");
              if (copySpan) {
                var old = copySpan.textContent;
                copySpan.textContent = "✓ IP Copiée !";
                el.classList.add("copied");
                setTimeout(function () {
                  copySpan.textContent = old;
                  el.classList.remove("copied");
                }, 2000);
              }
              showToast("✓ IP copiée : " + ip);
            })
            .catch(function () {
              showToast("IP : " + ip, 3500);
            });
        } else {
          showToast("IP : " + ip, 3500);
        }
      });
    });
  }

  /* ============================================================
     ANIMATIONS D'ENTRÉE (Intersection Observer)
     ============================================================ */
  function initFadeIn() {
    if (!("IntersectionObserver" in window)) {
      $$(".fade-in").forEach(function (el) {
        el.classList.add("visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    $$(".fade-in").forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ============================================================
     PARTICULES DU HERO
     ============================================================ */
  function initParticles() {
    var container = $(".hero-particles");
    if (!container) return;

    var count = 25;
    for (var i = 0; i < count; i++) {
      (function () {
        var p = document.createElement("span");
        p.className = "hparticle";
        var size = Math.random() * 3 + 1;
        var x = Math.random() * 100;
        var delay = Math.random() * 8;
        var dur = Math.random() * 10 + 8;
        var opacity = Math.random() * 0.45 + 0.1;
        Object.assign(p.style, {
          position: "absolute",
          left: x + "%",
          bottom: "-10px",
          width: size + "px",
          height: size + "px",
          borderRadius: "50%",
          background: "rgba(56,189,248," + opacity + ")",
          animation: "particleRise " + dur + "s " + delay + "s linear infinite",
          pointerEvents: "none",
        });
        container.appendChild(p);
      })();
    }

    if (!document.getElementById("particle-kf")) {
      var style = document.createElement("style");
      style.id = "particle-kf";
      style.textContent =
        "@keyframes particleRise{" +
        "0%{transform:translateY(0) scale(1);opacity:0}" +
        "10%{opacity:1}" +
        "90%{opacity:0.3}" +
        "100%{transform:translateY(-100vh) scale(0.5);opacity:0}" +
        "}";
      document.head.appendChild(style);
    }
  }

  /* ============================================================
     ACTIVE NAV LINK (Page actuelle)
     ============================================================ */
  function initActiveNavLink() {
    var currentPath = location.pathname.toLowerCase();
    var cleanCurrent = currentPath.split("/").filter(Boolean).pop() || "index";
    if (cleanCurrent.endsWith(".html")) {
      cleanCurrent = cleanCurrent.replace(".html", "");
    }

    $$(".nav-link[href], .nav-cta[href]").forEach(function (a) {
      var href = a.getAttribute("href").toLowerCase();
      var cleanHref = href.split("#")[0].split("/").filter(Boolean).pop() || "index";
      if (cleanHref.endsWith(".html")) {
        cleanHref = cleanHref.replace(".html", "");
      }

      if (cleanHref === cleanCurrent || (cleanCurrent === "index" && cleanHref === "")) {
        a.classList.add("active");
      }
    });
  }

  /* ============================================================
     STATUT SERVEUR AZURIA V4
     ============================================================ */
  function initServerStatus() {
    var statusText = $("#server-status-text");
    var statusDot = $("#server-status-dot");
    if (!statusText || !statusDot) return;

    fetch("https://api.mcsrvstat.us/3/playazuria.astraltechnologie.fr:25570")
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data.online) {
          var playersCount = data.players && data.players.online !== undefined ? data.players.online : 0;
          statusText.textContent = "En ligne · " + playersCount + " joueur" + (playersCount > 1 ? "s" : "");
          statusText.style.color = "#4ade80";
          statusDot.style.background = "#4ade80";
          statusDot.style.boxShadow = "0 0 12px #4ade80";
        } else {
          statusText.textContent = "Serveur en veille ou prêt";
          statusText.style.color = "#38bdf8";
          statusDot.style.background = "#38bdf8";
          statusDot.style.boxShadow = "0 0 12px #38bdf8";
        }
      })
      .catch(function () {
        statusText.textContent = "playazuria.astraltechnologie.fr:25570";
        statusText.style.color = "#38bdf8";
        statusDot.style.background = "#38bdf8";
        statusDot.style.boxShadow = "0 0 12px #38bdf8";
      });
  }

  /* ============================================================
     INITIALISATION
     ============================================================ */
  function init() {
    initNavbar();
    initNavToggle();
    initCopyIP();
    initActiveNavLink();
    initFadeIn();
    initParticles();
    initServerStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
