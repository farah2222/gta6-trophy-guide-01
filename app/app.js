/* Leonida Ledger — GTA 6 trophy tracker. No network, no libraries.
   Progress lives only in this browser (localStorage) unless exported. */
(function () {
  "use strict";
  var LS_KEY = "leonida-ledger-progress-v1";
  var DATA_URL = "data/trophies.json";

  var trophies = [];
  var earned = {};          // id -> true
  var spoiler = true;       // hide hidden/story trophies until earned
  var kind = "all";
  var gradeFilter = "all";
  var statusFilter = "all";
  var sortMode = "default";
  var query = "";
  var selectedId = null;

  var listEl = document.getElementById("trophy-list");
  var detailEl = document.getElementById("detail");
  var countEl = document.getElementById("count-line");
  var emptyEl = document.getElementById("empty-state");

  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s && typeof s === "object") {
        if (s.earned && typeof s.earned === "object") earned = s.earned;
        if (typeof s.spoiler === "boolean") spoiler = s.spoiler;
      }
    } catch (e) { /* corrupted save: start fresh */ }
  }
  function saveState() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ earned: earned, spoiler: spoiler, savedAt: new Date().toISOString() }));
    } catch (e) { /* storage full/blocked: progress still works in memory */ }
  }

  function byId(id) {
    for (var i = 0; i < trophies.length; i++) if (trophies[i].id === id) return trophies[i];
    return null;
  }
  function isEarned(t) { return !!earned[t.id]; }
  function isMasked(t) { return spoiler && t.hidden && !isEarned(t); }

  function gradeRank(g) { return { platinum: 0, gold: 1, silver: 2, bronze: 3 }[g] || 9; }

  function visibleTrophies() {
    var q = query.trim().toLowerCase();
    var out = trophies.filter(function (t) {
      if (kind === "missable" && !t.missable) return false;
      if (kind === "online") return false; // no online trophies exist
      if (kind !== "all" && kind !== "missable" && kind !== "online" && t.kind !== kind) return false;
      if (gradeFilter !== "all" && t.grade !== gradeFilter) return false;
      if (statusFilter === "earned" && !isEarned(t)) return false;
      if (statusFilter === "remaining" && isEarned(t)) return false;
      if (q) {
        var hay = (t.name + " " + t.description + " " + t.guide + " " + t.kind).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (sortMode === "name") out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    else if (sortMode === "grade") out.sort(function (a, b) { return gradeRank(a.grade) - gradeRank(b.grade) || a.id - b.id; });
    else out.sort(function (a, b) { return a.id - b.id; });
    return out;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function badge(t) {
    var b = '<span class="badge ' + esc(t.grade) + '">' + esc(t.grade) + '</span>';
    b += '<span class="badge kind">' + esc(t.kind) + '</span>';
    if (t.missable) b += '<span class="badge missable">⚠ possibly missable</span>';
    if (t.hidden) b += '<span class="badge">hidden</span>';
    if (t.target) b += '<span class="badge target">target: ' + esc(String(t.target)) + " " + esc(t.target_label || "") + "</span>";
    if (isEarned(t)) b += '<span class="badge earned-badge">✓ earned</span>';
    return b;
  }

  function renderList() {
    var items = visibleTrophies();
    listEl.innerHTML = "";
    items.forEach(function (t) {
      var li = document.createElement("li");
      li.className = "card" + (isEarned(t) ? " earned" : "") + (t.id === selectedId ? " selected" : "");
      li.dataset.id = t.id;
      var masked = isMasked(t);
      var nameHtml = masked
        ? '<p class="t-name spoiler-mask">Hidden story trophy — earn it to reveal its name</p>'
        : '<p class="t-name">' + esc(t.name) + "</p>";
      var descHtml = masked
        ? '<p class="t-desc spoiler-mask">PlayStation hides this trophy until you earn it.</p>'
        : '<p class="t-desc">“' + esc(t.description) + "”</p>";
      var guideHtml = masked
        ? '<p class="t-guide spoiler-mask">Guide hidden until this trophy is earned — turn spoilers off to read it.</p>' +
          '<p class="t-src">Source: <a href="' + esc(t.source.url) + '" target="_blank" rel="noopener">' + esc(t.source.name) + "</a></p>"
        : '<p class="t-guide"><strong>Guide:</strong> ' + esc(t.guide) + "</p>" +
          '<p class="t-src">Source: <a href="' + esc(t.source.url) + '" target="_blank" rel="noopener">' + esc(t.source.name) + "</a></p>";
      li.innerHTML =
        '<div class="card-head">' +
          '<input type="checkbox" class="check" aria-label="Mark ' + esc(masked ? "hidden trophy" : t.name) + ' as earned"' + (isEarned(t) ? " checked" : "") + ">" +
          '<div class="t-main">' + nameHtml + descHtml + guideHtml +
          '<div class="badges">' + badge(t) + "</div>" +
          "</div></div>";
      li.addEventListener("click", function (ev) {
        if (ev.target.tagName === "A") return;
        if (ev.target.classList && ev.target.classList.contains("check")) return;
        select(t.id, false);
      });
      var box = li.querySelector(".check");
      box.addEventListener("change", function () {
        if (box.checked) earned[t.id] = true; else delete earned[t.id];
        saveState();
        renderAll();
      });
      listEl.appendChild(li);
    });
    emptyEl.hidden = items.length !== 0;
    if (kind === "online") {
      emptyEl.hidden = false;
      emptyEl.textContent = "There are no online trophies. All 55 GTA 6 trophies are single-player and offline — GTABase and GTA Zone both confirm it, so this filter is empty on purpose.";
    } else {
      emptyEl.textContent = "No trophies match these filters. Try clearing the search or choosing “All 55”.";
    }
    countEl.textContent = "Showing " + items.length + " of 55 trophies" +
      (kind === "online" ? " — no online trophies exist." : ".");
  }

  function renderDetail() {
    var t = selectedId ? byId(selectedId) : null;
    if (!t) {
      detailEl.innerHTML = '<p class="detail-hint">Select a trophy to read its full guide here.</p>' +
        "<p class='fine'>Tip: start with the missable one — <strong>Positive Mental Attitude</strong> — or open the roadmap above the list.</p>";
      return;
    }
    var masked = isMasked(t);
    detailEl.innerHTML =
      '<p class="fine">Selected trophy</p>' +
      (masked
        ? '<h3>Hidden story trophy</h3><p class="desc">PlayStation hides this trophy until you earn it. Its guide below is hidden too — turn spoilers off, or earn it, to reveal it.</p>'
        : "<h3>" + esc(t.name) + "</h3>" +
          '<p class="desc">“' + esc(t.description) + "”</p>") +
      '<div class="meta">' + badge(t) + "</div>" +
      (masked ? "" :
        '<p class="guide"><strong>Guide:</strong> ' + esc(t.guide) + "</p>" +
        '<p class="src">Source: <a href="' + esc(t.source.url) + '" target="_blank" rel="noopener">' + esc(t.source.name) + "</a></p>") +
      '<p><label><input type="checkbox" id="detail-check" ' + (isEarned(t) ? "checked" : "") + "> Mark as earned</label></p>" +
      (t.missable ? "<p><strong>⚠ Possibly missable.</strong> See the warning at the top of the roadmap before you play Chapter 1.</p>" : "");
    var dc = document.getElementById("detail-check");
    dc.addEventListener("change", function () {
      if (dc.checked) earned[t.id] = true; else delete earned[t.id];
      saveState();
      renderAll();
    });
  }

  function renderStats() {
    var n = 0;
    trophies.forEach(function (t) { if (isEarned(t)) n++; });
    var pct = Math.round((n / 55) * 100);
    document.getElementById("stat-earned").textContent = n;
    document.getElementById("stat-pct").textContent = pct + "%";
    var fill = document.getElementById("progress-fill");
    fill.style.width = pct + "%";
    var bar = document.getElementById("progress-bar");
    bar.setAttribute("aria-valuenow", String(n));
    bar.setAttribute("aria-valuetext", n + " of 55 trophies earned");
  }

  function renderAll() { renderStats(); renderList(); renderDetail(); }

  function select(id, scroll) {
    selectedId = id;
    renderAll();
    if (scroll) {
      var el = listEl.querySelector('[data-id="' + id + '"]');
      if (el) el.scrollIntoView({ block: "nearest" });
    }
    try { history.replaceState(null, "", "#trophy-" + id); } catch (e) {}
  }

  function exportProgress() {
    var ids = Object.keys(earned).map(Number).sort(function (a, b) { return a - b; });
    var payload = { app: "leonida-ledger", game: "Grand Theft Auto VI", exportedAt: new Date().toISOString(), earned: ids };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gta6-trophy-progress.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function importProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        var ids = Array.isArray(data) ? data : data.earned;
        if (!Array.isArray(ids)) throw new Error("bad file");
        var next = {};
        ids.forEach(function (id) {
          id = Number(id);
          if (id >= 1 && id <= 55 && byId(id)) next[id] = true;
        });
        earned = next;
        saveState();
        renderAll();
        alert("Imported " + Object.keys(next).length + " earned trophies.");
      } catch (e) {
        alert("That file is not a Leonida Ledger progress export.");
      }
    };
    reader.readAsText(file);
  }

  function bind() {
    document.getElementById("search").addEventListener("input", function (e) { query = e.target.value; renderList(); });
    document.getElementById("grade-filter").addEventListener("change", function (e) { gradeFilter = e.target.value; renderList(); });
    document.getElementById("status-filter").addEventListener("change", function (e) { statusFilter = e.target.value; renderList(); });
    document.getElementById("sort").addEventListener("change", function (e) { sortMode = e.target.value; renderList(); });
    document.getElementById("spoiler").checked = spoiler;
    document.getElementById("spoiler").addEventListener("change", function (e) {
      spoiler = e.target.checked;
      saveState();
      renderAll();
    });
    document.getElementById("kind-filters").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-kind]");
      if (!btn) return;
      kind = btn.dataset.kind;
      document.querySelectorAll("#kind-filters .chip").forEach(function (c) {
        var on = c === btn;
        c.classList.toggle("active", on);
        c.setAttribute("aria-pressed", String(on));
      });
      renderList();
    });
    document.getElementById("export-btn").addEventListener("click", exportProgress);
    document.getElementById("import-file").addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) importProgress(e.target.files[0]);
      e.target.value = "";
    });
    document.getElementById("reset-btn").addEventListener("click", function () {
      if (confirm("Clear all earned trophies? This only affects this browser.")) {
        earned = {};
        saveState();
        renderAll();
      }
    });
  }

  function initFromHash() {
    var h = location.hash || "";
    var m = h.match(/^#trophy-(\d+)$/);
    if (m) { var id = Number(m[1]); if (byId(id)) selectedId = id; }
    if (h === "#roadmap") {
      setTimeout(function () { var r = document.getElementById("roadmap"); if (r) r.scrollIntoView(); }, 50);
    }
  }

  loadState();
  bind();
  fetch(DATA_URL)
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (data) {
      trophies = data.trophies || [];
      initFromHash();
      renderAll();
    })
    .catch(function () {
      listEl.innerHTML = "<li class='card'><p><strong>Could not load the trophy data.</strong> Serve this folder over HTTP (for example <code>node serve.ts</code>) and reload.</p></li>";
    });
})();
