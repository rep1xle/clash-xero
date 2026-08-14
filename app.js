/* ---------------- card catalog ---------------- */
const SETS = [
    {
        id: 'elixir', label: 'Elixir', reward: 'Rune of Elixir', cards: [
            'Barbarian', 'Archer', 'Giant', 'Goblin', 'Wall Breaker', 'Balloon',
            'Wizard', 'Healer', 'Dragon', 'P.E.K.K.A', 'Baby Dragon', 'Electro Dragon'
        ]
    },
    {
        id: 'dark', label: 'Dark Elixir', reward: 'Rune of Dark Elixir', cards: [
            'Minion', 'Hog Rider', 'Valkyrie', 'Golem', 'Witch', 'Lava Hound',
            'Bowler', 'Ice Golem', 'Headhunter', 'Druid'
        ]
    },
    {
        id: 'builder', label: 'Builder Base', reward: 'Rune of Gold', cards: [
            'Raged Barbarian', 'Sneaky Archer', 'Boxer Giant', 'Beta Minion', 'Bomber',
            'Baby Dragon (BB)', 'Cannon Cart', 'Night Witch', 'Drop Ship', 'Super P.E.K.K.A'
        ]
    },
    {
        id: 'super', label: 'Super Troop', reward: 'Legendary Chest', cards: [
            'Super Barbarian', 'Super Archer', 'Sneaky Goblin', 'Super Wall Breaker', 'Rocket Balloon',
            'Super Wizard', 'Inferno Dragon', 'Super Minion', 'Super Valkyrie', 'Super Bowler'
        ]
    }
];
const ALL_CARDS = [];
SETS.forEach(set => {
    set.cards.forEach((name, i) => {
        ALL_CARDS.push({ id: `${set.id}-${i}`, name, setId: set.id, setLabel: set.label, num: i + 1, total: set.cards.length });
    });
});
const TOTAL_CARDS = ALL_CARDS.length;

/* ---------------- state ---------------- */
let clanName = 'Your Clan';
let myName = localStorage.getItem('cardLedgerMyName') || '';
let myCards = {};
let members = {};
let cardImages = {};
let activeTab = 'elixir';
let saveTimer = null;

const db = firebase.database();

const els = {
    clanTitle: document.getElementById('clanTitle'),
    editClanBtn: document.getElementById('editClanBtn'),
    nameInput: document.getElementById('nameInput'),
    savePill: document.getElementById('savePill'),
    tabs: document.getElementById('tabs'),
    panel: document.getElementById('panel'),
    progressRow: document.getElementById('progressRow'),
    progressLabel: document.getElementById('progressLabel'),
    progressFill: document.getElementById('progressFill'),
    lastSync: document.getElementById('lastSync'),
};
els.nameInput.value = myName;

/* ---------------- realtime listeners ---------------- */
db.ref('clanName').on('value', snap => {
    clanName = snap.val() || 'Your Clan';
    els.clanTitle.textContent = clanName;
});

db.ref('members').on('value', snap => {
    members = snap.val() || {};
    if (myName && members[myName]) myCards = members[myName].cards || {};
    renderTabs();
    renderPanel();
    updateProgress();
    els.lastSync.textContent = 'synced ' + new Date().toLocaleTimeString();
});

db.ref('cardImages').on('value', snap => {
    cardImages = snap.val() || {};
    renderPanel();
});

/* ---------------- name handling ---------------- */
let nameDebounce = null;
els.nameInput.addEventListener('input', () => {
    myName = els.nameInput.value.trim();
    clearTimeout(nameDebounce);
    nameDebounce = setTimeout(() => {
        if (!myName) return;
        localStorage.setItem('cardLedgerMyName', myName);
        myCards = (members[myName] && members[myName].cards) || {};
        renderPanel();
        updateProgress();
    }, 400);
});

/* ---------------- clan rename ---------------- */
els.editClanBtn.addEventListener('click', () => {
    const next = prompt('Clan name:', clanName);
    if (next && next.trim()) db.ref('clanName').set(next.trim());
});

/* ---------------- tabs ---------------- */
function renderTabs() {
    const tabDefs = [
        ...SETS.map(s => ({ id: s.id, label: s.label, count: s.cards.length })),
        { id: 'matches', label: 'Trade Matches' },
        { id: 'members', label: 'Members', count: Object.keys(members).length },
    ];
    els.tabs.innerHTML = '';
    tabDefs.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'tab' + (t.id === activeTab ? ' active' : '');
        btn.innerHTML = t.label + (t.count !== undefined ? `<span class="count">${t.count}</span>` : '');
        btn.addEventListener('click', () => { activeTab = t.id; renderTabs(); renderPanel(); updateProgress(); });
        els.tabs.appendChild(btn);
    });
}

/* ---------------- progress ---------------- */
function updateProgress() {
    const set = SETS.find(s => s.id === activeTab);
    if (!set || !myName) { els.progressRow.style.display = 'none'; return; }
    const cards = ALL_CARDS.filter(c => c.setId === set.id);
    const collected = cards.filter(c => myCards[c.id] === 'have').length;
    els.progressRow.style.display = 'flex';
    els.progressLabel.textContent = `${collected} / ${cards.length} logged in ${set.label} \u2014 completes ${set.reward}`;
    els.progressFill.style.width = `${(collected / cards.length) * 100}%`;
}

/* ---------------- card toggle ---------------- */
function setCardState(cardId, state) {
    if (!myName) {
        els.nameInput.focus();
        els.nameInput.style.borderColor = 'var(--need)';
        setTimeout(() => { els.nameInput.style.borderColor = ''; }, 900);
        return;
    }
    const current = myCards[cardId];
    const next = current === state ? undefined : state;
    if (next === undefined) { delete myCards[cardId]; } else { myCards[cardId] = next; }
    renderPanel();
    updateProgress();
    scheduleSave();
}

function scheduleSave() {
    els.savePill.textContent = 'saving\u2026';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        db.ref(`members/${myName}`).set({ cards: myCards, updatedAt: Date.now() })
            .then(() => {
                els.savePill.textContent = 'saved';
                setTimeout(() => { els.savePill.textContent = ''; }, 1500);
            })
            .catch(() => { els.savePill.textContent = 'save failed'; });
    }, 500);
}

/* ---------------- card images (URL-based) ---------------- */
function setCardImage(cardId) {
    const current = cardImages[cardId] || '';
    const url = prompt('Paste an image URL (e.g. a raw.githubusercontent.com link):', current);
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) { db.ref(`cardImages/${cardId}`).remove(); return; }
    db.ref(`cardImages/${cardId}`).set(trimmed);
}

/* ---------------- render: card grid ---------------- */
function renderCardGrid(setId) {
    const cards = ALL_CARDS.filter(c => c.setId === setId);
    const grid = document.createElement('div');
    grid.className = 'grid';
    cards.forEach(card => {
        const state = myCards[card.id];
        const img = cardImages[card.id];
        const el = document.createElement('div');
        el.className = 'card' + (state ? ` state-${state}` : '');
        el.innerHTML = `
      <div class="card-art">
        ${img ? `<img src="${img}" alt="${card.name}" onerror="this.parentElement.querySelector('img').style.display='none'; this.parentElement.querySelector('.art-placeholder')?.style.removeProperty('display');">` : `<span class="art-placeholder">Add image URL</span>`}
        <span class="art-edit">${img ? 'Replace' : 'Add URL'}</span>
      </div>
      <div class="card-top">
        <span class="card-num">${String(card.num).padStart(2, '0')} / ${String(card.total).padStart(2, '0')}</span>
      </div>
      <div class="card-name">${card.name}</div>
      <div class="toggle">
        <button data-state="have" class="${state === 'have' ? 'on-have' : ''}">Have extra</button>
        <button data-state="need" class="${state === 'need' ? 'on-need' : ''}">Need it</button>
      </div>
    `;
        el.querySelector('.card-art').addEventListener('click', () => setCardImage(card.id));
        el.querySelectorAll('.toggle button').forEach(btn => {
            btn.addEventListener('click', () => setCardState(card.id, btn.dataset.state));
        });
        grid.appendChild(el);
    });
    return grid;
}

/* ---------------- render: matches ---------------- */
function renderMatches() {
    const wrap = document.createElement('div');
    wrap.className = 'match-list';
    const rows = [];
    ALL_CARDS.forEach(card => {
        const haves = [], needs = [];
        Object.entries(members).forEach(([name, data]) => {
            const state = data.cards ? data.cards[card.id] : undefined;
            if (state === 'have') haves.push(name);
            if (state === 'need') needs.push(name);
        });
        if (haves.length && needs.length) rows.push({ card, haves, needs });
    });
    if (!rows.length) {
        wrap.innerHTML = `<div class="empty">No live matches yet. Once someone marks a card "have extra" and someone else marks it "need it", it shows up here.</div>`;
        return wrap;
    }
    rows.forEach(({ card, haves, needs }) => {
        const row = document.createElement('div');
        row.className = 'match-row';
        row.innerHTML = `
      <div>
        <div class="mname">${card.name}</div>
        <div class="mset">${card.setLabel}</div>
      </div>
      <div class="match-people">
        <span>Has extra: <b class="have">${haves.join(', ')}</b></span>
        <span>Needs: <b class="need">${needs.join(', ')}</b></span>
      </div>
    `;
        wrap.appendChild(row);
    });
    return wrap;
}

/* ---------------- render: members ---------------- */
function renderMembers() {
    const wrap = document.createElement('div');
    wrap.className = 'member-list';
    const names = Object.keys(members).sort();
    if (!names.length) {
        wrap.innerHTML = `<div class="empty">No one has logged cards yet. Enter your name up top and start marking your set.</div>`;
        return wrap;
    }
    names.forEach(name => {
        const data = members[name];
        const cards = data.cards || {};
        const haveCount = Object.values(cards).filter(s => s === 'have').length;
        const needCount = Object.values(cards).filter(s => s === 'need').length;
        const pct = Math.round((haveCount / TOTAL_CARDS) * 100);
        const row = document.createElement('div');
        row.className = 'member-row';
        row.innerHTML = `
      <span class="mname">${name}${name === myName ? ' (you)' : ''}</span>
      <div class="mtrack"><div class="mtrack-fill" style="width:${pct}%"></div></div>
      <span class="mstats">
        <b class="have">${haveCount} extra</b>
        <b class="need">${needCount} needed</b>
      </span>
    `;
        wrap.appendChild(row);
    });
    return wrap;
}

/* ---------------- panel router ---------------- */
function renderPanel() {
    els.panel.innerHTML = '';
    if (SETS.some(s => s.id === activeTab)) els.panel.appendChild(renderCardGrid(activeTab));
    else if (activeTab === 'matches') els.panel.appendChild(renderMatches());
    else if (activeTab === 'members') els.panel.appendChild(renderMembers());
}

renderTabs();
renderPanel();
