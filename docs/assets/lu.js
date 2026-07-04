/* Locally Uncensored — shared marketing behaviour (vanilla, no deps).
   Ported from the lu-labs.ai React components (LuMonogram / SiteNav).
   Builds the 3D monogram, injects the ambient background + atmosphere,
   and wires the theme toggle + mobile nav. Purely visual; no SEO impact. */
(function () {
  "use strict";
  var MARK = "/assets/marketing/";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── 3D monogram ──────────────────────────────────────────────────────
  var VARIANTS = {
    nav:  { N: 12, depth: 36, tilt: 16, persp: 400,  size: 52,
            haloBlur: 9,  haloZ: -40,
            glow: "drop-shadow(0 0 2px rgba(139,92,246,0.6))",
            outline: "drop-shadow(0.3px 0.3px 0 rgba(0,0,0,0.55)) drop-shadow(-0.3px -0.3px 0 rgba(0,0,0,0.55)) drop-shadow(0.3px -0.3px 0 rgba(0,0,0,0.55)) drop-shadow(-0.3px 0.3px 0 rgba(0,0,0,0.55))" },
    hero: { N: 18, depth: 92, tilt: 18, persp: 1000, size: 172,
            haloBlur: 30, haloZ: -85,
            glow: "drop-shadow(0 0 6px rgba(139,92,246,0.85)) drop-shadow(0 0 16px rgba(139,92,246,0.5))",
            outline: (function () {
              var o = [];
              [0.55, -0.55].forEach(function (x) {
                [0.55, -0.55].forEach(function (y) { o.push("drop-shadow(" + x + "px " + y + "px 0 rgba(0,0,0,0.55))"); });
              });
              o.push("drop-shadow(0.65px 0 0 rgba(0,0,0,0.55))", "drop-shadow(-0.65px 0 0 rgba(0,0,0,0.55))",
                     "drop-shadow(0 0.65px 0 rgba(0,0,0,0.55))", "drop-shadow(0 -0.65px 0 rgba(0,0,0,0.55))");
              return o.join(" ");
            })() }
  };

  function backLayers(N, depth, base, span) {
    var out = [];
    for (var i = 0; i < N - 1; i++) {
      var t = i / (N - 1);
      out.push({ z: Math.round(t * depth), b: (base + span * t).toFixed(2) });
    }
    return out;
  }

  function img(cls, src, z, filter) {
    var el = document.createElement("img");
    el.className = cls; el.src = src; el.alt = ""; el.setAttribute("aria-hidden", "true");
    el.style.transform = "translateZ(" + z + "px)";
    if (filter) el.style.filter = filter;
    return el;
  }

  function buildMono(host) {
    var v = VARIANTS[host.dataset.mono] || VARIANTS.nav;
    var size = parseInt(host.dataset.size, 10) || v.size;
    host.textContent = "";
    host.style.width = size + "px"; host.style.height = size + "px";

    var stage = document.createElement("div");
    stage.className = "lu-mono-stage";
    stage.style.perspective = v.persp + "px";
    stage.style.perspectiveOrigin = "50% 45%";
    stage.style.width = size + "px"; stage.style.height = size + "px";

    var tilt = document.createElement("div");
    tilt.className = "lu-mono-tilt";
    tilt.style.width = size + "px"; tilt.style.height = size + "px";

    var halo = document.createElement("div");
    halo.className = "lu-mono-halo";
    halo.style.filter = "blur(" + v.haloBlur + "px)";
    halo.style.transform = "translate(-50%,-50%) translateZ(" + v.haloZ + "px)";

    var sway = document.createElement("div");
    sway.className = "lu-mono-sway";
    var extrude = document.createElement("div");
    extrude.className = "lu-mono-extrude";

    backLayers(v.N, v.depth, 0.38, 0.7).forEach(function (l) {
      extrude.appendChild(img("lu-mono-layer", MARK + "lu-ring-flat.png", l.z, "brightness(" + l.b + ")"));
    });
    extrude.appendChild(img("lu-mono-layer", MARK + "lu-ring-metal.png", v.depth, "brightness(1.05) " + v.glow));
    backLayers(v.N, v.depth, 0.4, 0.66).forEach(function (l) {
      extrude.appendChild(img("lu-mono-layer", MARK + "lu-letters-flat.png", l.z, "brightness(" + l.b + ")"));
    });
    extrude.appendChild(img("lu-mono-layer", MARK + "lu-letters-violet.png", v.depth, "brightness(1.05) " + v.outline + " " + v.glow));

    var sheen = document.createElement("div");
    sheen.className = "lu-mono-sheen";
    sheen.style.transform = "translateZ(" + (v.depth + 2) + "px)";

    sway.appendChild(extrude); sway.appendChild(sheen);
    tilt.appendChild(halo); tilt.appendChild(sway);
    stage.appendChild(tilt); host.appendChild(stage);

    if (!reduce) {
      stage.addEventListener("mousemove", function (e) {
        var r = stage.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.transform = "rotateX(" + (-py * v.tilt).toFixed(2) + "deg) rotateY(" + (px * v.tilt).toFixed(2) + "deg)";
      });
      stage.addEventListener("mouseleave", function () {
        tilt.style.transform = "rotateX(0deg) rotateY(0deg)";
      });
    }
  }

  // ── Ambient background + atmosphere ──────────────────────────────────
  function injectAmbient() {
    if (!document.querySelector(".lu-bg")) {
      var bg = document.createElement("div"); bg.className = "lu-bg"; bg.setAttribute("aria-hidden", "true");
      ["b1", "b2", "b3", "b4"].forEach(function (c) {
        var b = document.createElement("div"); b.className = "lu-blob " + c; bg.appendChild(b);
      });
      document.body.insertBefore(bg, document.body.firstChild);
    }
    if (!document.querySelector(".lu-atmosphere")) {
      var atm = document.createElement("div"); atm.className = "lu-atmosphere"; atm.setAttribute("aria-hidden", "true");
      var v = document.createElement("div"); v.className = "lu-vignette";
      var g = document.createElement("div"); g.className = "lu-grain";
      atm.appendChild(v); atm.appendChild(g);
      document.body.appendChild(atm);
    }
  }

  // ── Theme toggle (same data-theme mechanism as before) ───────────────
  function wireTheme() {
    var sw = document.getElementById("theme-switch");
    if (!sw) return;
    sw.addEventListener("click", function () {
      var root = document.documentElement;
      root.setAttribute("data-theme", root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
  }

  // ── Mobile nav ───────────────────────────────────────────────────────
  function wireNav() {
    var t = document.querySelector(".lu-nav-toggle");
    var links = document.querySelector(".lu-nav-links");
    if (t && links) t.addEventListener("click", function () { links.classList.toggle("open"); });
  }

  // ── Scroll arrow (index) — smooth scroll without adding a hash ────────
  function wireScrollArrow() {
    var a = document.querySelector(".scroll-arrow");
    if (!a) return;
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var t = document.getElementById("content-start");
      if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function init() {
    injectAmbient();
    var monos = document.querySelectorAll("[data-mono]");
    for (var i = 0; i < monos.length; i++) buildMono(monos[i]);
    wireTheme(); wireNav(); wireScrollArrow();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
