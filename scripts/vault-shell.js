/* ==========================================================================
 * Prismatica Vault — shell UI client
 * Instant client-side navigation over pre-rendered .xmd docs. No framework.
 * Reads window.__VAULT = { order:[paths], docs:{ path:{title,icon,crumbs,toc} } }
 * ========================================================================== */
(function () {
  "use strict";
  var V = window.__VAULT || { order: [], docs: {} };
  var shell = document.querySelector(".shell");
  var host = document.querySelector(".doc-host");
  var crumbEl = document.querySelector(".crumbs");
  var tocEl = document.querySelector(".shell__toc");
  var current = null;
  var spy = null;

  function byNav(path) { return document.querySelector('[data-nav="' + cssEscape(path) + '"]'); }
  function article(path) { return document.querySelector('[data-doc="' + cssEscape(path) + '"]'); }
  function cssEscape(s) { return String(s).replace(/["\\]/g, "\\$&"); }

  /* ── Navigation ────────────────────────────────────────────────────────── */
  function openDoc(path, opts) {
    var meta = V.docs[path];
    var art = article(path);
    if (!meta || !art) { path = V.order[0]; meta = V.docs[path]; art = article(path); }
    if (!art) return;
    if (current) { var prev = article(current); if (prev) prev.hidden = true; }
    var wasActive = document.querySelector(".tree__row.is-active");
    if (wasActive) wasActive.classList.remove("is-active");
    art.hidden = false;
    current = path;
    var nav = byNav(path);
    if (nav) { nav.classList.add("is-active"); expandAncestors(nav); }
    renderCrumbs(meta.crumbs);
    renderToc(path, meta.toc, art);
    document.title = meta.title + " · Prismatica Docs";
    shell.classList.remove("nav-open");
    if (!opts || opts.scroll !== false) window.scrollTo({ top: 0, behavior: "auto" });
    if (!opts || opts.push !== false) {
      if (location.hash !== "#" + path) history.pushState({ path: path }, "", "#" + path);
    }
  }

  function renderCrumbs(crumbs) {
    var html = '<span class="sep">~/</span>vault';
    for (var i = 0; i < crumbs.length; i++) {
      var last = i === crumbs.length - 1;
      html += '<span class="sep">/</span>' + (last ? "<b>" + esc(crumbs[i]) + "</b>" : esc(crumbs[i]));
    }
    crumbEl.innerHTML = html;
  }

  function renderToc(path, toc, art) {
    if (spy) { spy.disconnect(); spy = null; }
    if (!toc || !toc.length) { tocEl.innerHTML = ""; return; }
    var html = '<div class="toc__title">On this page</div><ul class="toc__list">';
    for (var i = 0; i < toc.length; i++) {
      html += '<li><a class="toc__link toc__link--' + toc[i].level + '" href="#' + esc(path) +
        '" data-toc="' + esc(toc[i].id) + '">' + esc(toc[i].text) + "</a></li>";
    }
    tocEl.innerHTML = html + "</ul>";
    Array.prototype.forEach.call(tocEl.querySelectorAll("[data-toc]"), function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var el = art.querySelector("#" + cssEscape(a.getAttribute("data-toc")));
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    setupSpy(art, toc);
  }

  function setupSpy(art, toc) {
    var links = {};
    Array.prototype.forEach.call(tocEl.querySelectorAll("[data-toc]"), function (a) { links[a.getAttribute("data-toc")] = a; });
    spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id;
        Object.keys(links).forEach(function (k) { links[k].classList.toggle("is-active", k === id); });
      });
    }, { rootMargin: "-72px 0px -70% 0px" });
    toc.forEach(function (h) { var el = art.querySelector("#" + cssEscape(h.id)); if (el) spy.observe(el); });
  }

  /* ── Tree expand/collapse ──────────────────────────────────────────────── */
  function expandAncestors(nav) {
    var li = nav.closest(".tree__item");
    while (li) {
      var parentList = li.parentElement;
      if (parentList && parentList.classList.contains("tree__list")) {
        var dir = parentList.previousElementSibling;
        if (dir && dir.classList.contains("tree__dir")) dir.setAttribute("aria-expanded", "true");
      }
      li = parentList ? parentList.closest(".tree__item") : null;
    }
  }
  document.addEventListener("click", function (e) {
    var dir = e.target.closest(".tree__dir");
    if (dir) { dir.setAttribute("aria-expanded", dir.getAttribute("aria-expanded") === "false" ? "true" : "false"); return; }
    var nav = e.target.closest("[data-nav]");
    if (nav) { e.preventDefault(); openDoc(nav.getAttribute("data-nav")); }
  });

  /* ── Command palette ───────────────────────────────────────────────────── */
  var pal = document.querySelector(".palette");
  var palInput = pal.querySelector(".palette__input");
  var palResults = pal.querySelector(".palette__results");
  var palIndex = buildIndex();
  var palActive = 0, palMatches = [];

  function buildIndex() {
    var idx = [];
    V.order.forEach(function (path) {
      var d = V.docs[path];
      idx.push({ path: path, id: null, title: d.title, sub: path, icon: d.icon || "◆" });
      (d.toc || []).forEach(function (h) { idx.push({ path: path, id: h.id, title: h.text, sub: d.title, icon: "§" }); });
    });
    return idx;
  }
  function openPalette() { pal.hidden = false; palInput.value = ""; runSearch(""); palInput.focus(); }
  function closePalette() { pal.hidden = true; }
  function runSearch(q) {
    q = q.trim().toLowerCase();
    palMatches = q ? palIndex.filter(function (it) { return (it.title + " " + it.sub).toLowerCase().indexOf(q) !== -1; }).slice(0, 40)
      : palIndex.filter(function (it) { return !it.id; });
    palActive = 0;
    if (!palMatches.length) { palResults.innerHTML = '<div class="palette__empty">No matches</div>'; return; }
    palResults.innerHTML = palMatches.map(function (it, i) {
      return '<div class="palette__item' + (i === 0 ? " is-active" : "") + '" data-i="' + i + '">' +
        '<span class="g">' + esc(it.icon) + '</span><span>' + esc(it.title) + '</span>' +
        '<span class="sub">' + esc(it.sub) + "</span></div>";
    }).join("");
  }
  function pickPalette(i) {
    var it = palMatches[i]; if (!it) return;
    closePalette(); openDoc(it.path);
    if (it.id) { setTimeout(function () { var el = article(it.path).querySelector("#" + cssEscape(it.id)); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 40); }
  }
  palInput.addEventListener("input", function () { runSearch(palInput.value); });
  palResults.addEventListener("click", function (e) { var it = e.target.closest("[data-i]"); if (it) pickPalette(+it.getAttribute("data-i")); });
  function moveActive(delta) {
    var items = palResults.querySelectorAll(".palette__item"); if (!items.length) return;
    items[palActive].classList.remove("is-active");
    palActive = (palActive + delta + items.length) % items.length;
    items[palActive].classList.add("is-active");
    items[palActive].scrollIntoView({ block: "nearest" });
  }

  /* ── Global keyboard ───────────────────────────────────────────────────── */
  function inField(el) { return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable); }
  document.addEventListener("keydown", function (e) {
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openPalette(); return; }
    if (!pal.hidden) {
      if (e.key === "Escape") { closePalette(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
      else if (e.key === "Enter") { e.preventDefault(); pickPalette(palActive); }
      return;
    }
    if (inField(e.target)) return;
    if (e.key === "/") { e.preventDefault(); openPalette(); }
    else if (e.key === "j" || e.key === "ArrowDown") { step(1); }
    else if (e.key === "k" || e.key === "ArrowUp") { step(-1); }
  });
  function step(delta) {
    var i = V.order.indexOf(current);
    var next = V.order[(i + delta + V.order.length) % V.order.length];
    if (next) openDoc(next);
  }

  /* ── Theme ─────────────────────────────────────────────────────────────── */
  var THEME_KEY = "prismatica:docs:theme";
  function applyTheme(t) { document.documentElement.setAttribute("data-theme", t); try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
  document.addEventListener("click", function (e) {
    if (e.target.closest('[data-action="theme"]')) {
      applyTheme(document.documentElement.getAttribute("data-theme") === "noir" ? "solar" : "noir");
    }
    if (e.target.closest('[data-action="palette"]')) openPalette();
    if (e.target.closest(".palette__backdrop")) closePalette();
    if (e.target.closest('[data-action="menu"]')) shell.classList.toggle("nav-open");
  });
  try { var saved = localStorage.getItem(THEME_KEY); if (saved) applyTheme(saved); } catch (e) {}

  /* ── Routing ───────────────────────────────────────────────────────────── */
  function fromHash() { return decodeURIComponent((location.hash || "").replace(/^#/, "")); }
  window.addEventListener("popstate", function () { openDoc(fromHash() || V.order[0], { push: false }); });
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  openDoc(fromHash() || V.order[0], { push: false });
})();
