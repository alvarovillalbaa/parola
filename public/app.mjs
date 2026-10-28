import { CARDS, LANGUAGES } from './data.mjs';
import { createState, validateState, parseBackup, serializeBackup, checkAnswer, dayKey, buildQueue, applyReview, getStats } from './engine.mjs';
import { makeCalendar, installServiceWorker, requestNotifications, sendTestNotification, maybeNotify } from './reminders.mjs';

const STORAGE_KEY = 'parola-state-v1';
const app = document.querySelector('#app');
const cardDialog = document.querySelector('#card-dialog');
const restoreDialog = document.querySelector('#restore-dialog');
let state, storageIssue = '', preserveStorage = false, rawRecovery = '';
let view = ['today', 'library', 'progress', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
let session = null, pendingRestore = null, libraryKind = 'all', libraryQuery = '', installPrompt = null;
let restoreRequest = 0;
let renderedDay = dayKey(new Date());
try {
  rawRecovery = localStorage.getItem(STORAGE_KEY) || '';
  state = rawRecovery ? validateState(JSON.parse(rawRecovery), CARDS) : createState();
} catch {
  state = createState();
  preserveStorage = true;
  storageIssue = rawRecovery ? 'Saved data could not be read. Download the original or restore a backup. Your original data will be preserved.' : 'Device storage is unavailable. Progress will last for this visit only. Export a backup before leaving.';
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const allCards = () => [...CARDS, ...state.customCards];
const language = () => LANGUAGES.find(item => item.id === state.settings.language) || LANGUAGES[0];
const source = () => state.settings.sources[language().id];
const stats = () => getStats(allCards(), state, language().id);
const native = code => code === 'es' ? 'Spanish' : 'English';
const icon = name => {
  const paths = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5Z"/>',
    chart: '<path d="M4 20V10m8 10V4m8 16v-7"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    volume: '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    flame: '<path d="M13 3c1 6 6 6 6 12a7 7 0 0 1-14 0c0-3 2-5 4-7 0 4 2 4 2 4s3-4 2-9Z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM9 21h6"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>'
  };
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
};
function save() {
  if (preserveStorage) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch {
    storageIssue = 'Progress could not be saved on this device. Export a backup before leaving.';
    toast(storageIssue);
    const banner = document.querySelector('#storage-banner');
    if (banner) { banner.textContent = storageIssue; banner.hidden = false; }
  }
}
let toastTimeout;
function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message; el.classList.add('visible');
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => el.classList.remove('visible'), 6000);
}
function download(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function discardRestore() {
  restoreRequest += 1;
  pendingRestore = null;
}
function closeRestore() {
  discardRestore();
  restoreDialog.close();
}
function navigate(next) {
  closeRestore();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  view = next;
  if (next !== 'session') history.replaceState(null, '', `#${next}`);
  render();
  document.querySelector('#main')?.focus({preventScroll: true});
  window.scrollTo({top:0, behavior:'instant'});
}
function shell(content) {
  const s = stats(), lang = language();
  return `<div class="layout"><aside class="sidebar"><a class="wordmark" href="#today" aria-label="Parola home">parola<span>✳</span></a>
    <div class="sidebar-caption">YOUR DAILY LANGUAGE RITUAL</div><nav aria-label="Main navigation">${[['today','sun','Today'],['library','book','My collection'],['progress','chart','Progress']].map(([id,ico,label]) => `<a href="#${id}" class="nav-item ${view === id || (view === 'session' && id === 'today') ? 'active' : ''}" ${view === id ? 'aria-current="page"' : ''}>${icon(ico)}${label}${id === 'today' && s.due ? `<span class="nav-count">${s.due}</span>` : ''}</a>`).join('')}</nav>
    <div class="sidebar-note"><span class="tiny-star">✳</span><p>Small practice.<br>Lasting words.</p><span>Just you, showing up.</span></div>
    <a href="#settings" class="nav-item ${view === 'settings' ? 'active' : ''}">${icon('settings')}Settings & reminders</a><p class="local-note"><span class="status-dot"></span>${storageIssue ? 'Export to keep your progress' : 'Saved on this device'}</p></aside>
    <div class="workspace"><header class="topbar"><span class="topbar-title">${view === 'session' ? 'YOUR PRACTICE' : ({today:'YOUR LEARNING SPACE',library:'WORDS & STRUCTURES',progress:'A LITTLE PROGRESS',settings:'MAKE IT YOURS'}[view])}</span><div class="topbar-right"><span class="streak-pill">${icon('flame')}${s.streak} day${s.streak === 1 ? '' : 's'}</span><label class="sr-only" for="language-select">Learning language</label><select id="language-select" ${view === 'session' ? 'disabled' : ''}>${LANGUAGES.map(l => `<option value="${l.id}" ${l.id === lang.id ? 'selected' : ''}>${l.nativeName}</option>`).join('')}</select><span class="avatar" aria-label="Your personal space">A</span></div></header>
    <div class="storage-banner" id="storage-banner" role="alert" ${storageIssue ? '' : 'hidden'}>${esc(storageIssue)}${rawRecovery && preserveStorage ? ' <button data-action="recover" class="text-button">Download original</button>' : ''}</div>
    <main id="main" tabindex="-1">${content}</main><footer class="app-footer"><span>Made for a little, often.</span><span>Vocabulary. Grammar. You.</span></footer></div></div>`;
}
function todayView() {
  const s = stats(), lang = language(), goalDone = s.today >= s.goal;
  const percent = Math.min(100, Math.round(s.today / s.goal * 100));
  const remaining = allCards().filter(c => c.language === lang.id);
  return `<section class="page-heading"><div><p class="eyebrow">${esc(new Date().toLocaleDateString('en', {weekday:'long', month:'long',day:'numeric'}))} <span class="muted">/ A FRESH LITTLE START</span></p><h1>A little ${lang.name}.<br><em>Every day.</em></h1><p class="intro">The words you need. The patterns that connect them.</p></div><div class="daily-goal"><div class="goal-disc"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43" class="track"/><circle cx="50" cy="50" r="43" class="fill" pathLength="100" stroke-dasharray="${percent} 100"/></svg><div><strong>${s.today}<span>/${s.goal}</span></strong><span>recalls today</span></div></div><p>${goalDone ? 'Your daily promise, kept.' : 'A small promise to yourself.'}</p></div></section>
    <section class="practice-hero" aria-labelledby="practice-title"><div class="hero-copy"><span class="light-eyebrow"><span class="status-dot"></span>${goalDone ? 'DAILY GOAL COMPLETE' : 'YOUR NEXT FEW MINUTES'}</span><h2 id="practice-title">${goalDone ? 'Look at you, showing up.' : 'Make it stick.'}</h2><p>${goalDone ? 'Let the new words settle. Or stay for a little more.' : 'Try first. Learn as you go. A short mix of words and grammar, timed to help you remember.'}</p><div class="hero-actions"><button class="button light" data-action="start" data-kind="mixed">${session ? 'Resume practice' : "Start today’s practice"}${icon('arrow')}</button><span>${Math.min(s.due + s.newCount, 10) || 10} prompts · about 5 min</span></div><div class="hero-meta"><span>${native(source())} ${icon('arrow')} ${lang.name}</span><span>TYPE · RECALL · REPEAT</span></div></div><div class="hero-art" aria-hidden="true"><div class="orbital orbit-one"></div><div class="orbital orbit-two"></div><div class="word-tile tile-back">${esc(lang.greeting)}</div><div class="word-tile tile-front"><span>ONE WORD AT A TIME</span><strong>${esc(lang.nativeName)}</strong><span class="art-star">✳</span></div><span class="spark spark-one">✳</span><span class="spark spark-two">+</span></div></section>
    <section class="practice-options" aria-label="Focused practice"><button class="option-card" data-action="start" data-kind="vocabulary"><span class="option-symbol">Aa</span><div><span class="eyebrow">THE BUILDING BLOCKS</span><h3>Vocabulary</h3><p>Find the word. Make it yours.</p><span class="card-count">${remaining.filter(c=>c.kind==='vocabulary').length} words & expressions</span></div><span class="round-arrow">${icon('arrow')}</span></button><button class="option-card" data-action="start" data-kind="grammar"><span class="option-symbol grammar-symbol">↔</span><div><span class="eyebrow">THE CONNECTIONS</span><h3>Grammatical structures</h3><p>Build a sentence. Feel the pattern.</p><span class="card-count">${remaining.filter(c=>c.kind==='grammar').length} structures</span></div><span class="round-arrow">${icon('arrow')}</span></button></section>
    <section class="bottom-grid"><div class="week-card"><div class="section-label"><h2>Your week, one day at a time</h2><span>${s.streak ? `${s.streak}-day streak` : 'Every day counts'}</span></div>${weekMarkup(s)}<p class="small muted">${s.learned} items learned · ${s.due} ready to revisit</p></div><div class="ritual-card"><span class="eyebrow">A MOMENT THAT’S YOURS</span><h3>Same time tomorrow?</h3><p>Give your practice a place in your day.</p><a href="#settings" class="text-link">Set a daily reminder ${icon('arrow')}</a></div></section>`;
}
function weekMarkup(s) {
  return `<div class="week-strip">${s.week.map(d => `<div class="week-day ${d.date === dayKey(new Date()) ? 'is-today' : ''}"><span>${esc(new Date(`${d.date}T12:00:00`).toLocaleDateString('en',{weekday:'narrow'}))}</span><div class="day-dot ${d.count >= (state.days[d.date]?.goal ?? s.goal) ? 'complete' : d.count ? 'partial' : ''}" title="${esc(d.date)}: ${d.count} recalls">${d.count >= (state.days[d.date]?.goal ?? s.goal) ? icon('check') : d.count || '·'}</div></div>`).join('')}</div>`;
}
function libraryView() {
  return `<section class="page-heading compact"><div><p class="eyebrow">A COLLECTION THAT GROWS WITH YOU</p><h1>Words worth <em>keeping.</em></h1><p class="intro">Your ${language().name} vocabulary and grammatical structures.</p></div><button class="button primary" data-action="add-card">${icon('plus')}Add your own</button></section><section class="library-toolbar"><div class="segmented" aria-label="Filter collection">${[['all','Everything'],['vocabulary','Vocabulary'],['grammar','Grammar']].map(([kind,label])=>`<button data-action="filter" data-kind="${kind}" class="${libraryKind===kind?'selected':''}" aria-pressed="${libraryKind===kind}">${label}</button>`).join('')}</div><label class="search-label"><span class="sr-only">Search collection</span><input type="search" id="library-search" placeholder="Find a word or structure…" value="${esc(libraryQuery)}"></label></section><div class="collection-note">Answers stay tucked away until you choose to open them. Practice is where remembering begins.</div><div id="library-results">${libraryResults()}</div>`;
}
function libraryResults() {
  const query = libraryQuery.toLocaleLowerCase();
  const cards = allCards().filter(c => c.language === language().id && (libraryKind==='all' || c.kind === libraryKind) && `${c.cue.en} ${c.cue.es} ${c.answers.join(' ')} ${c.topic}`.toLocaleLowerCase().includes(query));
  return `<p class="results-count">${cards.length} items <span>· ${native(source())} → ${language().name}</span></p><div class="collection-grid">${cards.map(c => `<details class="collection-item"><summary><span class="item-kind">${c.kind === 'grammar' ? '↔' : 'Aa'}</span><span><span class="mini-label">${esc(c.topic)} · ${c.level}</span><strong lang="${source()}">${esc(c.cue[source()])}</strong></span><span class="reveal-label">Reveal +</span></summary><div class="collection-answer"><strong lang="${c.language}">${esc(c.answers[0])}</strong><p>${esc(c.note[source()])}</p>${c.example.target ? `<div class="example"><span lang="${c.language}">${esc(c.example.target)}</span><small lang="${source()}">${esc(c.example[source()])}</small></div>` : ''}<div class="item-footer"><span>${state.progress[c.id] ? `Next review: ${new Date(state.progress[c.id].due).toLocaleDateString('en',{month:'short',day:'numeric'})}` : 'Ready to learn'}</span><button class="icon-button" data-action="speak" data-id="${esc(c.id)}" aria-label="Listen to ${esc(c.answers[0])}">${icon('volume')}</button>${c.id.startsWith('custom-') ? `<button class="text-button" data-action="delete-card" data-id="${esc(c.id)}">Remove</button>` : ''}</div></div></details>`).join('')}</div>${cards.length ? '' : '<div class="empty-state"><span>∅</span><h2>No matching items yet.</h2><p>Try another search, or add a phrase you want to remember.</p></div>'}`;
}
function progressView() {
  const s = stats();
  return `<section class="page-heading compact"><div><p class="eyebrow">PROGRESS IS A PRACTICE</p><h1>Little by <em>little.</em></h1><p class="intro">Every attempt builds a stronger connection.</p></div><div class="large-streak">${icon('flame')}<strong>${s.streak}</strong><span>day streak</span></div></section><section class="stat-grid">${[[s.learned,'Items learned','At least one successful recall'],[s.mastered,'Growing roots','Spaced across longer intervals'],[s.due,'Ready to revisit','Your next chance to remember'],[`${Math.round(s.accuracy)}%`,'Recall accuracy',`${s.totalReviews} attempts in ${language().name}`]].map(([n,label,detail])=>`<div class="stat-card"><strong>${n}</strong><h2>${label}</h2><p>${detail}</p></div>`).join('')}</section><div class="week-card progress-week"><div class="section-label"><h2>Showing up is the whole idea.</h2><span>${s.today}/${s.goal} today</span></div>${weekMarkup(s)}<p class="small muted">Your daily goal and streak include practice across all four languages. Each item counts once per day.</p></div><section class="language-progress"><h2>Four languages. Your own pace.</h2>${LANGUAGES.map(l=>{const st=getStats(allCards(),state,l.id);const total=allCards().filter(c=>c.language===l.id).length;return `<button class="language-row" data-action="choose-language" data-id="${l.id}"><span class="language-initial">${l.id.toUpperCase()}</span><span><strong>${l.nativeName}</strong><small>From ${native(state.settings.sources[l.id])}</small></span><span class="language-bar"><progress class="learning-progress" value="${st.learned}" max="${total}" aria-label="${l.name} items learned"></progress><small>${st.learned} / ${total} learned</small></span><span>${st.due} due ${icon('arrow')}</span></button>`;}).join('')}</section>`;
}
function settingsView() {
  return `<section class="page-heading compact"><div><p class="eyebrow">A RITUAL THAT FITS YOUR LIFE</p><h1>Make it <em>yours.</em></h1><p class="intro">A few preferences. A little consistency.</p></div></section><div class="settings-grid"><section class="settings-card"><span class="eyebrow">YOUR PRACTICE</span><h2>Pick your starting point.</h2><form id="preferences-form"><label for="daily-goal">Daily recall goal</label><select id="daily-goal" name="dailyGoal">${[...new Set([5,10,15,20,state.settings.dailyGoal])].sort((a,b)=>a-b).map(n=>`<option value="${n}" ${state.settings.dailyGoal===n?'selected':''}>${n} items a day${n===10?' · a good little habit':''}</option>`).join('')}</select><p class="field-help">A mix of vocabulary and grammar. Repeated items count once. After your first recall, today’s goal stays fixed; changes apply to future days.</p><fieldset><legend>Language you learn from</legend>${LANGUAGES.map(l=>`<div class="source-row"><label for="source-${l.id}">${l.nativeName}</label><select id="source-${l.id}" name="source-${l.id}"><option value="es" ${state.settings.sources[l.id]==='es'?'selected':''}>Spanish</option><option value="en" ${state.settings.sources[l.id]==='en'?'selected':''}>English</option></select></div>`).join('')}</fieldset><button class="button primary" type="submit">Save preferences ${icon('check')}</button></form></section><section class="settings-card"><span class="eyebrow">SAME TIME, A LITTLE OFTEN</span><h2>Make a daily appointment.</h2><label for="reminder-time">Your practice time</label><input type="time" id="reminder-time" value="${esc(state.settings.reminderTime)}" required><p class="field-help">Uses your device’s local time.</p><button class="button primary wide" data-action="calendar">${icon('download')}Add daily calendar reminder</button><p class="field-help">Import the downloaded event into your calendar and enable its alerts. This is your reminder when Parola is closed. Re-importing may create duplicates in some calendars.</p><div class="settings-divider"></div><div class="toggle-row"><div><strong>Browser reminders</strong><p>While the app is open, after your practice time.</p></div><button role="switch" aria-checked="${state.settings.browserReminders}" aria-label="Browser reminders" class="toggle ${state.settings.browserReminders?'on':''}" data-action="notifications"><span></span></button></div><p class="field-help" id="notification-status">Permission and browser support are required. Background tabs may be delayed; use calendar alerts for closed-app reminders.</p><button class="text-link" data-action="test-notification">Send a test reminder ${icon('bell')}</button></section><section class="settings-card"><span class="eyebrow">KEEP WHAT YOU’VE LEARNED</span><h2>Your progress belongs to you.</h2><p>Practice is saved in this browser on this device. No account, tracking, or automatic cloud sync. A backup carries your progress and personal cards to another device.</p><div class="button-row"><button class="button secondary" data-action="backup">${icon('download')}Export backup</button><label class="button secondary file-button">Restore backup<input type="file" id="restore-file" accept="application/json,.json"></label></div><p class="field-help">Clearing site data also clears your progress. Export regularly.</p></section><section class="settings-card install-card"><span class="eyebrow">ALWAYS WITHIN REACH</span><h2>A little space on your home screen.</h2><p>Install Parola for a quiet, full-screen practice space. After the first visit, the collection and practice work offline.</p>${installPrompt ? '<button class="button secondary" data-action="install">Install Parola</button>' : '<p class="field-help">On iPhone or iPad: Safari → Share → Add to Home Screen. On desktop or Android: use your browser’s install menu.</p>'}<p class="field-help">Audio uses your device’s available voices. European Portuguese is used in the starter collection.</p></section></div>`;
}
function beginSession(kind='mixed', extraRequested=false) {
  if (session && !session.caughtUp) { navigate('session'); return; }
  let cards = buildQueue(allCards(),state,{language:language().id,kind,limit:10});
  let extra = false;
  if (!cards.length) {
    if (!extraRequested) { session={caughtUp:true,kind}; navigate('session'); return; }
    extra = true;
    cards = allCards().filter(c => c.language===language().id && (kind==='mixed'||c.kind===kind)).sort((a,b)=>(state.progress[a.id]?.lastReviewed||0)-(state.progress[b.id]?.lastReviewed||0)).slice(0,10);
  }
  session = {cards,index:0,language:language().id,source:source(),feedback:null,attempt:'',retried:new Set(),correct:0,attempts:0,extra};
  navigate('session');
}
function sessionView() {
  if (session?.caughtUp) return `<section class="session-summary"><span class="summary-flower">✳</span><p class="eyebrow">LET THE CONNECTIONS SETTLE</p><h1>You’re all <em>caught up.</em></h1><p>No new items or reviews are due for this practice type.<br>Come back when they’re ready, or choose a little extra recall.</p><div class="button-row"><button class="button primary" data-action="finish">Back to today ${icon('arrow')}</button><button class="button secondary" data-action="extra" data-kind="${session.kind}">Extra practice</button></div></section>`;
  if (!session || session.index >= session.cards.length) return summaryView();
  const c=session.cards[session.index], f=session.feedback, l=LANGUAGES.find(l=>l.id===session.language);
  const accents={fr:'à â ç é è ê ë î ï ô ù û ü œ',de:'ä ö ü ß',it:'à è é ì ò ù',pt:'á à â ã ç é ê í ó ô õ ú'}[c.language].split(' ');
  return `<div class="session-top"><button class="text-button" data-action="leave-session">${icon('close')}Back to today</button><span>${session.extra?'EXTRA PRACTICE':'A LITTLE FOCUSED PRACTICE'}</span><strong>${session.index+1}<span> / ${session.cards.length}</span></strong></div><progress class="session-progress" value="${session.index}" max="${session.cards.length}" aria-label="Session progress"></progress><section class="recall-card"><div class="recall-meta"><span class="badge">${c.kind==='grammar'?'↔ Grammatical structure':'Aa Vocabulary'}</span><span>${c.level} · ${esc(c.topic)}</span></div><div class="recall-prompt"><p class="eyebrow">${native(session.source)} ${icon('arrow')} ${l.name}</p><h1 lang="${session.source}">${esc(c.cue[session.source])}</h1><p>${c.kind==='grammar'?'Build the structure in '+l.name+'.':'Find the '+l.name+' word or expression.'}</p></div><form id="answer-form"><label for="answer" class="sr-only">Your answer in ${l.name}</label><input id="answer" name="answer" lang="${c.language}" placeholder="Let it come to you…" value="${esc(session.attempt)}" autocomplete="off" autocapitalize="off" spellcheck="false" ${f?'disabled':''} required maxlength="600"><div class="accent-row" aria-label="Insert accented characters">${accents.map(ch=>`<button type="button" data-action="accent" data-char="${ch}" ${f?'disabled':''} aria-label="Insert ${ch}">${ch}</button>`).join('')}</div>${f?'':`<div class="answer-actions"><button type="button" class="text-button" data-action="reveal">I don’t remember</button><button type="submit" class="button primary">Check my answer ${icon('arrow')}</button></div>`}</form>${f ? `<div class="feedback ${f.correct?'is-correct':'needs-practice'}" role="status"><div class="feedback-heading"><span>${f.correct?icon('check'):'↻'}</span><strong>${f.correct?'It’s coming back to you.':f.accentOnly?'Almost. Give those accents a little care.':f.revealed?'A new connection starts here.':'A little more practice. That’s how it sticks.'}</strong></div><div class="correct-answer"><strong lang="${c.language}">${esc(c.answers[0])}</strong><button class="icon-button" data-action="speak" data-id="${esc(c.id)}" aria-label="Listen to answer">${icon('volume')}</button></div>${c.answers.length>1?`<p class="also-accepted">Also accepted: ${c.answers.slice(1).map(esc).join(' · ')}</p>`:''}<p lang="${session.source}">${esc(c.note[session.source])}</p>${c.example.target?`<div class="example"><span lang="${c.language}">${esc(c.example.target)}</span><small lang="${session.source}">${esc(c.example[session.source])}</small></div>`:''}<div class="grade-actions">${f.correct?'<button class="button secondary" data-action="next" data-grade="hard">Took some effort</button><button class="button primary" data-action="next" data-grade="good">Got it '+icon('arrow')+'</button><button class="text-button" data-action="next" data-grade="easy">Felt easy</button>':'<span>I’ll bring this back for another try.</span><button class="button primary" data-action="next" data-grade="again">Continue '+icon('arrow')+'</button>'}</div></div>` : '<p class="recall-footnote">A real attempt is the learning. Take your time.</p>'}</section><p class="session-note">${session.extra?'Extra practice keeps your review schedule unless an item is missed. Each item counts once toward your daily goal.':'New words and due reviews, in one practice. Missed items return for one more try.'}</p>`;
}
function summaryView() {
  const s=stats();
  return `<section class="session-summary"><span class="summary-flower">✳</span><p class="eyebrow">A LITTLE MORE IS YOURS NOW</p><h1>You showed <em>up.</em></h1><p>${session?.attempts||0} recalls. ${session?.correct||0} recalled correctly.<br>Every attempt made a connection.</p><div class="summary-goal">${s.today} / ${s.goal}<span>unique items practiced today</span></div><p class="small muted">${s.today>=s.goal?'Your daily goal is complete. Come back tomorrow and keep the thread.':'Keep it small. Come back when you have another moment.'}</p><div class="button-row"><button class="button primary" data-action="finish">Back to today ${icon('arrow')}</button><button class="button secondary" data-action="another">Another little practice</button></div></section>`;
}
function render() {
  renderedDay=dayKey(new Date());
  app.innerHTML=shell(view==='session'?sessionView():view==='library'?libraryView():view==='progress'?progressView():view==='settings'?settingsView():todayView());
  if(view==='session') setTimeout(()=>document.querySelector(session?.feedback?'[data-action="next"][data-grade="good"], [data-action="next"]':'#answer')?.focus({preventScroll:true}),0);
}
function review(grade) {
  const c=session.cards[session.index];
  state=applyReview(state,c,grade); save();
}
function evaluateAnswer(revealed=false) {
  if(!session || session.feedback) return;
  const input=document.querySelector('#answer');
  if(!revealed && !input.value.trim()) { input.focus(); return; }
  session.attempt=input.value;
  const result=revealed?{correct:false,accentOnly:false}:checkAnswer(input.value,session.cards[session.index].answers);
  session.feedback={...result,revealed};
  session.attempts++;
  if(result.correct) session.correct++;
  else {
    review('again');
    const card=session.cards[session.index];
    if(!session.retried.has(card.id)) { session.retried.add(card.id); session.cards.push(card); }
  }
  render();
}
function openCardDialog() {
  cardDialog.innerHTML=`<form id="custom-card-form"><div class="dialog-heading"><div><span class="eyebrow">MAKE IT PERSONAL</span><h2 id="card-dialog-title">A phrase to keep.</h2></div><button class="icon-button" type="button" data-action="close-card" aria-label="Close">${icon('close')}</button></div><p class="field-help">Add something from your day. Give yourself a precise cue with one clear answer.</p><div class="form-pair"><div><label for="custom-language">Learning language</label><select id="custom-language" name="language">${LANGUAGES.map(l=>`<option value="${l.id}" ${l.id===language().id?'selected':''}>${l.nativeName}</option>`).join('')}</select></div><div><label for="custom-kind">Practice type</label><select id="custom-kind" name="kind"><option value="vocabulary">Vocabulary</option><option value="grammar">Grammatical structure</option></select></div></div><label for="custom-es">Cue in Spanish</label><input id="custom-es" name="es" maxlength="300" required placeholder="e.g. el encuentro (con artículo)"><label for="custom-en">Cue in English</label><input id="custom-en" name="en" maxlength="300" required placeholder="e.g. the meeting (with article)"><label for="custom-answer">Answer in the learning language</label><input id="custom-answer" name="answer" maxlength="300" required placeholder="e.g. la rencontre"><label for="custom-alternatives">Other accepted answers <span class="muted">(optional)</span></label><input id="custom-alternatives" name="alternatives" maxlength="600" placeholder="Separate alternatives with a semicolon"><label for="custom-note">A note to remember <span class="muted">(optional)</span></label><textarea id="custom-note" name="note" maxlength="600" rows="2" placeholder="A clue, a pattern, or where you found it."></textarea><p id="custom-error" role="alert" class="form-error"></p><button class="button primary wide" type="submit">Add to my collection ${icon('plus')}</button></form>`;
  cardDialog.showModal();
}
function speak(id) {
  const c=allCards().find(c=>c.id===id);
  if(!c) return;
  if(!('speechSynthesis' in window)) { toast('Audio is not supported by this browser.'); return; }
  speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(c.answers[0]);
  utterance.lang=LANGUAGES.find(l=>l.id===c.language).locale;
  const voice=speechSynthesis.getVoices().find(v=>v.lang.toLowerCase()===utterance.lang.toLowerCase());
  if(voice) utterance.voice=voice;
  utterance.rate=.85; utterance.onerror=()=>toast('Audio is unavailable. Try a different device voice.');
  speechSynthesis.speak(utterance);
}
document.addEventListener('click',async event=>{
  const link=event.target.closest('a[href^="#"]');
  if(link && ['today','library','progress','settings'].includes(link.hash.slice(1))) {event.preventDefault();navigate(link.hash.slice(1));return;}
  const button=event.target.closest('[data-action]'); if(!button) return;
  const {action,kind,id,grade,char}=button.dataset;
  if(action==='start') beginSession(kind);
  if(action==='extra') beginSession(kind,true);
  if(action==='leave-session') navigate('today');
  if(action==='reveal') evaluateAnswer(true);
  if(action==='next' && session?.feedback) {if(session.feedback.correct) review(['hard','good','easy'].includes(grade)?grade:'good');session.index++;session.feedback=null;session.attempt='';render();}
  if(action==='finish') {session=null;navigate('today');}
  if(action==='another') {session=null;beginSession();}
  if(action==='accent') {const input=document.querySelector('#answer');const start=input.selectionStart??input.value.length;const end=input.selectionEnd??start;input.setRangeText(char,start,end,'end');if(session)session.attempt=input.value;input.focus();}
  if(action==='filter') {libraryKind=kind;render();}
  if(action==='add-card') openCardDialog();
  if(action==='close-card') cardDialog.close();
  if(action==='speak') speak(id);
  if(action==='choose-language') {session=null;state.settings.language=id;save();navigate('today');}
  if(action==='delete-card') {
    const c=state.customCards.find(c=>c.id===id);if(!c)return;
    closeRestore();
    restoreDialog.innerHTML=`<div class="dialog-heading"><h2 id="restore-title">Remove this item?</h2><button class="icon-button" data-action="close-restore" aria-label="Close">${icon('close')}</button></div><p>${esc(c.cue[source()])}</p><p class="field-help">This removes the personal card and its review schedule. Export a backup first if you want to keep it.</p><button class="button primary" data-action="confirm-delete" data-id="${esc(id)}">Remove item</button>`;restoreDialog.showModal();
  }
  if(action==='confirm-delete') {state.customCards=state.customCards.filter(c=>c.id!==id);delete state.progress[id];session=null;save();restoreDialog.close();render();toast('Item removed.');}
  if(action==='backup') download(serializeBackup(state),`parola-${dayKey(new Date())}.json`,'application/json');
  if(action==='recover') download(rawRecovery,'parola-original-recovery.json','application/json');
  if(action==='close-restore') closeRestore();
  if(action==='confirm-restore' && pendingRestore && restoreDialog.open) {const candidate=pendingRestore;closeRestore();state=candidate;session=null;preserveStorage=false;storageIssue='';save();navigate('today');toast('Backup restored. Your practice is ready.');}
  if(action==='calendar') {const time=document.querySelector('#reminder-time').value;if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){toast('Choose a valid reminder time.');return;}state.settings.reminderTime=time;save();download(makeCalendar({time,url:location.origin}), 'parola-daily-practice.ics','text/calendar;charset=utf-8');toast('Open the calendar file, import the event, and enable calendar alerts.');}
  if(action==='notifications') {
    if(state.settings.browserReminders) {state.settings.browserReminders=false;save();render();toast('Browser reminders turned off.');}
    else {const result=await requestNotifications();state.settings.browserReminders=result.status==='granted';save();render();toast(result.message);}
  }
  if(action==='test-notification') {const result=await sendTestNotification();toast(result.message);}
  if(action==='install' && installPrompt) {await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;render();}
});
document.addEventListener('submit',event=>{
  if(event.target.id==='answer-form') {event.preventDefault();evaluateAnswer();}
  if(event.target.id==='preferences-form') {
    event.preventDefault();const data=new FormData(event.target);
    state.settings.dailyGoal=Number(data.get('dailyGoal'));
    for(const l of LANGUAGES) state.settings.sources[l.id]=data.get(`source-${l.id}`);
    session=null;save();render();toast('Preferences saved. A little practice, your way.');
  }
  if(event.target.id==='custom-card-form') {
    event.preventDefault();const data=new FormData(event.target);const answer=data.get('answer').trim();
    const card={id:`custom-${crypto.randomUUID()}`,language:data.get('language'),kind:data.get('kind'),topic:'My collection',level:'A1',cue:{en:data.get('en').trim(),es:data.get('es').trim()},answers:[...new Set([answer,...data.get('alternatives').split(';').map(s=>s.trim()).filter(Boolean)])],note:{en:data.get('note').trim(),es:data.get('note').trim()},example:{target:'',en:'',es:''}};
    try {state=validateState({...state,customCards:[...state.customCards,card]},CARDS);save();session=null;cardDialog.close();render();toast('Added. You’ll meet it in your next practice.');}
    catch(error) {document.querySelector('#custom-error').textContent=`Could not add this card: ${error.message}`;}
  }
});
document.addEventListener('input',event=>{if(event.target.id==='answer' && session && !session.feedback)session.attempt=event.target.value;if(event.target.id==='library-search'){libraryQuery=event.target.value;document.querySelector('#library-results').innerHTML=libraryResults();}});
document.addEventListener('change',async event=>{
  if(event.target.id==='language-select'){state.settings.language=event.target.value;session=null;save();render();}
  if(event.target.id==='reminder-time'){if(event.target.validity.valid && event.target.value){state.settings.reminderTime=event.target.value;save();}}
  if(event.target.id==='restore-file') {
    closeRestore();const request=restoreRequest;
    const file=event.target.files[0];event.target.value='';if(!file)return;
    if(file.size>5*1024*1024){toast('This backup is too large. Choose a Parola JSON backup under 5 MB.');return;}
    try {const text=await file.text();if(request!==restoreRequest)return;pendingRestore=parseBackup(text,CARDS);restoreDialog.innerHTML=`<div class="dialog-heading"><h2 id="restore-title">Restore your practice?</h2><button class="icon-button" data-action="close-restore" aria-label="Close">${icon('close')}</button></div><p>This backup contains ${Object.keys(pendingRestore.progress).length} practiced items and ${pendingRestore.customCards.length} personal cards.</p><p>Restoring replaces the progress and preferences on this device. Export your current backup first if you want to keep it.</p><button class="button primary" data-action="confirm-restore">Replace with this backup</button>`;restoreDialog.showModal();}
    catch(error){if(request!==restoreRequest)return;pendingRestore=null;toast(`Could not restore: ${error.message}`);}
  }
});
restoreDialog.addEventListener('cancel',discardRestore);
window.addEventListener('pagehide',closeRestore);
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(['today','library','progress','settings'].includes(next)){closeRestore();view=next;render();}});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(view==='settings')render();});
window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY)return;
  closeRestore();
  try {state=event.newValue?validateState(JSON.parse(event.newValue),CARDS):createState();session=null;view='today';render();toast('Progress changed in another tab. Your practice is now up to date.');}
  catch{toast('Another tab changed saved data. Export your backup before reloading.');preserveStorage=true;}
});
async function checkReminder(){try{if(dayKey(new Date())!==renderedDay && view!=='session')render();const s=stats();await maybeNotify({...state.settings,dailyGoal:s.goal},s.today);}catch{/* Reminders must never interrupt practice. */}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkReminder();});
installServiceWorker().catch(()=>toast('Offline mode could not be prepared. Practice is still available while online.'));
setInterval(checkReminder,60000);
render(); checkReminder();
