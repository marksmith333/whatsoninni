// assets/app.js
// What’s On NI — events listing + filters + event detail page + PWA helpers
// NOTE: Event cards are STATIC (not clickable) as requested.

const DATA_URL = "data/events.json";

const counties = [
  { key: "Antrim", page: "antrim.html" },
  { key: "Armagh", page: "armagh.html" },
  { key: "Derry", page: "derry.html" },
  { key: "Down", page: "down.html" },
  { key: "Fermanagh", page: "fermanagh.html" },
  { key: "Tyrone", page: "tyrone.html" },
];

const categoryEmojis = {
  "Traditional Music": "🎻",
  "Music": "🎵",
  "Quiz": "❓",
  "Family": "👶",
  "Live Music": "🎸",
  "Markets": "🍰",
  "Theatre": "🎭"
};

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return [...document.querySelectorAll(sel)]; }

function formatDate(d){
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleString(undefined, {
    weekday:"short", year:"numeric", month:"short", day:"numeric",
    hour:"2-digit", minute:"2-digit"
  });
}

function isUpcoming(event){
  const now = new Date();
  const start = new Date(event.start);
  // allow 1h grace so events that just started still show
  return !isNaN(start) && start >= new Date(now.getTime() - 60*60*1000);
}

function withinDateFilter(event, filter){
  if (!filter || filter === "all") return true;

  const start = new Date(event.start);
  if (isNaN(start)) return true;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  if (filter === "today") {
    return start >= startOfToday && start < endOfToday;
  }

  if (filter === "weekend") {
    // next Sat/Sun (including today if already weekend)
    const day = now.getDay(); // 0 Sun ... 6 Sat
    const daysToSat = (6 - day + 7) % 7;
    const sat = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSat);
    const mon = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() + 2);
    return start >= sat && start < mon;
  }

  if (filter === "month") {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return start >= now && start < end;
  }

  return true;
}

function matchText(event, query){
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const blob = [
    event.title, event.summary, event.description,
    event.venue, event.town, event.county, event.category
  ].filter(Boolean).join(" ").toLowerCase();

  return blob.includes(q);
}

function renderCountyTiles(el){
  // County tiles ARE still links (navigation to county pages).
  el.innerHTML = counties.map(c => `
    <a class="tile" href="${c.page}">
      <b>${c.key}</b>
      <span>View events in ${c.key}</span>
    </a>
  `).join("");
}

/**
 * Render event cards (STATIC, non-clickable).
 * We intentionally use <div class="card"> instead of <a>.
 */
function renderCards(el, events){
  if (!events.length){
    el.innerHTML = `<div class="notice">No events found for that filter yet. Try clearing filters, or check back soon.</div>`;
    return;
  }

  el.innerHTML = events.map(ev => {
    const cat = ev.category || "Event";
    const emoji = categoryEmojis[cat] ? `${categoryEmojis[cat]} ` : "";
    const priceBadge = ev.free ? `<span class="badge">Free</span>` : (ev.price ? `<span class="badge">£${ev.price}</span>` : ``);

    return `
      <div class="card" role="group" aria-label="${escapeHtml(ev.title || "Event")}">
        <div class="body">
          <div class="badges">
            <span class="badge blue">${escapeHtml(ev.county || "")}</span>
            <span class="badge accent">${escapeHtml(cat)}</span>
            ${priceBadge}
          </div>

          <h3 style="margin:10px 0 0 0">${emoji}${escapeHtml(ev.title || "Untitled event")}</h3>

          <div class="meta">
            <span>🗓️ ${escapeHtml(formatDate(ev.start))}</span>
            ${ev.venue ? `<span>📍 ${escapeHtml(ev.venue)}${ev.town ? `, ${escapeHtml(ev.town)}` : ""}</span>` : ""}
          </div>

          ${ev.summary ? `<p class="small" style="margin:10px 0 0 0">${escapeHtml(ev.summary)}</p>` : ``}
        </div>
      </div>
    `;
  }).join("");
}

async function loadEvents(){
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load events.json");
  const data = await res.json();

  const events = (data.events || [])
    .slice()
    .sort((a,b) => new Date(a.start) - new Date(b.start));

  return events;
}

function applyFilters(events, {county, category, dateFilter, q, upcomingOnly=true}){
  let out = events.slice();

  if (upcomingOnly) out = out.filter(isUpcoming);

  if (county && county !== "all") {
    out = out.filter(e => (e.county || "").toLowerCase() === county.toLowerCase());
  }

  if (category && category !== "all") {
    out = out.filter(e => (e.category || "").toLowerCase() === category.toLowerCase());
  }

  out = out.filter(e => withinDateFilter(e, dateFilter));
  out = out.filter(e => matchText(e, q));

  return out;
}

function uniqueCategories(events){
  const set = new Set();
  events.forEach(e => { if (e.category) set.add(e.category); });
  return [...set].sort((a,b)=>a.localeCompare(b));
}

// Page bootstraps
async function initListingPage(defaultCounty=null){
  const tiles = qs("#countyTiles");
  if (tiles) renderCountyTiles(tiles);

  const listEl = qs("#eventCards");
  const searchEl = qs("#search");
  const countyEl = qs("#county");
  const catEl = qs("#category");
  const dateEl = qs("#dateFilter");

  const events = await loadEvents();

  // populate county dropdown
  if (countyEl){
    countyEl.innerHTML = `
      <option value="all">All counties</option>
      ${counties.map(c => `<option value="${c.key}">${c.key}</option>`).join("")}
    `;
    if (defaultCounty) countyEl.value = defaultCounty;
  }

  // populate category dropdown
  if (catEl){
    const cats = uniqueCategories(events);
    catEl.innerHTML = `
      <option value="all">All categories</option>
      ${cats.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("")}
    `;
  }

  function refresh(){
    const filtered = applyFilters(events, {
      county: countyEl ? countyEl.value : defaultCounty,
      category: catEl ? catEl.value : "all",
      dateFilter: dateEl ? dateEl.value : "all",
      q: searchEl ? searchEl.value : ""
    });

    if (listEl) renderCards(listEl, filtered);

    const countEl = qs("#resultsCount");
    if (countEl) countEl.textContent = `${filtered.length} event${filtered.length===1?"":"s"} found`;
  }

  [searchEl, countyEl, catEl, dateEl].forEach(el => {
    if (!el) return;
    el.addEventListener("input", refresh);
    el.addEventListener("change", refresh);
  });

  refresh();
}

/**
 * Event detail page remains supported (event.html?id=...),
 * but listing cards no longer link to it.
 * If you later decide to remove event.html entirely, you can delete this.
 */
async function initEventPage(){
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const el = qs("#eventDetail");
  if (!el) return;

  if (!id){
    el.innerHTML = `<div class="notice">No event selected.</div>`;
    return;
  }

  const events = await loadEvents();
  const ev = events.find(e => e.id === id);

  if (!ev){
    el.innerHTML = `<div class="notice">Event not found.</div>`;
    return;
  }

  const maps = (ev.venue || ev.town)
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([ev.venue, ev.town, ev.county, "Northern Ireland"].filter(Boolean).join(", "))}`
    : null;

  const ics = makeICS(ev);
  const icsBlob = new Blob([ics], { type:"text/calendar;charset=utf-8" });
  const icsUrl = URL.createObjectURL(icsBlob);

  el.innerHTML = `
    <div class="panel">
      <div class="badges">
        <span class="badge blue">${escapeHtml(ev.county || "")}</span>
        <span class="badge accent">${escapeHtml(ev.category || "Event")}</span>
        ${ev.free ? `<span class="badge">Free</span>` : (ev.price ? `<span class="badge">£${escapeHtml(String(ev.price))}</span>` : ``)}
      </div>

      <h1 style="margin:12px 0 0 0">${escapeHtml(ev.title || "Event")}</h1>

      <div class="meta" style="margin-top:10px">
        <span>🗓️ ${escapeHtml(formatDate(ev.start))}${ev.end ? ` → ${escapeHtml(formatDate(ev.end))}` : ""}</span>
        ${ev.venue ? `<span>📍 ${escapeHtml(ev.venue)}${ev.town ? `, ${escapeHtml(ev.town)}` : ""}</span>` : ""}
      </div>

      <div class="hr"></div>

      ${ev.description ? `<p style="margin:0 0 10px 0">${escapeHtml(ev.description)}</p>` : `<p class="small">No description provided.</p>`}

      <div class="badges" style="margin-top:12px">
        ${maps ? `<a class="btn" href="${maps}" target="_blank" rel="noopener">Open in Maps</a>` : ""}
        <a class="btn" href="${icsUrl}" download="${safeFileName(ev.title)}.ics">Add to calendar (ICS)</a>
        ${ev.url ? `<a class="btn" href="${escapeAttr(ev.url)}" target="_blank" rel="noopener">Source / Tickets</a>` : ""}
      </div>

      <div class="hr"></div>
      <p class="small">Tip: if you’re the organiser and want updates, email us via the Contact page.</p>
    </div>
  `;
}

// ---- helpers ----

function pad2(n){ return String(n).padStart(2,"0"); }

function toICSDate(dt){
  // Floating local time: YYYYMMDDTHHMMSS
  const d = new Date(dt);
  return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
}

function safeFileName(s){
  return (s || "event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"");
}

function makeICS(ev){
  const uid = `${ev.id}@whatsoninni.com`;
  const dtStart = toICSDate(ev.start);
  const dtEnd = ev.end ? toICSDate(ev.end) : dtStart;
  const summary = (ev.title || "Event").replace(/\n/g," ");
  const location = [ev.venue, ev.town, ev.county, "Northern Ireland"]
    .filter(Boolean).join(", ").replace(/\n/g," ");
  const desc = (ev.description || "").replace(/\n/g," ").slice(0, 900);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//whatsoninni//events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStart}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    location ? `LOCATION:${location}` : "",
    desc ? `DESCRIPTION:${desc}` : "",
    ev.url ? `URL:${ev.url}` : "",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean).join("\r\n");
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(s){
  // attribute-safe (still good to keep it HTML-escaped)
  return escapeHtml(s);
}

// Detect page type
document.addEventListener("DOMContentLoaded", async () => {
  try{
    if (document.body.dataset.page === "home") await initListingPage(null);
    if (document.body.dataset.page === "county") await initListingPage(document.body.dataset.county);
    if (document.body.dataset.page === "event") await initEventPage();
  }catch(e){
    const err = qs("#eventCards") || qs("#eventDetail");
    if (err) err.innerHTML = `<div class="notice">Oops — couldn’t load events. If you’re viewing locally, use GitHub Pages or a local server.</div>`;
    console.error(e);
  }
});