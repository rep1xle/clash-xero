/* ---------------- card catalog ---------------- */
const SETS = [
  { id:'elixir', label:'Elixir', reward:'Rune of Elixir', cards:[
    'Barbarian','Archer','Giant','Goblin','Wall Breaker','Balloon','Wizard','Healer',
    'Dragon','P.E.K.K.A','Baby Dragon','Miner','Electro Dragon','Yeti',
    'Dragon Rider','Electro Titan','Root Rider','Thrower','Meteor Golem'
  ]},
  { id:'dark', label:'Dark Elixir', reward:'Rune of Dark Elixir', cards:[
    'Minion','Hog Rider','Valkyrie','Golem','Witch','Lava Hound','Bowler','Ice Golem',
    'Headhunter','Apprentice Warden','Druid','Furnace','Ruin Witch'
  ]},
  { id:'builder', label:'Builder Base', reward:'Rune of Gold', cards:[
    'Raged Barbarian','Sneaky Archer','Boxer Giant','Beta Minion','Bomber',
    'Baby Dragon (BB)','Cannon Cart','Night Witch','Drop Ship','Power P.E.K.K.A','Hog Glider'
  ]},
  { id:'super', label:'Super Troop', reward:'Legendary Chest', cards:[
    'Super Barbarian','Super Archer','Super Giant','Sneaky Goblin','Super Wall Breaker',
    'Rocket Balloon','Super Wizard','Super Dragon','Inferno Dragon','Super Miner',
    'Super Yeti','Super Minion','Super Hog Rider','Super Valkyrie','Super Witch',
    'Ice Hound','Super Bowler'
  ]}
];
function slugify(name){
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
const ALL_CARDS = [];
SETS.forEach(set=>{
  set.cards.forEach((name,i)=>{
    ALL_CARDS.push({ id:`${set.id}-${slugify(name)}`, name, setId:set.id, setLabel:set.label, num:i+1, total:set.cards.length });
  });
});
const TOTAL_CARDS = ALL_CARDS.length;

/* count model: 0 = need it, 1 = own one (not tradeable), 2+ = have extras (tradeable)
   getCount also reads old have/need string data so nothing already saved is lost */
function getCount(cards, cardId){
  const v = cards ? cards[cardId] : undefined;
  if(typeof v === 'number') return v;
  if(v === 'have') return 2;
  if(v === 'need') return 0;
  return 0;
}

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
db.ref('clanName').on('value', snap=>{
  clanName = snap.val() || 'Your Clan';
  els.clanTitle.textContent = clanName;
});

db.ref('members').on('value', snap=>{
  members = snap.val() || {};
  if(myName && members[myName]) myCards = members[myName].cards || {};
  renderTabs();
  renderPanel();
  updateProgress();
  els.lastSync.textContent = 'synced ' + new Date().toLocaleTimeString();
});

db.ref('cardImages').on('value', snap=>{
  cardImages = snap.val() || {};
  renderPanel();
});

/* ---------------- name handling ---------------- */
let nameDebounce = null;
els.nameInput.addEventListener('input', ()=>{
  myName = els.nameInput.value.trim();
  clearTimeout(nameDebounce);
  nameDebounce = setTimeout(()=>{
    if(!myName) return;
    localStorage.setItem('cardLedgerMyName', myName);
    myCards = (members[myName] && members[myName].cards) || {};
    renderPanel();
    updateProgress();
  }, 400);
});

/* ---------------- clan rename ---------------- */
els.editClanBtn.addEventListener('click', ()=>{
  const next = prompt('Clan name:', clanName);
  if(next && next.trim()) db.ref('clanName').set(next.trim());
});

/* ---------------- tabs ---------------- */
function renderTabs(){
  const tabDefs = [
    ...SETS.map(s=>({ id:s.id, label:s.label, count:s.cards.length })),
    { id:'matches', label:'Trade Matches' },
    { id:'members', label:'Members', count:Object.keys(members).length },
  ];
  els.tabs.innerHTML = '';
  tabDefs.forEach(t=>{
    const btn = document.createElement('button');
    btn.className = 'tab' + (t.id===activeTab ? ' active' : '');
    btn.innerHTML = t.label + (t.count!==undefined ? `<span class="count">${t.count}</span>` : '');
    btn.addEventListener('click', ()=>{ activeTab = t.id; renderTabs(); renderPanel(); updateProgress(); });
    els.tabs.appendChild(btn);
  });
}

/* ---------------- progress ---------------- */
function updateProgress(){
  const set = SETS.find(s=>s.id===activeTab);
  if(!set || !myName){ els.progressRow.style.display = 'none'; return; }
  const cards = ALL_CARDS.filter(c=>c.setId===set.id);
  const collected = cards.filter(c=> getCount(myCards, c.id) >= 1).length;
  els.progressRow.style.display = 'flex';
  els.progressLabel.textContent = `${collected} / ${cards.length} owned in ${set.label} \u2014 completes ${set.reward}`;
  els.progressFill.style.width = `${(collected/cards.length)*100}%`;
}

/* ---------------- card count ---------------- */
function changeCardCount(cardId, delta){
  if(!myName){
    els.nameInput.focus();
    els.nameInput.style.borderColor = 'var(--need)';
    setTimeout(()=>{ els.nameInput.style.borderColor = ''; }, 900);
    return;
  }
  const current = getCount(myCards, cardId);
  const next = Math.max(0, current + delta);
  if(next === 0) delete myCards[cardId]; else myCards[cardId] = next;
  renderPanel();
  updateProgress();
  scheduleSave();
}

function scheduleSave(){
  els.savePill.textContent = 'saving\u2026';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    db.ref(`members/${myName}`).set({ cards: myCards, updatedAt: Date.now() })
      .then(()=>{
        els.savePill.textContent = 'saved';
        setTimeout(()=>{ els.savePill.textContent=''; }, 1500);
      })
      .catch(()=>{ els.savePill.textContent = 'save failed'; });
  }, 500);
}

/* ---------------- card images (URL-based) ---------------- */
function setCardImage(cardId){
  const current = cardImages[cardId] || '';
  const url = prompt('Paste an image URL (e.g. a raw.githubusercontent.com link):', current);
  if(url === null) return;
  const trimmed = url.trim();
  if(!trimmed){ db.ref(`cardImages/${cardId}`).remove(); return; }
  db.ref(`cardImages/${cardId}`).set(trimmed);
}

/* ---------------- render: card grid ---------------- */
function renderCardGrid(setId){
  const cards = ALL_CARDS.filter(c=>c.setId===setId);
  const grid = document.createElement('div');
  grid.className = 'grid';
  cards.forEach(card=>{
    const count = getCount(myCards, card.id);
    const stateClass = count === 0 ? 'state-need' : count === 1 ? 'state-owned' : 'state-have';
    const img = cardImages[card.id];
    const el = document.createElement('div');
    el.className = `card ${stateClass}`;
    el.innerHTML = `
      <div class="card-art">
        ${img ? `<img src="${img}" alt="${card.name}" onerror="this.parentElement.querySelector('img').style.display='none'; this.parentElement.querySelector('.art-placeholder')?.style.removeProperty('display');">` : `<span class="art-placeholder">Add image URL</span>`}
        <span class="art-edit">${img ? 'Replace' : 'Add URL'}</span>
      </div>
      <div class="card-top">
        <span class="card-num">${String(card.num).padStart(2,'0')} / ${String(card.total).padStart(2,'0')}</span>
        <span class="owned-label">${count === 0 ? 'need it' : count === 1 ? 'owned \u00b7 1' : 'extra to trade'}</span>
      </div>
      <div class="card-name">${card.name}</div>
      <div class="stepper">
        <button class="step-btn" data-delta="-1" aria-label="Decrease count">\u2013</button>
        <span class="step-count">${count}</span>
        <button class="step-btn" data-delta="1" aria-label="Increase count">+</button>
      </div>
    `;
    el.querySelector('.card-art').addEventListener('click', ()=> setCardImage(card.id));
    el.querySelectorAll('.step-btn').forEach(btn=>{
      btn.addEventListener('click', ()=> changeCardCount(card.id, Number(btn.dataset.delta)));
    });
    grid.appendChild(el);
  });
  return grid;
}

/* ---------------- render: matches ---------------- */
function renderMatches(){
  const wrap = document.createElement('div');
  wrap.className = 'match-list';
  const rows = [];
  ALL_CARDS.forEach(card=>{
    const haves = [], needs = [];
    Object.entries(members).forEach(([name, data])=>{
      const count = getCount(data.cards, card.id);
      if(count >= 2) haves.push(name);
      if(count === 0) needs.push(name);
    });
    if(haves.length && needs.length) rows.push({ card, haves, needs });
  });
  if(!rows.length){
    wrap.innerHTML = `<div class="empty">No live matches yet. Once someone marks a card "have extra" and someone else marks it "need it", it shows up here.</div>`;
    return wrap;
  }
  rows.forEach(({card, haves, needs})=>{
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
function renderMembers(){
  const wrap = document.createElement('div');
  wrap.className = 'member-list';
  const names = Object.keys(members).sort();
  if(!names.length){
    wrap.innerHTML = `<div class="empty">No one has logged cards yet. Enter your name up top and start marking your set.</div>`;
    return wrap;
  }
  names.forEach(name=>{
    const data = members[name];
    const cards = data.cards || {};
    const counts = ALL_CARDS.map(c => getCount(cards, c.id));
    const ownedCount = counts.filter(n => n >= 1).length;
    const extraCount = counts.filter(n => n >= 2).length;
    const needCount = counts.filter(n => n === 0).length;
    const pct = Math.round((ownedCount/TOTAL_CARDS)*100);
    const row = document.createElement('div');
    row.className = 'member-row';
    row.innerHTML = `
      <span class="mname">${name}${name===myName ? ' (you)' : ''}</span>
      <div class="mtrack"><div class="mtrack-fill" style="width:${pct}%"></div></div>
      <span class="mstats">
        <span>${ownedCount}/${TOTAL_CARDS} owned</span>
        <b class="have">${extraCount} extra</b>
        <b class="need">${needCount} needed</b>
      </span>
    `;
    wrap.appendChild(row);
  });
  return wrap;
}

/* ---------------- panel router ---------------- */
function renderPanel(){
  els.panel.innerHTML = '';
  if(SETS.some(s=>s.id===activeTab)) els.panel.appendChild(renderCardGrid(activeTab));
  else if(activeTab === 'matches') els.panel.appendChild(renderMatches());
  else if(activeTab === 'members') els.panel.appendChild(renderMembers());
}

renderTabs();
renderPanel();
