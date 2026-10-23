/* ==========================================================================
 * Prismatica Vault — shell UI client
 * Each doc is its own static page (scripts/vault-page.mjs), so links are real links and work
 * without this script. It adds the search palette (window.__VAULT, from vault-index.js), the
 * table-of-contents highlight, the folder toggles, the theme, j/k for the next and previous doc,
 * and sends an old /docs/#<path> link to that doc's page.
 * ========================================================================== */
(function () {
  "use strict";
  var V = window.__VAULT || { home: "", order: [], docs: {} };
  var shell = document.querySelector(".shell");
  var art = document.querySelector("article[data-doc]");
  var current = art ? art.getAttribute("data-doc") : V.home;

  function href(path) { return path === V.home ? "/docs/" : "/docs/" + path + "/"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ── Links from the single-page vault: /docs/#platform/x ───────────────── */
  var legacy = decodeURIComponent((location.hash || "").replace(/^#/, ""));
  if (legacy && V.docs[legacy]) { location.replace(href(legacy)); return; }

  /* ── Table of contents: highlight the heading in view ──────────────────── */
  var links = {};
  Array.prototype.forEach.call(document.querySelectorAll(".shell__toc [data-toc]"), function (a) { links[a.getAttribute("data-toc")] = a; });
  if (art && Object.keys(links).length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.toggle("is-active", k === en.target.id); });
      });
    }, { rootMargin: "-72px 0px -70% 0px" });
    Object.keys(links).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
  }

  /* ── Folders ───────────────────────────────────────────────────────────── */
  document.addEventListener("click", function (e) {
    var dir = e.target.closest(".tree__dir");
    if (dir) dir.setAttribute("aria-expanded", dir.getAttribute("aria-expanded") === "false" ? "true" : "false");
  });
  var active = document.querySelector(".tree__row.is-active");
  if (active) active.scrollIntoView({ block: "nearest" });

  /* ── Command palette ───────────────────────────────────────────────────── */
  var pal = document.querySelector(".palette");
  var palInput = pal.querySelector(".palette__input");
  var palResults = pal.querySelector(".palette__results");
  var palIndex = [];
  V.order.forEach(function (path) {
    var d = V.docs[path];
    palIndex.push({ path: path, id: null, title: d.title, sub: path, icon: d.icon || "◆" });
    (d.toc || []).forEach(function (h) { palIndex.push({ path: path, id: h.id, title: h.text, sub: d.title, icon: "§" }); });
  });
  var palActive = 0, palMatches = [];

  function openPalette() { pal.hidden = false; palInput.value = ""; runSearch(""); palInput.focus(); }
  function closePalette() { pal.hidden = true; }
  function runSearch(q) {
    q = q.trim().toLowerCase();
    palMatches = q ? palIndex.filter(function (it) { return (it.title + " " + it.sub).toLowerCase().indexOf(q) !== -1; }).slice(0, 40)
      : palIndex.filter(function (it) { return !it.id; });
    palActive = 0;
    if (!palMatches.length) { palResults.innerHTML = '<div class="palette__empty">No matches</div>'; return; }
    palResults.innerHTML = palMatches.map(function (it, i) {
      return '<a class="palette__item' + (i === 0 ? " is-active" : "") + '" data-i="' + i + '" href="' + esc(href(it.path) + (it.id ? "#" + it.id : "")) + '">' +
        '<span class="g">' + esc(it.icon) + '</span><span>' + esc(it.title) + '</span>' +
        '<span class="sub">' + esc(it.sub) + "</span></a>";
    }).join("");
  }
  function pickPalette(i) {
    var it = palMatches[i];
    if (it) location.href = href(it.path) + (it.id ? "#" + it.id : "");
  }
  palInput.addEventListener("input", function () { runSearch(palInput.value); });
  function moveActive(delta) {
    var items = palResults.querySelectorAll(".palette__item"); if (!items.length) return;
    items[palActive].classList.remove("is-active");
    palActive = (palActive + delta + items.length) % items.length;
    items[palActive].classList.add("is-active");
    items[palActive].scrollIntoView({ block: "nearest" });
  }

  /* ── Keyboard: ⌘K or / searches, j and k step through the docs ─────────── */
  function inField(el) { return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable); }
  function step(delta) {
    var i = V.order.indexOf(current);
    var next = V.order[(i + delta + V.order.length) % V.order.length];
    if (next) location.href = href(next);
  }
  document.addEventListener("keydown", function (e) {
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openPalette(); return; }
    if (!pal.hidden) {
      if (e.key === "Escape") { closePalette(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
      else if (e.key === "Enter") { e.preventDefault(); pickPalette(palActive); }
      return;
    }
    if (inField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "/") { e.preventDefault(); openPalette(); }
    else if (e.key === "j") { step(1); }
    else if (e.key === "k") { step(-1); }
  });

  /* ── Theme, menu, palette triggers ─────────────────────────────────────── */
  var THEME_KEY = "prismatica:docs:theme";
  function applyTheme(t) { document.documentElement.setAttribute("data-theme", t); try { localStorage.setItem(THEME_KEY, t); } catch { /* storage blocked: the theme still applies */ } }
  document.addEventListener("click", function (e) {
    if (e.target.closest('[data-action="theme"]')) applyTheme(document.documentElement.getAttribute("data-theme") === "noir" ? "solar" : "noir");
    if (e.target.closest('[data-action="palette"]')) openPalette();
    if (e.target.closest(".palette__backdrop")) closePalette();
    if (e.target.closest('[data-action="menu"]')) shell.classList.toggle("nav-open");
  });
  try { var saved = localStorage.getItem(THEME_KEY); if (saved) applyTheme(saved); } catch { /* storage blocked: keep the default theme */ }
})();
