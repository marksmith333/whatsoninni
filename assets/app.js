// assets/app.js
// pubsni.com — unified events listing + filters + clickable cards (when URL exists)

const DATA_URL = "data/events.json";

/* ---------------------------------------------------
   Config
--------------------------------------------------- */

const counties = [
  { key: "Antrim", page: "antrim.html" },
  { key: "Armagh", page: "armagh.html" },
  { key: "Derry", page: "derry.html" },
  { key: "Down", page: "down.html" },
  { key: "Fermanagh", page: "fermanagh.html" },
  { key: "Tyrone", page: "tyrone.html" }
];

const categoryEmojis = {
  "Traditional Music": "🎻",
  "Music": "🎵",
  "Quiz": "❓",
  "Family": "👶",
  "Live Music": "🎸",
  "Theatre": "🎭",
  "Markets": "🍰"
};

/* ---------------------------------------------------
   Helpers
--------------------------------------------------- */

const qs = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function escapeAttr(s){
  return escapeHtml(s);
}

function formatDate(d){
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  return dt.toLocaleString(undefined,{
    weekday:"short",
    year:"numeric",
    month:"short",
    day:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  });
}

function normCounty(v){
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/^county\s+/,"");
}

/* ---------------------------------------------------
   Date logic
--------------------------------------------------- */

function isUpcoming(ev){
  const start = new Date(ev.start);
  if (isNaN(start)) return false;
  const now = new Date();
  // allow 1h grace
  return start >= new Date(now.getTime() - 60*60*1000);
}

function withinDateFilter(ev, filter){
  if (!filter || filter === "all") return true;

  const start = new Date(ev.start);
  if (isNaN(start)) return true;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === "today"){
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return start >= today && start < tomorrow;
  }

  if (filter === "weekend"){
    const day = now.getDay(); // 0 Sun .. 6 Sat
    const toSat = (6 - day + 7) % 7;
    const sat = new Date(today);
    sat.setDate(today.getDate() + toSat);
    const mon = new Date(sat);
    mon.setDate(sat.getDate() + 2);
    return start >= sat && start < mon;
  }

  if (filter === "month"){
    const end = new Date(today);
    end.setMonth(today.getMonth() + 1);
    return start >= today && start < end;
  }

  return true;
}

/* ---------------------------------------------------
   Text matching
--------------------------------------------------- */

function matchText(ev, q){
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;

  const hay = [
    ev.title,
    ev.summary,
    ev.description,
    ev.venue,
    ev.town,
    ev.county,
    ev.category
  ].filter(Boolean).join(" ").toLowerCase();

  return hay.includes(needle);
}

/* ---------------------------------------------------
   Rendering
--------------------------------------------------- */

function renderCountyTiles(el){
  el.innerHTML = counties.map(c => `
    <a class="tile" href="${c.page}">
      <b>${c.key}</b>
      <span>View pub events in ${c.key}</span>
    </a>
  `).join("");
}

function renderCards(el, events){
  if (!events.length){
    el.innerHTML = `
      <div class="notice">
        No events found. Try adjusting your filters.
      </div>
    `;
    return;
  }

  el.innerHTML = events.map(ev => {
    const cat = ev.category || "Event";
    const emoji = categoryEmojis[cat] ? `${categoryEmojis[cat]} ` : "";
    const hasLink = Boolean(ev.url);

    const tag = hasLink ? "a" : "div";
    const href = hasLink
      ? `href="${escapeAttr(ev.url)}" target="_blank" rel="noopener"`
      : "";

    return `
      <${tag}
        class="card${hasLink ? " card-link" : ""}"
        ${href}
        role="group"
        aria-label="${escapeHtml(ev.title || "Event")}"
      >
        <div class="body">
          <div class="badges">
            <span class="badge blue">${escapeHtml(ev.county || "")}</span>
            <span class="badge accent">${escapeHtml(cat)}</span>
          </div>

          <h3 style="margin:10px 0 0 0">
            ${emoji}${escapeHtml(ev.title || "Untitled event")}
          </h3>

          <div class="meta">
            <span>🗓️ ${escapeHtml(formatDate(ev.start))}</span>
            ${ev.venue
              ? `<span>📍 ${escapeHtml(ev.venue)}${ev.town ? `, ${escapeHtml(ev.town)}` : ""}</span>`
              : ""
            }
          </div>

          ${ev.summary
            ? `<p class="small" style="margin:10px 0 0 0">${escapeHtml(ev.summary)}</p>`
            : ""
          }
        </div>
      </${tag}>
    `;
  }).join("");
}

/* ---------------------------------------------------
   Data
--------------------------------------------------- */

async function loadEvents(){
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load events.json");

  const json = await res.json();
  const events = (json.events || json || []);

  return events
    .filter(e => e.start)
    .sort((a,b) => new Date(a.start) - new Date(b.start));
}

function uniqueCategories(events){
  return [...new Set(events.map(e => e.category).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));
}

/* ---------------------------------------------------
   Filtering
--------------------------------------------------- */

function applyFilters(events, opts){
  let out = events.slice();

  if (opts.upcoming !== false){
    out = out.filter(isUpcoming);
  }

  if (opts.county){
    const want = normCounty(opts.county);
    out = out.filter(e => normCounty(e.county) === want);
  }

  if (opts.category && opts.category !== "all"){
    out = out.filter(e =>
      String(e.category || "").toLowerCase() === opts.category.toLowerCase()
    );
  }

  out = out.filter(e => withinDateFilter(e, opts.date));
  out = out.filter(e => matchText(e, opts.q));

  return out;
}

/* ---------------------------------------------------
   Page bootstrap
--------------------------------------------------- */

async function initListingPage(defaultCounty=null){
  const listEl = qs("#eventCards");
  const searchEl = qs("#search");
  const catEl = qs("#category");
  const dateEl = qs("#dateFilter");
  const tilesEl = qs("#countyTiles");
  const countEl = qs("#resultsCount");

  const events = await loadEvents();

  if (tilesEl) renderCountyTiles(tilesEl);

  if (catEl){
    const cats = uniqueCategories(events);
    catEl.innerHTML = `
      <option value="all">All categories</option>
      ${cats.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("")}
    `;
  }

  function refresh(){
    const filtered = applyFilters(events,{
      county: defaultCounty,
      category: catEl ? catEl.value : "all",
      date: dateEl ? dateEl.value : "all",
      q: searchEl ? searchEl.value : ""
    });

    if (listEl) renderCards(listEl, filtered);
    if (countEl) countEl.textContent =
      `${filtered.length} event${filtered.length === 1 ? "" : "s"} found`;
  }

  [searchEl, catEl, dateEl].forEach(el => {
    if (!el) return;
    el.addEventListener("input", refresh);
    el.addEventListener("change", refresh);
  });

  refresh();
}

/* ---------------------------------------------------
   Init
--------------------------------------------------- */

document.addEventListener("DOMContentLoaded", async () => {
  try{
    if (document.body.dataset.page === "home"){
      await initListingPage(null);
    }

    if (document.body.dataset.page === "county"){
      await initListingPage(document.body.dataset.county);
    }
  }catch(err){
    const el = qs("#eventCards");
    if (el){
      el.innerHTML = `
        <div class="notice">
          Could not load events. Please try again later.
        </div>
      `;
    }
    console.error(err);
  }
});