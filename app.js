/* ---------------- card catalog ---------------- */
const SETS = [
  {
    id: "elixir",
    label: "Elixir",
    reward: "Rune of Elixir",
    cards: [
      "Barbarian",
      "Archer",
      "Giant",
      "Goblin",
      "Wall Breaker",
      "Balloon",
      "Wizard",
      "Healer",
      "Dragon",
      "P.E.K.K.A",
      "Baby Dragon",
      "Miner",
      "Electro Dragon",
      "Yeti",
      "Dragon Rider",
      "Electro Titan",
      "Root Rider",
      "Thrower",
      "Meteor Golem",
    ],
  },
  {
    id: "dark",
    label: "Dark Elixir",
    reward: "Rune of Dark Elixir",
    cards: [
      "Minion",
      "Hog Rider",
      "Valkyrie",
      "Golem",
      "Witch",
      "Lava Hound",
      "Bowler",
      "Ice Golem",
      "Headhunter",
      "Apprentice Warden",
      "Druid",
      "Furnace",
      "Ruin Witch",
    ],
  },
  {
    id: "builder",
    label: "Builder Base",
    reward: "Rune of Gold",
    cards: [
      "Raged Barbarian",
      "Sneaky Archer",
      "Boxer Giant",
      "Beta Minion",
      "Bomber",
      "Baby Dragon (BB)",
      "Cannon Cart",
      "Night Witch",
      "Drop Ship",
      "Power P.E.K.K.A",
      "Hog Glider",
    ],
  },
  {
    id: "super",
    label: "Super Troop",
    reward: "Legendary Chest",
    cards: [
      "Super Barbarian",
      "Super Archer",
      "Super Giant",
      "Sneaky Goblin",
      "Super Wall Breaker",
      "Rocket Balloon",
      "Super Wizard",
      "Super Dragon",
      "Inferno Dragon",
      "Super Miner",
      "Super Yeti",
      "Super Minion",
      "Super Hog Rider",
      "Super Valkyrie",
      "Super Witch",
      "Ice Hound",
      "Super Bowler",
    ],
  },
];
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
const ALL_CARDS = [];
SETS.forEach((set) => {
  set.cards.forEach((name, i) => {
    ALL_CARDS.push({
      id: `${set.id}-${slugify(name)}`,
      name,
      setId: set.id,
      setLabel: set.label,
      num: i + 1,
      total: set.cards.length,
    });
  });
});
const TOTAL_CARDS = ALL_CARDS.length;

/* count model: 0 = need it, 1 = own one (not tradeable), 2+ = have extras (tradeable)
   getCount also reads old have/need string data so nothing already saved is lost */
function getCount(cards, cardId) {
  const v = cards ? cards[cardId] : undefined;
  if (typeof v === "number") return v;
  if (v === "have") return 2;
  if (v === "need") return 0;
  return 0;
}

/* an explicit "I checked and I need this" flag, separate from count.
   Only meaningful while count is 0 — owning a card always wins. */
function getNeedFlag(needFlags, cardId) {
  return !!(needFlags && needFlags[cardId]);
}

/* ---------------- state ---------------- */
let clanName = "Your Clan";
const urlParams = new URLSearchParams(window.location.search);
let myName = urlParams.get("me") || localStorage.getItem("cardLedgerMyName") || "";
let myCards = {};
let myNeedFlags = {};
let members = {};
let cardImages = {};
let activeTab = "elixir";
let saveTimer = null;
let pendingUpdates = {};

const db = firebase.database();

/* ---------------- shareable identity link ----------------
   Your name lives in the URL (?me=YourName) so opening the same
   link on another device points at the same member record instead
   of relying on typing the name identically twice. */
function syncNameToUrl(name) {
  const url = new URL(window.location.href);
  if (name) url.searchParams.set("me", name);
  else url.searchParams.delete("me");
  history.replaceState(null, "", url.toString());
}
if (myName) localStorage.setItem("cardLedgerMyName", myName);
syncNameToUrl(myName);

const els = {
  clanTitle: document.getElementById("clanTitle"),
  editClanBtn: document.getElementById("editClanBtn"),
  nameInput: document.getElementById("nameInput"),
  savePill: document.getElementById("savePill"),
  tabs: document.getElementById("tabs"),
  panel: document.getElementById("panel"),
  progressRow: document.getElementById("progressRow"),
  progressLabel: document.getElementById("progressLabel"),
  progressFill: document.getElementById("progressFill"),
  lastSync: document.getElementById("lastSync"),
};
els.nameInput.value = myName;

/* ---------------- realtime listeners ---------------- */
db.ref("clanName").on("value", (snap) => {
  clanName = snap.val() || "Your Clan";
  els.clanTitle.textContent = clanName;
});

db.ref("members").on("value", (snap) => {
  members = snap.val() || {};
  if (myName && members[myName]) {
    myCards = members[myName].cards || {};
    myNeedFlags = members[myName].needFlags || {};
  }
  renderTabs();
  renderPanel();
  updateProgress();
  els.lastSync.textContent = "synced " + new Date().toLocaleTimeString();
});

db.ref("cardImages").on("value", (snap) => {
  cardImages = snap.val() || {};
  renderPanel();
});

/* ---------------- name handling ---------------- */
let nameDebounce = null;
els.nameInput.addEventListener("input", () => {
  myName = els.nameInput.value.trim();
  clearTimeout(nameDebounce);
  nameDebounce = setTimeout(() => {
    if (!myName) return;
    localStorage.setItem("cardLedgerMyName", myName);
    syncNameToUrl(myName);
    myCards = (members[myName] && members[myName].cards) || {};
    myNeedFlags = (members[myName] && members[myName].needFlags) || {};
    renderPanel();
    updateProgress();
  }, 400);
});

/* ---------------- copy identity link ---------------- */
document.getElementById("copyLinkBtn").addEventListener("click", () => {
  if (!requireName()) return;
  navigator.clipboard.writeText(window.location.href).then(() => {
    const btn = document.getElementById("copyLinkBtn");
    const original = btn.textContent;
    btn.textContent = "copied!";
    setTimeout(() => {
      btn.textContent = original;
    }, 1500);
  });
});

/* ---------------- clan rename ---------------- */
els.editClanBtn.addEventListener("click", () => {
  const next = prompt("Clan name:", clanName);
  if (next && next.trim()) db.ref("clanName").set(next.trim());
});

/* ---------------- tabs ---------------- */
function renderTabs() {
  const myTradeCount = myName
    ? computeMyTrades().reduce((n, s) => n + s.giveRows.length + s.getRows.length, 0)
    : undefined;
  const tabDefs = [
    ...SETS.map((s) => ({ id: s.id, label: s.label, count: s.cards.length })),
    { id: "mytrades", label: "My Trades", count: myTradeCount },
    { id: "matches", label: "Trade Matches" },
    { id: "members", label: "Members", count: Object.keys(members).length },
  ];
  els.tabs.innerHTML = "";
  tabDefs.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "tab" + (t.id === activeTab ? " active" : "");
    btn.innerHTML =
      t.label + (t.count !== undefined ? `<span class="count">${t.count}</span>` : "");
    btn.addEventListener("click", () => {
      activeTab = t.id;
      renderTabs();
      renderPanel();
      updateProgress();
    });
    els.tabs.appendChild(btn);
  });
}

/* ---------------- progress ---------------- */
function updateProgress() {
  const set = SETS.find((s) => s.id === activeTab);
  if (!set || !myName) {
    els.progressRow.style.display = "none";
    return;
  }
  const cards = ALL_CARDS.filter((c) => c.setId === set.id);
  const collected = cards.filter((c) => getCount(myCards, c.id) >= 1).length;
  els.progressRow.style.display = "flex";
  els.progressLabel.textContent = `${collected} / ${cards.length} owned in ${set.label} \u2014 completes ${set.reward}`;
  els.progressFill.style.width = `${(collected / cards.length) * 100}%`;
}

/* ---------------- card count ---------------- */
function requireName() {
  if (myName) return true;
  els.nameInput.focus();
  els.nameInput.style.borderColor = "var(--need)";
  setTimeout(() => {
    els.nameInput.style.borderColor = "";
  }, 900);
  return false;
}

function changeCardCount(cardId, delta) {
  if (!requireName()) return;
  const current = getCount(myCards, cardId);
  const next = Math.max(0, current + delta);
  if (next === 0) delete myCards[cardId];
  else myCards[cardId] = next;
  queueUpdate(`members/${myName}/cards/${cardId}`, next === 0 ? null : next);
  // owning a card (or dropping back to 0) always overrides a "need it" flag
  if (next >= 1 && myNeedFlags[cardId]) {
    delete myNeedFlags[cardId];
    queueUpdate(`members/${myName}/needFlags/${cardId}`, null);
  }
  renderPanel();
  updateProgress();
  scheduleSave();
}

/* explicit "I checked and I need this" toggle, independent of the count.
   Only actionable while count is 0 - the button is hidden otherwise. */
function toggleNeedFlag(cardId) {
  if (!requireName()) return;
  if (getCount(myCards, cardId) >= 1) return;
  const flagged = getNeedFlag(myNeedFlags, cardId);
  if (flagged) delete myNeedFlags[cardId];
  else myNeedFlags[cardId] = true;
  queueUpdate(`members/${myName}/needFlags/${cardId}`, flagged ? null : true);
  renderPanel();
  updateProgress();
  scheduleSave();
}

/* ---------------- saving ----------------
   Writes only touch the specific card/need paths that changed (not the
   whole member record), so two devices editing at the same time merge
   instead of one overwriting the other's changes. */
function queueUpdate(path, value) {
  pendingUpdates[path] = value;
}

function scheduleSave() {
  els.savePill.textContent = "saving\u2026";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 500);
}

function flushSave() {
  if (!myName || !Object.keys(pendingUpdates).length) return;
  pendingUpdates[`members/${myName}/updatedAt`] = Date.now();
  const updates = pendingUpdates;
  pendingUpdates = {};
  db.ref()
    .update(updates)
    .then(() => {
      els.savePill.textContent = "saved";
      setTimeout(() => {
        els.savePill.textContent = "";
      }, 1500);
    })
    .catch(() => {
      els.savePill.textContent = "save failed";
    });
}

/* ---------------- card images (URL-based) ---------------- */
function setCardImage(cardId) {
  const current = cardImages[cardId] || "";
  const url = prompt("Paste an image URL (e.g. a raw.githubusercontent.com link):", current);
  if (url === null) return;
  const trimmed = url.trim();
  if (!trimmed) {
    db.ref(`cardImages/${cardId}`).remove();
    return;
  }
  db.ref(`cardImages/${cardId}`).set(trimmed);
}

/* ---------------- render: card grid ---------------- */
function renderCardGrid(setId) {
  const cards = ALL_CARDS.filter((c) => c.setId === setId);
  const grid = document.createElement("div");
  grid.className = "grid";
  cards.forEach((card) => {
    const count = getCount(myCards, card.id);
    const needed = getCount(myCards, card.id) === 0 && getNeedFlag(myNeedFlags, card.id);
    const stateClass =
      count >= 2
        ? "state-have"
        : count === 1
        ? "state-owned"
        : needed
        ? "state-need"
        : "state-neutral";
    const label =
      count >= 2
        ? "extra to trade"
        : count === 1
        ? "owned \u00b7 1"
        : needed
        ? "need it"
        : "not logged";
    const img = cardImages[card.id];
    const el = document.createElement("div");
    el.className = `card ${stateClass}`;
    el.innerHTML = `
      <div class="card-art">
        ${
          img
            ? `<img src="${img}" alt="${card.name}" onerror="this.parentElement.querySelector('img').style.display='none'; this.parentElement.querySelector('.art-placeholder')?.style.removeProperty('display');">`
            : `<span class="art-placeholder">Add image URL</span>`
        }
        <span class="art-edit">${img ? "Replace" : "Add URL"}</span>
      </div>
      <div class="card-top">
        <span class="card-num">${String(card.num).padStart(2, "0")} / ${String(card.total).padStart(
      2,
      "0"
    )}</span>
        <span class="owned-label">${label}</span>
      </div>
      <div class="card-name">${card.name}</div>
      <div class="card-actions">
        <div class="stepper">
          <button class="step-btn" data-delta="-1" aria-label="Decrease count">\u2013</button>
          <span class="step-count">${count}</span>
          <button class="step-btn" data-delta="1" aria-label="Increase count">+</button>
        </div>
        <button class="need-btn ${needed ? "active" : ""}" ${
      count >= 1 ? 'style="display:none;"' : ""
    }>${needed ? "\u2713 Marked as needed" : "Need it"}</button>
      </div>
    `;
    el.querySelector(".card-art").addEventListener("click", () => setCardImage(card.id));
    el.querySelectorAll(".step-btn").forEach((btn) => {
      btn.addEventListener("click", () => changeCardCount(card.id, Number(btn.dataset.delta)));
    });
    el.querySelector(".need-btn").addEventListener("click", () => toggleNeedFlag(card.id));
    grid.appendChild(el);
  });
  return grid;
}

/* ---------------- render: matches ---------------- */
function renderMatches() {
  const wrap = document.createElement("div");
  wrap.className = "match-list";
  const rows = [];
  ALL_CARDS.forEach((card) => {
    const haves = [],
      needs = [];
    Object.entries(members).forEach(([name, data]) => {
      const count = getCount(data.cards, card.id);
      if (count >= 2) haves.push(name);
      if (count === 0 && getNeedFlag(data.needFlags, card.id)) needs.push(name);
    });
    if (haves.length && needs.length) rows.push({ card, haves, needs });
  });
  if (!rows.length) {
    wrap.innerHTML = `<div class="empty">No live matches yet. Once someone marks a card "have extra" and someone else marks it "need it", it shows up here.</div>`;
    return wrap;
  }
  rows.forEach(({ card, haves, needs }) => {
    const row = document.createElement("div");
    row.className = "match-row";
    row.innerHTML = `
      <div>
        <div class="mname">${card.name}</div>
        <div class="mset">${card.setLabel}</div>
      </div>
      <div class="match-people">
        <span>Has extra: <b class="have">${haves.join(", ")}</b></span>
        <span>Needs: <b class="need">${needs.join(", ")}</b></span>
      </div>
    `;
    wrap.appendChild(row);
  });
  return wrap;
}

/* ---------------- render: my trades (personalized, per category) ----------------
   Trades only ever happen within one category (elixir-with-elixir, etc.), so this
   is computed and shown one category section at a time. For each section:
   - direct swap partners: someone who both needs a card you have extra of AND
     has extra of a card you need — the cleanest possible one-for-one trade.
   - you can give: your extras that someone else has flagged as needed.
   - you can get: your flagged needs that someone else has extra of. */
function computeMyTrades() {
  if (!myName) return [];
  const sections = [];
  SETS.forEach((set) => {
    const cards = ALL_CARDS.filter((c) => c.setId === set.id);
    const giveRows = [];
    const getRows = [];
    const swapPartners = {};
    cards.forEach((card) => {
      const myCount = getCount(myCards, card.id);
      const myNeed = myCount === 0 && getNeedFlag(myNeedFlags, card.id);

      if (myCount >= 2) {
        const recipients = [];
        Object.entries(members).forEach(([name, data]) => {
          if (name === myName) return;
          if (getCount(data.cards, card.id) === 0 && getNeedFlag(data.needFlags, card.id))
            recipients.push(name);
        });
        if (recipients.length) {
          giveRows.push({ card, recipients });
          recipients.forEach((name) => {
            (swapPartners[name] = swapPartners[name] || { give: [], get: [] }).give.push(card.name);
          });
        }
      }

      if (myNeed) {
        const sources = [];
        Object.entries(members).forEach(([name, data]) => {
          if (name === myName) return;
          if (getCount(data.cards, card.id) >= 2) sources.push(name);
        });
        if (sources.length) {
          getRows.push({ card, sources });
          sources.forEach((name) => {
            (swapPartners[name] = swapPartners[name] || { give: [], get: [] }).get.push(card.name);
          });
        }
      }
    });
    const directSwaps = Object.entries(swapPartners).filter(
      ([, d]) => d.give.length && d.get.length
    );
    if (giveRows.length || getRows.length) sections.push({ set, giveRows, getRows, directSwaps });
  });
  return sections;
}

function renderMyTrades() {
  const wrap = document.createElement("div");
  wrap.className = "mytrades";
  if (!myName) {
    wrap.innerHTML = `<div class="empty">Enter your name up top to see your personal trade matches.</div>`;
    return wrap;
  }
  const sections = computeMyTrades();
  if (!sections.length) {
    wrap.innerHTML = `<div class="empty">No trades for you yet. Mark cards "have extra" or "need it" across your sets, and matches will show up here as soon as someone else's cards line up with yours.</div>`;
    return wrap;
  }
  sections.forEach(({ set, giveRows, getRows, directSwaps }) => {
    const section = document.createElement("div");
    section.className = "mytrades-section";
    let html = `<div class="mytrades-title">${set.label}</div>`;
    if (directSwaps.length) {
      html += `<div class="mytrades-subhead">Direct swap partners</div><div class="match-list">`;
      directSwaps.forEach(([name, d]) => {
        html += `
          <div class="match-row swap-row">
            <div class="mname">${name}</div>
            <div class="match-people">
              <span>You give: <b class="have">${d.give.join(", ")}</b></span>
              <span>You get: <b class="need">${d.get.join(", ")}</b></span>
            </div>
          </div>`;
      });
      html += `</div>`;
    }
    if (giveRows.length) {
      html += `<div class="mytrades-subhead">You can give</div><div class="match-list">`;
      giveRows.forEach(({ card, recipients }) => {
        html += `
          <div class="match-row">
            <div class="mname">${card.name}</div>
            <div class="match-people"><span>Needed by: <b class="need">${recipients.join(
              ", "
            )}</b></span></div>
          </div>`;
      });
      html += `</div>`;
    }
    if (getRows.length) {
      html += `<div class="mytrades-subhead">You can get</div><div class="match-list">`;
      getRows.forEach(({ card, sources }) => {
        html += `
          <div class="match-row">
            <div class="mname">${card.name}</div>
            <div class="match-people"><span>Available from: <b class="have">${sources.join(
              ", "
            )}</b></span></div>
          </div>`;
      });
      html += `</div>`;
    }
    section.innerHTML = html;
    wrap.appendChild(section);
  });
  return wrap;
}

/* ---------------- render: members ---------------- */
function renderMembers() {
  const wrap = document.createElement("div");
  wrap.className = "member-list";
  const names = Object.keys(members).sort();
  if (!names.length) {
    wrap.innerHTML = `<div class="empty">No one has logged cards yet. Enter your name up top and start marking your set.</div>`;
    return wrap;
  }
  names.forEach((name) => {
    const data = members[name];
    const cards = data.cards || {};
    const needFlags = data.needFlags || {};
    const counts = ALL_CARDS.map((c) => getCount(cards, c.id));
    const ownedCount = counts.filter((n) => n >= 1).length;
    const extraCount = counts.filter((n) => n >= 2).length;
    const needCount = ALL_CARDS.filter(
      (c) => getCount(cards, c.id) === 0 && getNeedFlag(needFlags, c.id)
    ).length;
    const unloggedCount = TOTAL_CARDS - ownedCount - needCount;
    const pct = Math.round((ownedCount / TOTAL_CARDS) * 100);
    const row = document.createElement("div");
    row.className = "member-row";
    row.innerHTML = `
      <span class="mname">${name}${name === myName ? " (you)" : ""}</span>
      <div class="mtrack"><div class="mtrack-fill" style="width:${pct}%"></div></div>
      <span class="mstats">
        <span>${ownedCount}/${TOTAL_CARDS} owned</span>
        <b class="have">${extraCount} extra</b>
        <b class="need">${needCount} needed</b>
        <span>${unloggedCount} unlogged</span>
      </span>
    `;
    wrap.appendChild(row);
  });
  return wrap;
}

/* ---------------- panel router ---------------- */
function renderPanel() {
  els.panel.innerHTML = "";
  if (SETS.some((s) => s.id === activeTab)) els.panel.appendChild(renderCardGrid(activeTab));
  else if (activeTab === "mytrades") els.panel.appendChild(renderMyTrades());
  else if (activeTab === "matches") els.panel.appendChild(renderMatches());
  else if (activeTab === "members") els.panel.appendChild(renderMembers());
}

renderTabs();
renderPanel();
