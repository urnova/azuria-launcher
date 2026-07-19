/* ============================================================
   AZURIA — script.js
   Gestion : onglets grimoire, filtres items, recherche,
             navbar scroll, copier IP, toast
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
    $$(".nav-link", links).forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
      });
    });
  }

  /* ============================================================
     TOAST
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
    }, duration || 2200);
  }

  /* ============================================================
     COPIER IP
     ============================================================ */
  function initCopyIP() {
    $$(".ip-block, .btn-copy-ip, [data-copy-ip]").forEach(function (el) {
      el.addEventListener("click", function () {
        var ip =
          el.dataset.ip ||
          el.querySelector(".ip-value")?.textContent?.trim() ||
          "node2.northhost.fr:26132";
        navigator.clipboard
          .writeText(ip)
          .then(function () {
            var copySpan = el.querySelector(".ip-copy");
            if (copySpan) {
              var old = copySpan.textContent;
              copySpan.textContent = "✓ Copié !";
              el.classList.add("copied");
              setTimeout(function () {
                copySpan.textContent = old;
                el.classList.remove("copied");
              }, 2000);
            }
            showToast("✓ IP copiée : " + ip);
          })
          .catch(function () {
            showToast("Copiez : " + ip, 3500);
          });
      });
    });
  }

  /* ============================================================
     GRIMOIRE — ONGLETS
     ============================================================ */
  function initGrimoireTabs() {
    var tabs = $$(".gnav-tab");
    var sections = $$(".gsection");
    if (!tabs.length || !sections.length) return;

    function activateTab(target) {
      tabs.forEach(function (t) {
        t.classList.toggle("active", t.dataset.tab === target);
      });
      sections.forEach(function (s) {
        s.classList.toggle("active", s.id === target);
      });
      // Scroll to top of grimoire nav
      var nav = $(".grimoire-nav");
      if (nav) {
        var offset = nav.getBoundingClientRect().top + window.scrollY - 10;
        window.scrollTo({ top: offset, behavior: "smooth" });
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        activateTab(tab.dataset.tab);
        // Update hash sans provoquer un saut de page
        history.replaceState(null, "", "#" + tab.dataset.tab);
      });
    });

    // Activer depuis l'URL hash
    var hash = location.hash.replace("#", "");
    var validIds = sections.map(function (s) {
      return s.id;
    });
    if (hash && validIds.indexOf(hash) !== -1) {
      activateTab(hash);
    } else if (tabs.length) {
      // Premier onglet par défaut
      tabs[0].classList.add("active");
      if (sections[0]) sections[0].classList.add("active");
    }
  }

  /* ============================================================
     GRIMOIRE — FILTRES & RECHERCHE ITEMS
     ============================================================ */
  function initItemFilters() {
    var grid = $(".items-grid");
    if (!grid) return;

    var searchInput = $(".search-input");
    var catBtns = $$(".filter-btn[data-cat]");
    var rarBtns = $$(".filter-btn[data-rarity]");

    var activeCat = "all";
    var activeRar = "all";

    function normalize(str) {
      return (str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    function filterItems() {
      var query = normalize(searchInput ? searchInput.value : "");
      var cards = $$(".item-card", grid);
      var visible = 0;

      cards.forEach(function (card) {
        var cat = card.dataset.cat || "";
        var rar = card.dataset.rarity || "";
        var text = normalize(card.textContent);

        var matchCat = activeCat === "all" || cat === activeCat;
        var matchRar = activeRar === "all" || rar === activeRar;
        var matchSearch = !query || text.indexOf(query) !== -1;

        var show = matchCat && matchRar && matchSearch;
        card.style.display = show ? "" : "none";
        if (show) visible++;
      });

      // Message "aucun résultat"
      var noRes = $(".no-results", grid);
      if (noRes) {
        noRes.style.display = visible === 0 ? "" : "none";
      }
    }

    catBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeCat = btn.dataset.cat;
        catBtns.forEach(function (b) {
          b.classList.toggle("active", b.dataset.cat === activeCat);
        });
        filterItems();
      });
    });

    rarBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeRar = btn.dataset.rarity;
        rarBtns.forEach(function (b) {
          b.classList.toggle("active", b.dataset.rarity === activeRar);
        });
        filterItems();
      });
    });

    if (searchInput) {
      searchInput.addEventListener("input", filterItems);
    }

    // État initial
    filterItems();
  }

  /* ============================================================
     ANIMATIONS D'ENTRÉE (Intersection Observer)
     ============================================================ */
  function initFadeIn() {
    if (!("IntersectionObserver" in window)) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    $$(".fade-in").forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ============================================================
     BARRES DE PROGRESSION (drop rates)
     Anime la largeur des .dr-fill et .lb-bar-fill au chargement
     ============================================================ */
  function initProgressBars() {
    if (!("IntersectionObserver" in window)) {
      // fallback : appliquer directement
      $$("[data-width]").forEach(function (el) {
        el.style.width = el.dataset.width;
      });
      return;
    }

    var bars = $$("[data-width]");
    if (!bars.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.style.width = e.target.dataset.width;
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.3 },
    );

    bars.forEach(function (bar) {
      bar.style.width = "0%";
      bar.style.transition = "width 0.8s cubic-bezier(0.22, 1, 0.36, 1)";
      observer.observe(bar);
    });
  }

  /* ============================================================
     PARTICULES LÉGÈRES (hero uniquement)
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
        var opacity = Math.random() * 0.5 + 0.1;
        Object.assign(p.style, {
          position: "absolute",
          left: x + "%",
          bottom: "-10px",
          width: size + "px",
          height: size + "px",
          borderRadius: "50%",
          background: "rgba(79,142,247," + opacity + ")",
          animation: "particleRise " + dur + "s " + delay + "s linear infinite",
          pointerEvents: "none",
        });
        container.appendChild(p);
      })();
    }

    // Injecter le keyframe si absent
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
     ACTIVE NAV LINK (page courante)
     ============================================================ */
  function initActiveNavLink() {
    var currentPage = location.pathname.split("/").pop() || "index.html";
    $$(".nav-link[href]").forEach(function (a) {
      var href = a.getAttribute("href").split("#")[0].split("/").pop();
      if (href === currentPage) {
        a.classList.add("active");
      }
    });
  }

  /* ============================================================
     STATUT SERVEUR
     ============================================================ */
  function initServerStatus() {
    var statusText = $("#server-status-text");
    var statusDot = $("#server-status-dot");
    if (!statusText || !statusDot) return;

    fetch("https://api.mcsrvstat.us/3/playazuria.astraltechnologie.fr")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.online) {
          statusText.textContent = "En ligne";
          statusText.style.color = "#2ecc71";
          statusDot.style.background = "#2ecc71";
          statusDot.style.boxShadow = "0 0 10px #2ecc71";
        } else {
          statusText.textContent = "Hors ligne";
          statusText.style.color = "#e74c3c";
          statusDot.style.background = "#e74c3c";
          statusDot.style.boxShadow = "0 0 10px #e74c3c";
        }
      })
      .catch(function () {
        statusText.textContent = "Erreur de connexion";
        statusText.style.color = "#e74c3c";
        statusDot.style.background = "#e74c3c";
        statusDot.style.boxShadow = "0 0 10px #e74c3c";
      });
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    initNavbar();
    initNavToggle();
    initCopyIP();
    initActiveNavLink();
    initGrimoireTabs();
    initItemFilters();
    initFadeIn();
    initProgressBars();
    initParticles();
    initServerStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
