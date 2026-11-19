(function () {
  'use strict';
  var E = window.QuizEngine;
  var CIRC = ['①', '②', '③', '④'];
  var LET = ['가', '나', '다', '라', '마'];
  var EXAMPLE = '에스프레소는 곱게 간 원두에 뜨거운 물을 높은 압력으로 통과시켜 짧은 시간에 뽑는 커피이다. 에스프레소를 뽑을 때 알맞은 물의 온도는 약 90도에서 95도이다. 추출 압력은 약 9기압이고 추출 시간은 보통 25초에서 30초이다. 에스프레소 위에 생기는 황금빛 거품층을 크레마라고 한다. 아메리카노는 에스프레소에 뜨거운 물을 더해서 만든다. 카페라테는 에스프레소에 스팀 우유를 많이 넣고 얇은 우유 거품을 올린 음료이다. 카푸치노는 에스프레소에 스팀 우유와 두툼한 우유 거품을 올린 음료이다. 커피 원두는 아라비카와 로부스타 두 가지가 대표적이다. 아라비카는 향이 풍부하고 산미가 있으며 로부스타는 쓴맛이 강하고 카페인이 많다. 원두를 오래 볶을수록 산미는 줄어들고 쓴맛은 강해진다. 분쇄도가 너무 굵으면 물이 빨리 빠져서 과소추출이 되고 신맛이 난다. 분쇄도가 너무 고우면 과다추출이 되어 쓴맛이 강해진다. 탬핑은 포터필터에 담은 커피 가루를 눌러 평평하게 다지는 작업이다. 볶은 원두는 공기와 빛과 습기에 닿으면 산화되어 향이 약해진다.';
  var PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var OCR_MAIN = 'kor', OCR_MIX = 'kor+eng', OCR_OK_CONF = 90, OCR_LOW_CONF = 86;
  var TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var scriptP = {};
  // 글자 인식·PDF 도구는 파일을 고를 때만 내려받아요. 처음 화면은 이걸 기다리지 않아요.
  function loadScript(url) {
    if (!scriptP[url]) {
      scriptP[url] = new Promise(function (resolve, reject) {
        var el = document.createElement('script');
        el.src = url; el.async = true;
        el.onload = function () { resolve(); };
        el.onerror = function () { delete scriptP[url]; el.remove(); reject({ code: 'load' }); };
        document.head.append(el);
      });
    }
    return scriptP[url];
  }
  var PIN_SHA = '4055a31f0baaeee92e2cfa10087ad3a04b817dd749db25c9ace5dc804d95b98a';
  var PIN_FALLBACK = 'aehf5k';

  function $(id) { return document.getElementById(id); }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      [].concat(arguments[i]).forEach(function (kid) {
        if (kid == null || kid === false) return;
        el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
      });
    }
    return el;
  }
  function uid8() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function fmtDate(t) {
    var d = new Date(t), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  function SB() { return a11y.easy ? 'auto' : 'smooth'; }

  /* ---------- 보기 설정 (쉬운 화면, 글자 크기, 고대비, 읽어주기) ---------- */
  var canSpeak = false;
  try { canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window; } catch (e) { canSpeak = false; }
  function speak(text) {
    if (!canSpeak || !text) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR'; u.rate = 0.85;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  function stopSpeak() { if (canSpeak) { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } } }
  function readBtn(getText) {
    if (!canSpeak) return null;
    return h('button', { type: 'button', class: 'btn small speak', 'aria-label': '소리로 듣기', text: '🔊 읽어주기', onclick: function () { speak(getText()); } });
  }
  function qSpeech(q) {
    var t = String(q.passage || '').replace(/____/g, ' 빈칸 ') + '. ' + q.q;
    if (q.type === 'mc') t += ' ' + q.choices.map(function (c, k) { return (k + 1) + '번 ' + c; }).join('. ');
    if (q.type === 'ox') t += ' 맞으면 오, 틀리면 엑스.';
    if (q.type === 'essay') t += ' 자신의 말로 설명해 보세요.';
    if (q.type === 'order') t += ' ' + q.items.map(function (x, k) { return (k + 1) + '번 ' + x; }).join('. ');
    if (q.type === 'match') t += ' 용어는 ' + q.items.join(', ') + '. 설명은 ' + q.options.map(function (x, k) { return LET[k] + '. ' + x; }).join(' ');
    return t;
  }
  function easyOk(q) { return q && (q.type === 'mc' || q.type === 'ox' || q.type === 'match' || q.type === 'order') && !q.trick && !(q.choices && q.choices.indexOf(E.NONE) >= 0); }
  var NAV_EASY = { make: '✏️ 문제 만들기', solve: '📖 문제 풀기', notes: '📒 틀린 문제', mine: '📝 내 문제' };
  var NAV_NORM = { make: '만들기', solve: '풀기', notes: '오답노트', mine: '내 문제' };
  function applyA11y() {
    var r = document.documentElement;
    r.dataset.easy = a11y.easy ? 'true' : 'false';
    r.dataset.size = a11y.size;
    r.dataset.contrast = a11y.contrast ? 'high' : 'normal';
    document.querySelectorAll('.nav button').forEach(function (b) {
      var v = b.dataset.view, label = (a11y.easy ? NAV_EASY : NAV_NORM)[v];
      if (label && b.firstChild && b.firstChild.nodeType === 3) b.firstChild.nodeValue = label;
    });
    var set = function (id, val) { var el = $(id); if (el) el.checked = !!val; };
    set('a11yEasy', a11y.easy); set('a11yContrast', a11y.contrast); set('a11yRead', a11y.read);
    document.querySelectorAll('input[name="fs"]').forEach(function (x) { x.checked = x.value === a11y.size; });
  }
  function saveA11y() { return DB.put('kv', Object.assign({}, a11y, { k: 'a11y' })).catch(function () { /* ignore */ }); }
  function bindA11y() {
    $('a11yEasy').addEventListener('change', function () { a11y.easy = $('a11yEasy').checked; applyA11y(); saveA11y(); renderHome(); scheduleCap(); });
    $('a11yContrast').addEventListener('change', function () { a11y.contrast = $('a11yContrast').checked; applyA11y(); saveA11y(); });
    $('a11yRead').addEventListener('change', function () { a11y.read = $('a11yRead').checked; saveA11y(); if (a11y.read) speak('읽어주기를 켰어요.'); });
    document.querySelectorAll('input[name="fs"]').forEach(function (x) { x.addEventListener('change', function () { if (x.checked) { a11y.size = x.value; applyA11y(); saveA11y(); } }); });
  }

  /* ---------- 저장소: IndexedDB (안 되면 메모리) ---------- */
  var STORES = { kv: 'k', sessions: 'id', attempts: 'id', imports: 'uid', materials: 'id', lists: 'id' };
  var DB = (function () {
    var mem = {}; Object.keys(STORES).forEach(function (s) { mem[s] = {}; });
    var idb = null, ready = null;
    function open() {
      if (ready) return ready;
      ready = new Promise(function (resolve) {
        try {
          var req = indexedDB.open('quiznote', 3);
          req.onupgradeneeded = function () {
            Object.keys(STORES).forEach(function (s) { if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: STORES[s] }); });
          };
          req.onsuccess = function () { idb = req.result; resolve(); };
          req.onerror = function () { resolve(); };
          req.onblocked = function () { resolve(); };
        } catch (e) { resolve(); }
      });
      return ready;
    }
    function tx(store, mode, fn) {
      return open().then(function () {
        if (!idb) return fn(null, mem[store]);
        return new Promise(function (resolve, reject) {
          var t = idb.transaction(store, mode), os = t.objectStore(store), out;
          try { out = fn(os, null); } catch (e) { reject(e); return; }
          t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
          t.onerror = function () { reject(t.error); };
          t.onabort = function () { reject(t.error); };
        });
      });
    }
    return {
      put: function (store, obj) {
        return tx(store, 'readwrite', function (os, m) { if (os) os.put(obj); else m[obj[STORES[store]]] = JSON.parse(JSON.stringify(obj)); });
      },
      get: function (store, key) {
        return open().then(function () {
          if (!idb) return mem[store][key];
          return new Promise(function (resolve) {
            var r = idb.transaction(store, 'readonly').objectStore(store).get(key);
            r.onsuccess = function () { resolve(r.result); }; r.onerror = function () { resolve(undefined); };
          });
        });
      },
      all: function (store) {
        return open().then(function () {
          if (!idb) return Object.keys(mem[store]).map(function (k) { return mem[store][k]; });
          return new Promise(function (resolve) {
            var r = idb.transaction(store, 'readonly').objectStore(store).getAll();
            r.onsuccess = function () { resolve(r.result || []); }; r.onerror = function () { resolve([]); };
          });
        });
      },
      del: function (store, key) {
        return tx(store, 'readwrite', function (os, m) { if (os) os.delete(key); else delete m[key]; });
      },
      clear: function (store) {
        return tx(store, 'readwrite', function (os, m) { if (os) os.clear(); else mem[store] = {}; });
      },
      persistent: function () { return open().then(function () { return !!idb; }); }
    };
  })();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }

  /* ---------- 사용자 ---------- */
  var me = { uid: '', name: '' };
  var A = [];           // 이 사용자의 모든 채점 기록
  var sessionsCache = [];
  var prefs = { examName: '', examDate: '', goal: 30, tl: 0 };
  var a11y = { easy: true, size: 'l', contrast: false, read: false };
  var cfg = { local: null, remote: null };   // 함정 문제 간격: 이 기기 설정(관리자) > 설정 파일(config.json) > 기본 10
  function effTrick() {
    var v = typeof cfg.local === 'number' ? cfg.local : typeof cfg.remote === 'number' ? cfg.remote : 10;
    return Math.max(0, Math.min(50, Math.floor(v)));
  }
  function trickSource() { return typeof cfg.local === 'number' ? '이 기기에서 정한 값' : typeof cfg.remote === 'number' ? '설정 파일(config.json)' : '기본값'; }
  try {
    fetch('config.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && typeof j.trickEvery === 'number') cfg.remote = j.trickEvery; }).catch(function () { /* 설정 파일이 없어도 돼요 */ });
  } catch (e) { /* ignore */ }
  var stars = {};       // 별표 친 문제 (k -> 문제)
  var banned = {};      // 지운 문제 (k -> 1). 오답노트에서 빠지고, 같은 글로 다시 만들어도 나오지 않아요.

  function loadMe() {
    return DB.get('kv', 'me').then(function (r) {
      if (r && r.uid) me = { uid: r.uid, name: r.name || '' };
      else { me = { uid: uid8(), name: '' }; return DB.put('kv', { k: 'me', uid: me.uid, name: '' }); }
    }).then(function () { return Promise.all([DB.get('kv', 'prefs'), DB.get('kv', 'stars'), DB.get('kv', 'a11y'), DB.get('kv', 'config'), DB.get('kv', 'banned')]); }).then(function (r) {
      banned = (r[4] && r[4].map) || {};
      if (r[3] && typeof r[3].trickEvery === 'number') cfg.local = r[3].trickEvery;
      prefs = Object.assign({ examName: '', examDate: '', goal: 30, tl: 0 }, r[0] || {});
      stars = (r[1] && r[1].map) || {};
      if (r[2]) a11y = Object.assign(a11y, r[2]);
    });
  }
  function savePrefs() { return DB.put('kv', Object.assign({}, prefs, { k: 'prefs' })).catch(function () { /* ignore */ }); }
  function saveBanned() { return DB.put('kv', { k: 'banned', map: banned }).catch(function () { /* ignore */ }); }
  function banQ(q) {
    if (!q || !q.k) return;
    banned[q.k] = 1; delete stars[q.k];
    saveBanned(); saveStars(); updateBadge();
  }
  // 지우기처럼 되돌리기 어려운 버튼은 한 번 더 눌러야 실행돼요. (3초 안에 안 누르면 원래대로)
  function armConfirm(btn, yesText, onYes) {
    var orig = btn.textContent, armed = false, timer = 0;
    btn.addEventListener('click', function () {
      if (!armed) {
        armed = true; btn.textContent = yesText; btn.classList.add('danger');
        timer = setTimeout(function () { armed = false; btn.textContent = orig; btn.classList.remove('danger'); }, 3000);
        return;
      }
      clearTimeout(timer); armed = false; btn.textContent = orig; btn.classList.remove('danger');
      onYes();
    });
    return btn;
  }
  function confirmBtn(label, yesText, onYes, cls) {
    return armConfirm(h('button', { type: 'button', class: 'btn small ' + (cls || ''), text: label }), yesText, onYes);
  }
  function saveStars() { return DB.put('kv', { k: 'stars', map: stars }).catch(function () { /* ignore */ }); }
  function saveName(n) {
    me.name = n.trim().slice(0, 20);
    return DB.put('kv', { k: 'me', uid: me.uid, name: me.name });
  }
  function reloadData() {
    W = null;
    return Promise.all([DB.all('attempts'), DB.all('sessions')]).then(function (r) {
      A = r[0].filter(function (a) { return a.uid === me.uid; }).sort(function (a, b) { return a.t - b.t; });
      var old = r[1].filter(function (x) { return x.list; });
      old.forEach(function (x) {   // 예전 방식: 문제 목록이 기록 안에 들어 있던 것을 따로 옮겨요
        var list = x.list;
        x.count = list.length; delete x.list;
        DB.put('lists', { id: x.id, list: list }).then(function () { return DB.put('sessions', x); }).catch(function () { /* ignore */ });
      });
      sessionsCache = r[1].filter(function (s) { return s.uid === me.uid; }).sort(function (a, b) { return b.t - a.t; });
    });
  }

  /* ---------- 약점 계산 ---------- */
  var W = null;   // 통계 캐시: 답할 때마다 처음부터 다시 세지 않고 한 건씩 더해요
  function applyStat(w, a) {
    var s = w.byK[a.k] || (w.byK[a.k] = { wrong: 0, total: 0, lastOk: true, q: null, t: 0, streak: 0 });
    s.total++;
    if (!a.ok) { s.wrong++; s.streak = 0; if (a.q) s.q = a.q; } else s.streak++;
    s.lastOk = a.ok; s.t = a.t;
    if (a.target) {
      var tm = w.byTerm[a.target] || (w.byTerm[a.target] = { wrong: 0, total: 0 });
      tm.total++; if (!a.ok) tm.wrong++;
    }
  }
  function weakStats() {
    if (!W) { W = { byK: {}, byTerm: {} }; A.forEach(function (a) { applyStat(W, a); }); }
    return W;
  }
  function addAttempt(rec) { A.push(rec); if (W) applyStat(W, rec); }
  function noteCount() {
    var w = weakStats(), n = 0;
    for (var k in w.byK) { var s = w.byK[k]; if (!s.lastOk && s.q && !banned[k]) n++; }
    return n;
  }
  function currentNotes() {
    var w = weakStats();
    return Object.keys(w.byK).map(function (k) { return { k: k, s: w.byK[k] }; })
      .filter(function (x) { return !x.s.lastOk && x.s.q && !banned[x.k]; })
      .sort(function (a, b) { return b.s.wrong - a.s.wrong || b.s.t - a.s.t; });
  }
  function hasWeak() { return A.some(function (a) { return !a.ok; }); }
  function real() { return A.filter(function (a) { return a.type !== 'card'; }); }

  /* 오늘 복습: 틀린 문제를 1, 3, 7, 14일 간격으로 다시 내요. 5번 연속 맞히면 졸업이에요. */
  var STEPS = [0, 1, 3, 7, 14];
  function dueReviews() {
    var w = weakStats(), now = Date.now();
    return Object.keys(w.byK).map(function (k) { return { k: k, s: w.byK[k] }; })
      .filter(function (x) { return x.s.q && !banned[x.k] && x.s.wrong > 0 && x.s.streak < 5 && now >= x.s.t + STEPS[Math.min(x.s.streak, 4)] * 864e5; })
      .sort(function (a, b) { return a.s.streak - b.s.streak || b.s.wrong - a.s.wrong; });
  }
  function dayKey(t) { var d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function todayCount() { var k = dayKey(Date.now()); return real().filter(function (a) { return dayKey(a.t) === k; }).length; }
  function studyStreak() {
    var days = {}; real().forEach(function (a) { days[dayKey(a.t)] = 1; });
    var n = 0, d = new Date();
    if (!days[dayKey(d.getTime())]) d.setDate(d.getDate() - 1);
    while (days[dayKey(d.getTime())]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function ddays() {
    if (!prefs.examDate) return null;
    var t = new Date(prefs.examDate + 'T00:00:00'); if (isNaN(t.getTime())) return null;
    var now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((t - now) / 864e5);
  }

  /* ---------- 화면 ---------- */
  var VIEWS = ['make', 'solve', 'notes', 'history', 'admin', 'cards', 'mine'];
  var adminOn = false;
  try { adminOn = sessionStorage.getItem('qn.admin') === '1'; } catch (e) { adminOn = false; }

  function show(view) {
    stopSpeak();
    if (VIEWS.indexOf(view) < 0 || (view === 'admin' && !adminOn)) view = 'make';
    VIEWS.forEach(function (v) { $('view-' + v).hidden = v !== view; });
    document.querySelectorAll('.nav button').forEach(function (b) {
      if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (view === 'notes') renderNotes();
    if (view === 'mine') renderMine();
    if (view === 'history') renderHistory();
    if (view === 'admin') renderAdmin();
    if (view === 'solve' && !Q.list.length) renderSolveEmpty();
    if (view === 'make') { renderHome(); renderResume(); renderMaterials(); }
    if (view === 'cards' && !C.cards.length) { view = 'make'; show('make'); return; }
    if (view === 'cards') renderCard();
  }
  function go(view) {
    show(view);
    if (location.hash.slice(1) !== view && view !== 'admin' && view !== 'cards') { try { location.hash = view; } catch (e) { /* ignore */ } }
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.nav button').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.view === 'mine') { M.src = 'mine'; M.editing = null; M.delIdx = -1; } go(b.dataset.view); }); });
  window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });
  function updateAdminTab() { $('tabAdmin').hidden = !adminOn; }
  function updateBadge() {
    var n = noteCount(), b = $('noteBadge');
    b.textContent = String(n); b.hidden = n === 0;
  }

  /* ---------- 만들기: 자료 ---------- */
  var src = $('src');
  var srcIsExample = true;
  function setSrc(t, example) { src.value = t; srcIsExample = !!example; updateCount(); }
  function updateCount() { $('count').textContent = src.value.length.toLocaleString('ko-KR') + '자'; scheduleCap(); }
  src.addEventListener('input', function () { srcIsExample = false; updateCount(); });
  $('btnExample').addEventListener('click', function () { setSrc(EXAMPLE, true); status('read', '예시 글을 불러왔어요.'); autoMake(true); });
  $('btnClear').addEventListener('click', function () { setSrc('', false); status('read', ''); src.focus(); });

  function status(which, msg, err) {
    var el = which === 'read' ? $('readStatus') : $('genStatus');
    el.textContent = msg || '';
    el.className = 'status' + (err ? ' err' : '');
  }
  function appendSource(t) {
    t = t.trim();
    if (!t) return;
    setSrc((src.value.trim() && !srcIsExample ? src.value.replace(/\s+$/, '') + '\n\n' : '') + t, false);
  }

  /* ---------- 파일 인식: 이미지 OCR (Tesseract.js) ---------- */
  var ocr = { workers: [], mix: null, mixP: null, mixQ: Promise.resolve(), mixFailed: false, stat: null, gen: 0, cancel: null, cancelFn: null, onProgress: null };
  var LOG_KO = {
    'loading tesseract core': '인식 엔진을 불러오는 중…',
    'initializing tesseract': '인식 엔진을 준비하는 중…',
    'loading language traineddata': '글자 인식 데이터를 내려받는 중… (처음 한 번만, 수 MB)',
    'initializing api': '인식 준비 중…'
  };
  function newCancel() {
    ocr.stat = { col: { tried: 0, won: 0, off: false }, mix: { tried: 0, won: 0, off: false } };
    ocr.cancel = new Promise(function (_, reject) { ocr.cancelFn = function () { reject({ code: 'cancelled' }); }; });
    ocr.cancel.catch(function () { /* handled where raced */ });
  }
  function race(p) { return Promise.race([p, ocr.cancel]); }
  async function loadTess() {
    if (window.Tesseract) return;
    status('read', '글자 인식 도구를 불러오는 중…');
    try { await race(loadScript(TESS_URL)); } catch (e) { if (e && e.code === 'cancelled') throw e; throw { code: 'notess' }; }
    if (!window.Tesseract) throw { code: 'notess' };
  }
  // 멈추기를 눌러도 만들던 일꾼이 남지 않게, 늦게 도착한 일꾼은 바로 끝내요.
  function makeWorker(lang) {
    var gen = ocr.gen;
    var p = window.Tesseract.createWorker(lang, 1, {
      logger: function (m) {
        if (m.status === 'recognizing text') { if (ocr.onProgress) ocr.onProgress(m.progress); }
        else if (LOG_KO[m.status]) status('read', LOG_KO[m.status]);
      }
    });
    p.then(function (w) { if (gen !== ocr.gen) { try { w.terminate(); } catch (e) { /* ignore */ } } }, function () { /* handled by race */ });
    return race(p);
  }
  // 한글 전용 일꾼 n개. (한글+영어를 한꺼번에 켜면 한글을 더 많이 틀려서, 한글만 먼저 읽어요)
  async function getWorkers(n) {
    await loadTess();
    while (ocr.workers.length < n) ocr.workers.push(await makeWorker(OCR_MAIN));
    return ocr.workers.slice(0, n);
  }
  function stopOcr() {
    if (ocr.cancelFn) ocr.cancelFn();
    ocr.gen++;
    ocr.workers.concat(ocr.mix ? [ocr.mix] : []).forEach(function (w) { try { w.terminate(); } catch (e) { /* ignore */ } });
    ocr.workers = []; ocr.mix = null; ocr.mixP = null; ocr.mixQ = Promise.resolve();
  }
  // 한 쪽을 읽어요. 먼저 한글 전용으로 읽고, 자신(확신도)이 낮을 때만 다른 방법으로 한 번 더 읽어 더 자신 있는 쪽을 써요.
  //  1) 줄 나누기를 ‘한 단 글’로 바꿔서 다시 읽기  2) 영어까지 섞어서 다시 읽기
  // 추가로 읽는 방법이 3번 해 봐도 한 번도 더 나은 결과를 못 냈다면(= 확신도 기준이 안 맞는 환경) 그 방법은 이번 읽기에서 그만둬요.
  function ocrNoop() { /* ignore */ }
  async function ocrPass(worker, cv, psm) {
    if (psm) await worker.setParameters({ tessedit_pageseg_mode: psm });
    try {
      var r = await race(worker.recognize(cv)), d = r.data || {};
      return { text: d.text || '', conf: typeof d.confidence === 'number' ? d.confidence : 100 };
    } finally { if (psm) worker.setParameters({ tessedit_pageseg_mode: '3' }).catch(ocrNoop); }
  }
  function ocrChars(t) { return t.replace(/\s/g, '').length; }
  async function readCanvas(worker, cv) {
    var best = await ocrPass(worker, cv, null), st = ocr.stat;
    function take(kind, r) {
      st[kind].tried++;
      if (r.conf >= best.conf + 2) { best = r; st[kind].won++; }
      if (st[kind].tried >= 3 && !st[kind].won) st[kind].off = true;
    }
    if (ocrChars(best.text) >= 12 && best.conf < OCR_OK_CONF && best.conf >= 70 && !st.col.off) {   // 70 아래는 글자가 아니라 언어가 안 맞는 경우라 건너뛰어요
      try { take('col', await ocrPass(worker, cv, '4')); }
      catch (e) { if (e && e.code === 'cancelled') throw e; st.col.off = true; }
    }
    if (ocrChars(best.text) >= 12 && best.conf < OCR_LOW_CONF && !st.mix.off && !ocr.mixFailed) {
      try {
        if (!ocr.mixP) ocr.mixP = makeWorker(OCR_MIX).then(function (w) { ocr.mix = w; return w; });
        var mw = await race(ocr.mixP);
        // 일꾼 하나는 한 번에 한 쪽만 읽을 수 있어서 줄을 세워요
        var run = ocr.mixQ.then(function () { return ocrPass(mw, cv, null); });
        ocr.mixQ = run.catch(ocrNoop);
        take('mix', await run);
      } catch (e) {
        if (e && e.code === 'cancelled') throw e;
        ocr.mixFailed = true; ocr.mixP = null;   // 영어 데이터를 못 받아도 한글 결과는 그대로 써요
      }
    }
    return cleanOcrText(best.text);
  }

  /* OCRPREP:BEGIN — 사진 그림자·밝기 보정, 읽은 글 정리 (밖에서도 시험할 수 있게 함수로만 둬요) */
  // 칸마다 ‘종이 바탕 밝기’를 추정해서 나눠요. 한쪽이 어둡거나 그림자가 져도 바탕이 고르게 흰색이 돼요.
  function ocrFlatten(g, w, h, B) {
    var gw = Math.ceil(w / B), gh = Math.ceil(h / B), bg = new Float32Array(gw * gh), hist = new Uint32Array(256), bx, by, x, y, i;
    for (by = 0; by < gh; by++) for (bx = 0; bx < gw; bx++) {
      hist.fill(0);
      var n = 0, y1 = Math.min(h, (by + 1) * B), x1 = Math.min(w, (bx + 1) * B);
      for (y = by * B; y < y1; y += 2) { var row = y * w; for (x = bx * B; x < x1; x += 2) { hist[g[row + x]]++; n++; } }
      var acc = 0, need = n * 0.9, v = 255;
      for (i = 0; i < 256; i++) { acc += hist[i]; if (acc >= need) { v = i; break; } }
      bg[by * gw + bx] = v;
    }
    function filt(src, fn) {
      var o = new Float32Array(src.length), dy, dx;
      for (var yy = 0; yy < gh; yy++) for (var xx = 0; xx < gw; xx++) {
        var a = [];
        for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) { var py = yy + dy, px = xx + dx; if (py >= 0 && py < gh && px >= 0 && px < gw) a.push(src[py * gw + px]); }
        o[yy * gw + xx] = fn(a);
      }
      return o;
    }
    var avg = function (a) { var t = 0; for (var k = 0; k < a.length; k++) t += a[k]; return t / a.length; };
    var m = filt(bg, function (a) { return Math.max.apply(null, a); });   // 글자만 가득한 칸은 이웃 바탕으로 메워요
    m = filt(filt(m, avg), avg);
    var out = new Uint8Array(w * h);
    for (y = 0; y < h; y++) {
      var fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / B - 0.5)), y0 = Math.floor(fy), yb = Math.min(gh - 1, y0 + 1), ty = fy - y0;
      for (x = 0; x < w; x++) {
        var fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / B - 0.5)), x0 = Math.floor(fx), xb = Math.min(gw - 1, x0 + 1), tx = fx - x0;
        var b = (m[y0 * gw + x0] * (1 - tx) + m[y0 * gw + xb] * tx) * (1 - ty) + (m[yb * gw + x0] * (1 - tx) + m[yb * gw + xb] * tx) * ty;
        var val = g[y * w + x] * 242 / Math.max(b, 24);
        out[y * w + x] = val > 255 ? 255 : val | 0;
      }
    }
    return out;
  }
  // 어두운 쪽 1%·밝은 쪽 1%를 잘라 대비를 늘려요
  function ocrStretch(g) {
    var hist = new Uint32Array(256), n = g.length, i, a = 0, lo = 0, hi = 255;
    for (i = 0; i < n; i++) hist[g[i]]++;
    for (i = 0; i < 256; i++) { a += hist[i]; if (a >= n * 0.01) { lo = i; break; } }
    a = 0;
    for (i = 255; i >= 0; i--) { a += hist[i]; if (a >= n * 0.01) { hi = i; break; } }
    if (hi - lo < 40) return g;
    var out = new Uint8Array(n), k = 255 / (hi - lo);
    for (i = 0; i < n; i++) { var v = (g[i] - lo) * k; out[i] = v < 0 ? 0 : v > 255 ? 255 : v | 0; }
    return out;
  }
  // 검은 바탕에 흰 글씨(슬라이드 화면 등)면 뒤집어서 ‘흰 바탕에 검은 글씨’로 맞춰요
  function ocrInvertIfLight(g) {
    var hist = new Uint32Array(256), n = g.length, i, acc = 0, med = 0, hiMass = 0, loMass = 0;
    for (i = 0; i < n; i++) hist[g[i]]++;
    for (i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n / 2) { med = i; break; } }
    if (med >= 100) return g;
    for (i = 0; i < 256; i++) { if (i > med + 60) hiMass += hist[i]; else if (i < med - 60) loMass += hist[i]; }
    if (hiMass < n * 0.003 || hiMass < loMass * 2) return g;
    var out = new Uint8Array(n);
    for (i = 0; i < n; i++) out[i] = 255 - g[i];
    return out;
  }
  function ocrPrepare(g, w, h) {
    g = ocrInvertIfLight(g);
    g = ocrFlatten(g, w, h, Math.max(16, Math.round(Math.max(w, h) / 50)));
    return ocrStretch(g);
  }
  // 읽은 글 정리: 공백 정리, 기호·잡음만 있는 줄 버리기
  function cleanOcrText(t) {
    var out = [];
    String(t || '').replace(/\r/g, '').split('\n').forEach(function (ln) {
      ln = ln.replace(/[\u00a0\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
      if (!ln) { if (out.length && out[out.length - 1] !== '') out.push(''); return; }
      var letters = (ln.match(/[가-힣A-Za-z0-9]/g) || []).length, solid = ln.replace(/\s/g, '').length;
      if (letters < 2 || letters / solid < 0.35) return;
      out.push(ln);
    });
    return out.join('\n').trim();
  }
  /* OCRPREP:END */

  function toGrayCanvas(drawable, w, h2) {
    var longest = Math.max(w, h2), scale = 1;
    if (longest > 1800) scale = 1800 / longest; else if (longest < 900) scale = Math.min(2, 1200 / longest);
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * scale)); cv.height = Math.max(1, Math.round(h2 * scale));
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(drawable, 0, 0, cv.width, cv.height);
    var img = ctx.getImageData(0, 0, cv.width, cv.height), d = img.data, n = cv.width * cv.height, g = new Uint8Array(n), i, j;
    for (i = 0, j = 0; j < n; i += 4, j++) g[j] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    g = ocrPrepare(g, cv.width, cv.height);
    for (i = 0, j = 0; j < n; i += 4, j++) { d[i] = d[i + 1] = d[i + 2] = g[j]; d[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  async function fileToCanvas(file) {
    var url = URL.createObjectURL(file);
    try {
      var im = new Image();
      im.src = url;
      await im.decode();
      return toGrayCanvas(im, im.naturalWidth, im.naturalHeight);
    } finally { URL.revokeObjectURL(url); }
  }
  function isNative() {
    try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
    catch (e) { return false; }
  }
  var nativeOcr = null;
  // 한 쪽씩 읽고 바로 메모리를 비워요. (여러 쪽을 한꺼번에 들고 있으면 폰이 느려지거나 꺼져요)
  function setBar(f) {
    var b = $('readBar'); if (!b) return;
    b.hidden = f == null;
    if (f != null) b.firstElementChild.style.width = Math.max(2, Math.min(100, Math.round(f * 100))) + '%';
  }
  // 쪽(사진)을 읽어요. 쪽이 3장 이상이고 폰 성능이 괜찮으면 일꾼 2개가 나눠 읽어서 빨라져요. 읽은 순서는 그대로 지켜요.
  // onPage(i, text, err)가 있으면 한 장이 실패해도 다음 장으로 넘어가고, 읽은 글은 그때그때 넘겨줘요.
  function ocrLanes(count) {
    var cores = navigator.hardwareConcurrency || 2, mem = navigator.deviceMemory || 4;
    return count >= 3 && cores >= 4 && mem >= 4 ? 2 : 1;
  }
  async function ocrPages(count, getCanvas, label, onPage) {
    var native = isNative(), lanes = native ? 1 : ocrLanes(count), workers = native ? [null] : await getWorkers(lanes), out = [];
    if (native && !nativeOcr) nativeOcr = window.Capacitor.registerPlugin('Ocr');
    var slots = [], res = [], nextI = 0, finished = 0;
    for (var s = 0; s < count; s++) (function (k) { slots[k] = new Promise(function (r) { res[k] = r; }); })(s);
    function note(i) {
      var tag = label + (count > 1 ? ' ' + (i + 1) + '/' + count : '');
      status('read', '글자를 읽는 중… ' + tag + (lanes > 1 ? ' (' + finished + '장 끝)' : ''));
    }
    async function lane(worker) {
      for (;;) {
        var i = nextI++;
        if (i >= count) return;
        var cv = null, txt = '', err = null;
        note(i);
        try {
          cv = await race(Promise.resolve(getCanvas(i)));
          if (native) {
            var b64 = cv.toDataURL('image/jpeg', 0.92).split(',')[1];
            var rr = await race(nativeOcr.recognize({ base64: b64 }));
            txt = rr && rr.text ? rr.text : '';
          } else {
            if (lanes === 1) ocr.onProgress = function (p) { status('read', '글자를 읽는 중… ' + label + (count > 1 ? ' ' + (i + 1) + '/' + count : '') + ' · ' + Math.round(p * 100) + '%'); setBar((i + p) / count); };
            txt = await readCanvas(worker, cv);
          }
        } catch (e) {
          if (e && (e.code === 'cancelled' || e.code === 'notess' || e.code === 'UNIMPLEMENTED')) { res[i]({ fatal: e }); nextI = count; for (var q = i + 1; q < count; q++) res[q]({ fatal: e }); return; }
          err = e || {};
        } finally { if (cv) { cv.width = 0; cv.height = 0; } }
        finished++;
        if (lanes > 1) setBar(finished / count);
        res[i]({ txt: txt, err: err });
      }
    }
    var running = workers.map(function (w) { return lane(w); });
    for (var i = 0; i < count; i++) {
      var r = await slots[i];
      if (r.fatal) throw r.fatal;
      if (r.err && !onPage) throw r.err;
      if (onPage) onPage(i, r.txt, r.err); else out.push(r.txt);
      if (lanes === 1) setBar((i + 1) / count);
    }
    await Promise.all(running);
    setBar(1);
    return out.join('\n\n');
  }

  /* ---------- 파일 인식: PDF ---------- */
  var pdfWorkerP = null;
  function pdfWorkerSrc() {
    if (!pdfWorkerP) {
      pdfWorkerP = (async function () {
        try {
          var code = await (await fetch(PDF_WORKER)).text();
          return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
        } catch (e) { return PDF_WORKER; }
      })();
    }
    return pdfWorkerP;
  }
  async function readPdf(file) {
    if (!window.pdfjsLib) {
      status('read', 'PDF 도구를 불러오는 중…');
      try { await loadScript(PDFJS_URL); } catch (e) { throw { code: 'nopdf' }; }
      if (!window.pdfjsLib) throw { code: 'nopdf' };
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = await pdfWorkerSrc();
    var pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    var pages = Math.min(pdf.numPages, 60), out = [];
    for (var p = 1; p <= pages; p++) {
      var page = await pdf.getPage(p);
      var tc = await page.getTextContent();
      out.push(tc.items.map(function (it) { return it.str + (it.hasEOL ? '\n' : ' '); }).join(''));
    }
    var text = out.join('\n\n').trim();
    if (text.length >= 30 * pages) return { text: text };
    var n = Math.min(pdf.numPages, 15);
    return { text: text, pdf: pdf, pages: n, truncated: pdf.numPages > n };
  }
  async function renderPdfPage(pdf, num) {
    var pg = await pdf.getPage(num);
    var v0 = pg.getViewport({ scale: 1 });
    var vp = pg.getViewport({ scale: Math.min(2, 1800 / Math.max(v0.width, v0.height)) });
    var cv = document.createElement('canvas');
    cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    var g = toGrayCanvas(cv, cv.width, cv.height);
    cv.width = 0; cv.height = 0;
    pg.cleanup();
    return g;
  }

  var reading = false, MAX_IMAGES = 50;
  function natural(a, b) { return String(a.name).localeCompare(String(b.name), 'ko', { numeric: true, sensitivity: 'base' }); }
  async function readFiles(files) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    if (reading) { status('read', '지금 읽는 중이에요. 끝나면 다시 올려 주세요.', true); return; }
    reading = true;
    newCancel();
    $('stopRow').hidden = false;
    var extra = [];
    try {
      var images = files.filter(function (f) { return f.type.indexOf('image/') === 0; }).sort(natural);
      var others = files.filter(function (f) { return f.type.indexOf('image/') !== 0; });
      if (images.length > MAX_IMAGES) { extra.push('사진은 한 번에 ' + MAX_IMAGES + '장까지 읽어요. 나머지 ' + (images.length - MAX_IMAGES) + '장은 다시 골라 주세요.'); images = images.slice(0, MAX_IMAGES); }
      if (images.length) {
        var okN = 0, empty = [], failed = [];
        if (images.length > 1) status('read', '사진 ' + images.length + '장을 이름순으로 차례대로 읽어요. 시간이 조금 걸려요.');
        await ocrPages(images.length, function (i) { return fileToCanvas(images[i]); }, '사진', function (i, text, err) {
          if (err) { failed.push(images[i].name); return; }
          if (!text || !text.trim()) { empty.push(images[i].name); return; }
          okN++; appendSource(text);
        });
        if (images.length > 1 || failed.length || empty.length) {
          extra.push('사진 ' + images.length + '장 중 ' + okN + '장을 읽었어요.');
          if (empty.length) extra.push('글자를 찾지 못한 사진: ' + empty.join(', '));
          if (failed.length) extra.push('열지 못한 사진: ' + failed.join(', '));
        }
      }
      for (var i = 0; i < others.length; i++) {
        var f = others[i], name = f.name.toLowerCase();
        if (name.slice(-4) === '.pdf' || f.type === 'application/pdf') {
          status('read', 'PDF를 읽는 중이에요…');
          var r = await race(readPdf(f));
          if (r.text) appendSource(r.text);
          if (r.pdf) {
            appendSource(await ocrPages(r.pages, function (i) { return renderPdfPage(r.pdf, i + 1); }, f.name));
            if (r.truncated) extra.push('스캔 PDF는 앞 15쪽만 읽었어요.');
          }
          continue;
        }
        if (/\.(txt|md)$/.test(name) || f.type.indexOf('text/') === 0) { appendSource(await f.text()); continue; }
        extra.push('‘' + f.name + '’은(는) 읽을 수 없는 형식이에요.');
      }
      status('read', ['글을 읽어 왔어요. 인식이 틀린 글자가 있을 수 있으니 위 칸에서 고쳐 주세요.'].concat(extra).join(' '));
    } catch (e) {
      var msg;
      if (e && e.code === 'cancelled') msg = '읽기를 멈췄어요. 지금까지 읽은 글은 위 칸에 남아 있어요.';
      else if (e && e.code === 'notess') msg = '글자 인식 도구를 불러오지 못했어요. 인터넷에 연결한 뒤 다시 해 주세요. 글 붙여넣기는 연결 없이도 돼요.';
      else if (e && e.code === 'nopdf') msg = 'PDF 읽기 도구를 불러오지 못했어요. 인터넷에 연결한 뒤 다시 해 주세요.';
      else if (e && e.code === 'UNIMPLEMENTED') msg = '이 앱에는 글자 인식 기능이 들어 있지 않아요. 빌드 설정을 확인해 주세요.';
      else msg = '파일을 읽지 못했어요. 다른 파일을 쓰거나 글을 붙여 넣어 주세요.';
      status('read', msg, true);
    } finally {
      reading = false;
      $('stopRow').hidden = true;
      setBar(null);
      ocr.onProgress = null;
    }
  }
  // 파일 고르는 창을 여는 순간 글자 인식 도구(작은 스크립트)를 미리 내려받아 두면 첫 읽기가 빨라요. (한글 데이터는 사진을 고른 뒤에 받아요)
  $('file').addEventListener('click', function () { if (!isNative() && !window.Tesseract) loadScript(TESS_URL).catch(function () { /* 나중에 다시 시도해요 */ }); }, { once: true });
  $('file').addEventListener('change', function (ev) {
    var files = Array.prototype.slice.call(ev.target.files || []);
    ev.target.value = '';
    readFiles(files);
  });
  // 끌어다 놓기, 붙여넣기(사진 복사)도 같은 방식으로 읽어요
  var dropZone = src.closest('.sec') || src;
  ['dragenter', 'dragover'].forEach(function (n) { dropZone.addEventListener(n, function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); dropZone.classList.add('dropping'); } }); });
  ['dragleave', 'drop'].forEach(function (n) { dropZone.addEventListener(n, function () { dropZone.classList.remove('dropping'); }); });
  dropZone.addEventListener('drop', function (e) {
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault(); readFiles(e.dataTransfer.files);
  });
  src.addEventListener('paste', function (e) {
    var fs = e.clipboardData && e.clipboardData.files;
    if (fs && fs.length) { e.preventDefault(); readFiles(fs); }
  });
  $('btnStopRead').addEventListener('click', stopOcr);

  /* ---------- 오늘의 공부 (D-day, 목표, 복습) ---------- */
  function renderHome() {
    var box = $('homeBox');
    if (!box) return;
    box.replaceChildren();
    var dd = ddays(), goal = Math.max(1, Number(prefs.goal) || 30), done = todayCount(), streak = studyStreak();
    var due = dueReviews().filter(function (x) { return typeOk(x.s.q); });
    if (a11y.easy) {
      due = due.filter(function (x) { return easyOk(x.s.q); });
      box.append(h('div', { class: 'easyhome' },
        h('b', { text: done ? '오늘 ' + done + '문제 풀었어요 ⭐' : '오늘도 같이 공부해요 😊' })));
      if (due.length) {
        box.append(h('div', { class: 'duebox' },
          h('div', {}, h('b', { text: '다시 풀어볼 문제가 ' + due.length + '개 있어요' })),
          h('button', { type: 'button', class: 'btn primary', id: 'btnDue', text: '다시 풀기', onclick: function () {
            startQuiz(due.slice(0, 10).map(function (x) { var c = JSON.parse(JSON.stringify(x.s.q)); c.review = true; return c; }), 'review');
          } })));
      }
      return;
    }
    var ddText = dd == null ? '시험일 미설정' : dd > 0 ? 'D-' + dd : dd === 0 ? 'D-DAY' : 'D+' + (-dd);
    box.append(h('div', { class: 'home-top' },
      h('div', {}, h('div', { class: 'dday', text: ddText }), h('div', { class: 'hint', text: prefs.examName || (dd == null ? '아래에서 시험 이름과 날짜를 정해 보세요' : '시험') })),
      h('div', { class: 'streak' }, h('b', { text: String(streak) }), h('span', { text: '일 연속 공부' }))));
    box.append(h('div', { class: 'goalrow' },
      h('span', { text: '오늘 ' + done + ' / ' + goal + '문제' }),
      h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.min(100, pct(done, goal)) + '%' }))));
    if (due.length) {
      box.append(h('div', { class: 'duebox' },
        h('div', {}, h('b', { text: '오늘 복습할 문제 ' + due.length + '개' }), h('div', { class: 'hint', text: '틀린 문제를 잊을 때쯤 다시 내요 (1·3·7·14일 간격)' })),
        h('button', { type: 'button', class: 'btn primary small', id: 'btnDue', text: '복습 시작', onclick: function () {
          startQuiz(due.slice(0, 20).map(function (x) { var c = JSON.parse(JSON.stringify(x.s.q)); c.review = true; return c; }), 'review');
        } })));
    }
    var setBox = h('details', { class: 'setbox' }, h('summary', { text: '시험·목표 설정' }));
    var nameI = h('input', { type: 'text', class: 'textin', maxlength: '30', placeholder: '시험 이름 (예: 중간고사 과학)', value: prefs.examName || '', 'aria-label': '시험 이름' });
    var dateI = h('input', { type: 'date', class: 'textin', value: prefs.examDate || '', 'aria-label': '시험 날짜' });
    var goalI = h('input', { type: 'number', class: 'textin', min: '5', max: '500', step: '5', value: String(goal), 'aria-label': '하루 목표 문제 수' });
    function sv() { prefs.examName = nameI.value.trim(); prefs.examDate = dateI.value; prefs.goal = Math.max(5, Math.min(500, Number(goalI.value) || 30)); savePrefs().then(renderHome); }
    [nameI, dateI, goalI].forEach(function (el) { el.addEventListener('change', sv); });
    setBox.append(h('div', { class: 'setgrid' },
      h('label', {}, h('span', { class: 'lbl', text: '시험 이름' }), nameI),
      h('label', {}, h('span', { class: 'lbl', text: '시험 날짜' }), dateI),
      h('label', {}, h('span', { class: 'lbl', text: '하루 목표(문제)' }), goalI)));
    if (!prefs.examDate && !prefs.examName) setBox.open = false;
    box.append(setBox);
  }

  /* ---------- 자료 보관함 ---------- */
  var matConfirm = null;
  function renderMaterials() {
    var box = $('matBox');
    if (!box) return;
    DB.all('materials').then(function (all) {
      var list = all.filter(function (m) { return m.uid === me.uid; }).sort(function (a, b) { return b.t - a.t; });
      box.replaceChildren();
      if (!list.length) { box.append(h('p', { class: 'hint', text: '저장한 자료가 없어요. 위 칸의 글을 ‘자료 저장’으로 보관해 두면 다음에 바로 불러와 다시 문제를 만들 수 있어요.' })); return; }
      box.append(h('div', { class: 'list' }, list.map(function (m) {
        return h('div', { class: 'mat' },
          h('div', { class: 'mt' }, h('b', { text: m.title }), h('span', { class: 'hint', text: fmtDate(m.t) + ' · ' + m.text.length.toLocaleString('ko-KR') + '자' })),
          h('div', { class: 'row tight' },
            h('button', { type: 'button', class: 'btn small', text: '불러오기', onclick: function () { setSrc(m.text, false); status('read', '‘' + m.title + '’을(를) 불러왔어요.'); src.scrollIntoView({ block: 'center', behavior: SB() }); } }),
            h('button', { type: 'button', class: matConfirm === m.id ? 'btn small danger' : 'btn small', text: matConfirm === m.id ? '정말 삭제' : '삭제', onclick: function () {
              if (matConfirm === m.id) { matConfirm = null; DB.del('materials', m.id).then(renderMaterials); }
              else { matConfirm = m.id; renderMaterials(); }
            } })));
      })));
    });
  }
  $('btnSaveMat').addEventListener('click', function () {
    var text = src.value.trim();
    if (text.length < 20) { status('read', '저장할 글이 너무 짧아요.', true); return; }
    var title = $('matTitle').value.trim() || text.replace(/\s+/g, ' ').slice(0, 14);
    DB.put('materials', { id: me.uid + '-' + Date.now().toString(36), uid: me.uid, title: title, text: text, t: Date.now() }).then(function () {
      $('matTitle').value = ''; status('read', '‘' + title + '’을(를) 보관함에 저장했어요.'); renderMaterials();
    });
  });

  /* ---------- 이름 ---------- */
  var nameIn = $('userName');
  nameIn.addEventListener('change', function () { saveName(nameIn.value).then(function () { nameIn.value = me.name; }); });

  /* ---------- 문제 수 / 유형 / 모드 ---------- */
  function opt(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; }
  function selectedTypes() { return Array.prototype.map.call(document.querySelectorAll('input[name="t"]:checked'), function (x) { return x.value; }); }
  // 문제 종류 지정: 고른 종류만 나와요. (쉬운 화면에서는 객관식·OX만 고를 수 있어요)
  var TYPE_LIST = [['mc', '객관식'], ['ox', 'OX'], ['short', '단답'], ['essay', '서술형'], ['pick', '문장 고르기'], ['match', '짝짓기'], ['order', '순서 맞추기']];
  function currentTypes() { var t = selectedTypes(); return a11y.easy ? t.filter(function (x) { return x !== 'short' && x !== 'essay'; }) : t; }
  function typeOk(q) { return currentTypes().indexOf(q.sub || q.type) >= 0; }
  function applyTypes() {
    if (!Array.isArray(prefs.types)) return;
    document.querySelectorAll('input[name="t"]').forEach(function (x) { x.checked = prefs.types.indexOf(x.value) >= 0; });
  }
  function noTypeMsg() { return '문제 종류를 하나 이상 골라 주세요.'; }
  // 오답·복습·별표 등으로 다시 푸는 문제도 고른 종류만 풀어요.
  function startPicked(list, source, o, max) {
    var f = list.filter(typeOk);
    if (max) f = f.slice(0, max);
    if (!f.length) { alert0('고른 종류에 맞는 문제가 없어요. ‘문제 종류’를 바꿔 보세요.'); return; }
    startQuiz(f, source, o);
  }
  var capTimer = null, capNow = 0;
  function scheduleCap() { clearTimeout(capTimer); capTimer = setTimeout(updateCap, 700); }
  function updateCap() {
    var text = src.value.trim(), types = currentTypes();
    var el = $('capHint');
    if (text.length < 40 || !types.length) { capNow = 0; el.textContent = ''; markChips(Infinity); return; }
    // 글이 짧으면 실제로 만들어 보고 세고, 아주 긴 글은 화면이 멈추지 않게 빠른 어림값을 써요
    capNow = text.length <= 30000 ? E.capacityFor(text, types, a11y.easy, banned) : E.capacity(text, types.length, a11y.easy);
    el.textContent = '이 자료로 만들 수 있는 문제는 최대 약 ' + capNow.toLocaleString('ko-KR') + '개예요. 더 많이 고르면 가능한 만큼만 만들고, ‘최대’를 고르면 만들 수 있는 만큼 모두 만들어요. 그보다 큰 개수는 눌러지지 않아요.';
    markChips(capNow);
  }
  function markChips(cap) {
    // 만들 수 있는 개수보다 큰 칩은 누를 수 없게 막아요. 이미 골라 둔 칩이 막히면 가능한 가장 큰 칩(없으면 ‘최대’)으로 바꿔요.
    var radios = Array.prototype.slice.call(document.querySelectorAll('input[name="n"]')), best = null, maxR = null;
    radios.forEach(function (r) {
      var over = r.value !== 'max' && Number(r.value) > cap;
      r.disabled = over;
      r.parentElement.classList.toggle('over', over);
      if (r.value === 'max') maxR = r; else if (!over) best = r;
    });
    var cur = radios.filter(function (r) { return r.checked; })[0];
    if (cur && cur.disabled) { var to = best || maxR; if (to) to.checked = true; }
  }
  document.querySelectorAll('input[name="t"]').forEach(function (x) { x.addEventListener('change', function () { prefs.types = selectedTypes(); savePrefs(); updateCap(); renderHome(); }); });
  // 문제 제한시간: 없음 / 30초 / 1분 / 3분 (기본 없음). 고른 값은 이 기기에 기억해요.
  function currentTl() { return Number(opt('tl')) || 0; }
  function applyTl() {
    var v = String(Number(prefs.tl) || 0), el = document.querySelector('input[name="tl"][value="' + v + '"]');
    if (!el) el = document.querySelector('input[name="tl"][value="0"]');
    if (el) el.checked = true;
  }
  document.querySelectorAll('input[name="tl"]').forEach(function (x) { x.addEventListener('change', function () { prefs.tl = currentTl(); savePrefs(); }); });

  /* ---------- 관리자 진입: '관리자' 입력 후 문제 만들기 3번 연속 ---------- */
  var tap = { n: 0, t: 0 };
  function adminTap() {
    if (src.value.trim() !== '관리자') { tap.n = 0; return false; }
    var now = Date.now();
    tap.n = now - tap.t < 3000 ? tap.n + 1 : 1;
    tap.t = now;
    if (tap.n >= 3) { tap.n = 0; openPin(); return true; }
    return false;
  }
  ['input', 'change'].forEach(function (ev) { src.addEventListener(ev, function () { if (src.value.trim() !== '관리자') tap.n = 0; }); });
  document.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('#btnMake')) tap.n = 0; }, true);

  var pinFails = 0, pinLockUntil = 0;
  function sha256hex(s) {
    if (!(window.crypto && crypto.subtle && crypto.subtle.digest)) return Promise.resolve(null);
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }).catch(function () { return null; });
  }
  function openPin() {
    $('pinMsg').textContent = ''; $('pinIn').value = '';
    $('pinOverlay').hidden = false;
    setTimeout(function () { $('pinIn').focus(); }, 30);
  }
  function closePin() { $('pinOverlay').hidden = true; }
  async function tryPin() {
    var msg = $('pinMsg');
    if (Date.now() < pinLockUntil) { msg.textContent = Math.ceil((pinLockUntil - Date.now()) / 1000) + '초 뒤에 다시 해 주세요.'; return; }
    var pin = $('pinIn').value.trim();
    if (!pin) return;
    var hex = await sha256hex('quiznote:' + pin);
    var ok = hex ? hex === PIN_SHA : E.hash('quiznote:' + pin) === PIN_FALLBACK;
    if (ok) {
      pinFails = 0; adminOn = true;
      try { sessionStorage.setItem('qn.admin', '1'); } catch (e) { /* ignore */ }
      closePin(); setSrc(EXAMPLE, true); updateAdminTab(); go('admin');
      return;
    }
    pinFails++;
    $('pinIn').value = '';
    if (pinFails >= 5) { pinLockUntil = Date.now() + 30000; pinFails = 0; msg.textContent = '5번 틀렸어요. 30초 뒤에 다시 해 주세요.'; }
    else msg.textContent = '번호가 맞지 않아요. (' + pinFails + '/5)';
  }
  $('pinOk').addEventListener('click', tryPin);
  $('pinCancel').addEventListener('click', closePin);
  $('pinIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryPin(); if (e.key === 'Escape') closePin(); });
  $('pinOverlay').addEventListener('click', function (e) { if (e.target === $('pinOverlay')) closePin(); });

  /* ---------- 문제 만들기 ---------- */
  var pending = null;
  $('btnMake').addEventListener('click', function () {
    if (adminTap()) return;
    var text = src.value.trim();
    var n = wantCount(10), types = currentTypes(), mode = 'new';
    $('understandSec').hidden = true; pending = null;
    if (!me.name.trim()) { status('gen', '이름(닉네임)을 먼저 적어 주세요. 기록을 이름으로 모아요.', true); nameIn.focus(); return; }
    if (text.length < 40) { status('gen', '자료가 너무 짧아요. 문장이 3개 이상 되도록 글을 넣어 주세요.', true); return; }
    if (!types.length) { status('gen', noTypeMsg(), true); return; }

    $('btnMake').disabled = true;
    status('gen', '문제를 만드는 중이에요…');
    setTimeout(function () {
      try { makeQuestions(text, n, types, mode); }
      catch (e) { status('gen', '문제를 만들다 오류가 났어요. 자료를 줄여서 다시 해 보세요.', true); }
      finally { $('btnMake').disabled = false; }
    }, 30);
  });

  // 예시 글(바리스타)로 기본 문제를 미리 만들어 둬요. 시작하자마자 ‘풀어보기’만 누르면 돼요.
  function autoMake(scroll) {
    try {
      var types = currentTypes();
      if (!types.length) types = ['mc', 'ox'];
      var n = wantCount(5);
      makeQuestions(src.value.trim(), n, types, 'new', !scroll);
      if (pending) status('gen', pending.questions.length + '문제를 미리 만들어 뒀어요. ‘풀어보기’를 눌러 보세요.');
    } catch (e) { /* 직접 ‘문제 만들기’를 누르면 돼요 */ }
  }

  // 문제 개수: 숫자 칩, 또는 ‘최대’(이 자료로 만들 수 있는 만큼 전부)
  function wantCount(dflt) { var v = opt('n'); return v === 'max' ? E.MAX_COUNT : (Number(v) || dflt); }
  function makeQuestions(text, n, types, mode, quiet) {
    // 새 문제만 만들어요. (예전에 틀린 문제를 섞거나 많이 틀린 단어를 먼저 고르는 기능은 뺐어요)
    var out = E.generate(text, { count: Math.max(1, n), types: types, seed: (Date.now() % 1000003), easy: a11y.easy, trickEvery: effTrick(), exclude: banned });
    var list = out.questions;
    var srcId = 'm' + E.hash(text), srcT = text.replace(/\s+/g, ' ').trim().slice(0, 24);
    list.forEach(function (q) { q.src = srcId; q.srcT = srcT; });
    if (!list.length) { status('gen', '문제로 만들 문장을 찾지 못했어요. 14자 이상인 문장이 더 필요해요.', true); return; }
    var extra = '';
    var isMax = n >= E.MAX_COUNT;
    if (isMax) extra = ' (이 자료로 만들 수 있는 만큼 모두 만들었어요)';
    else if (list.length < n) extra = ' (이 자료로는 ' + list.length + '개까지만 나와요. 글을 더 넣으면 늘어나요)';
    status('gen', list.length + '문제를 만들었어요.' + extra);
    pending = { questions: list, concepts: out.concepts, keySentences: out.keySentences, definitions: out.definitions, cards: out.cards, mode: mode };
    renderUnderstand(quiet);
  }

  function renderUnderstand(quiet) {
    var box = $('understand');
    box.replaceChildren();
    if (pending.concepts.length) {
      box.append(h('div', { class: 'hint', text: '핵심 개념' }),
        h('div', { class: 'chips' }, pending.concepts.slice(0, 10).map(function (c) { return h('span', { class: 'chip', text: c.term }); })));
    }
    if (pending.keySentences.length) {
      box.append(h('div', { class: 'hint', text: '문제가 많이 나오는 핵심 문장' }),
        h('ul', { class: 'keys' }, pending.keySentences.map(function (s) { return h('li', { text: s }); })));
    }
    if (pending.definitions && pending.definitions.length) {
      box.append(h('div', { class: 'hint', text: '용어 정리' }),
        h('ul', { class: 'keys' }, pending.definitions.slice(0, 8).map(function (d) { return h('li', {}, h('b', { text: d.term }), ' — ' + d.sentence); })));
    }
    var kinds = {};
    pending.questions.forEach(function (q) { var kk = q.sub || q.type; kinds[kk] = (kinds[kk] || 0) + 1; });
    box.append(h('p', { class: 'hint', text: '만든 문제 ' + pending.questions.length + '개: ' + Object.keys(kinds).map(function (k) { return E.KIND_NAME[k] + ' ' + kinds[k]; }).join(', ') }));
    Array.prototype.slice.call(box.children, 0, -1).forEach(function (c) { c.classList.add('adv'); });
    $('understandSec').hidden = false;
    if (!quiet) $('understandSec').scrollIntoView({ block: 'nearest', behavior: SB() });
  }
  $('btnStart').addEventListener('click', function () {
    if (!pending) return;
    startQuiz(pending.questions, 'make', { exam: !a11y.easy && opt('play') === 'exam' });
  });
  armConfirm($('btnDrop'), '정말 지울까요?', function () {
    pending = null; $('understandSec').hidden = true;
    status('gen', '만든 문제를 지웠어요. 다시 만들려면 ‘문제 만들기’를 눌러요.');
  });
  $('btnCards').addEventListener('click', function () {
    if (!pending || !pending.cards || !pending.cards.length) { status('gen', '암기카드로 만들 용어가 부족해요.', true); return; }
    startCards(pending.cards);
  });

  /* ---------- 이어 풀기 ---------- */
  function renderResume() {
    var box = $('resumeBox');
    box.replaceChildren();
    var s = openSession();
    if (!s) { box.hidden = true; return; }
    box.hidden = false;
    box.append(
      h('div', { class: 'rtxt' }, h('b', { text: s.exam ? '풀던 모의시험이 있어요' : '풀던 문제가 있어요' }), h('span', { text: ' ' + progressOf(s) + ' / ' + s.count + ' · ' + fmtDate(s.tUpdated || s.t) })),
      h('button', { type: 'button', class: 'btn primary small', text: '이어 풀기', onclick: function () { resumeSession(s); } }),
      confirmBtn('지우기', '정말 지울까요?', function () { deleteSession(s); }));
  }
  function deleteSession(s) {
    sessionsCache = sessionsCache.filter(function (x) { return x.id !== s.id; });
    DB.del('sessions', s.id).catch(function () { /* ignore */ });
    DB.del('lists', s.id).catch(function () { /* ignore */ });
    renderResume();
    if (!$('view-history').hidden) renderHistory();
    if (!$('view-solve').hidden && Q.sid !== s.id) renderSolveEmpty();
    alert0('풀던 기록과 문제 목록을 지웠어요.');
  }
  function openSession() { return sessionsCache.filter(function (x) { return !x.done && progressOf(x) < x.count; })[0]; }
  function progressOf(s) { return s.exam ? Object.keys(s.exam.answers || {}).length : s.results.length; }
  function resumeSession(s) {
    DB.get('lists', s.id).then(function (rec) {
      if (!rec || !rec.list) { alert0('이 문제 목록을 찾을 수 없어요.'); return; }
      Q = { sid: s.id, t0: s.t, list: rec.list, listSaved: true, i: s.exam ? (s.exam.cur || 0) : s.results.length, results: s.results.slice(), source: s.source, answered: false, exam: s.exam || null, tl: s.tl || 0 };
      go('solve'); if (Q.exam) renderExam(); else renderQ();
    });
  }

  /* ---------- 풀기 ---------- */
  var Q = { sid: '', list: [], i: 0, results: [], source: 'make', answered: false };
  function startQuiz(list, source, o) {
    o = o || {};
    var now = Date.now();
    var perQ = o.perQ != null ? o.perQ : currentTl();
    var ex = o.exam ? { perQ: perQ, deadline: perQ ? now + perQ * list.length * 1000 : 0, answers: {}, flags: {}, cur: 0 } : null;
    Q = { sid: me.uid + '-' + now.toString(36), t0: now, list: list, i: 0, results: [], source: source, answered: false, exam: ex, tl: o.exam ? 0 : perQ };
    saveSession(false);
    go('solve');
    if (ex) renderExam(); else renderQ();
  }
  // 문제 목록(크다)은 처음에 한 번만 저장하고, 답할 때마다는 작은 진행 기록만 저장해요.
  function saveSession(done) {
    var s = { id: Q.sid, uid: me.uid, name: me.name, t: Q.t0, tUpdated: Date.now(), source: Q.source, count: Q.list.length, results: Q.results, done: !!done, exam: Q.exam || null, tl: Q.tl || 0 };
    if (Q.source === 'make' && Q.list[0] && Q.list[0].src) { s.src = Q.list[0].src; s.srcT = Q.list[0].srcT || ''; }
    var idx = sessionsCache.findIndex(function (x) { return x.id === s.id; });
    if (idx >= 0) sessionsCache[idx] = s; else sessionsCache.unshift(s);
    var ops = [];
    if (!Q.listSaved) { Q.listSaved = true; ops.push(DB.put('lists', { id: Q.sid, list: Q.list })); }
    ops.push(DB.put('sessions', s));
    return Promise.all(ops).catch(function () { /* 저장 실패해도 풀이는 계속돼요 */ });
  }
  function renderSolveEmpty() {
    var s = openSession();
    $('solveBody').replaceChildren(h('div', { class: 'empty' },
      h('p', { text: '풀 문제가 아직 없어요.' }),
      h('p', { class: 'hint', text: '만들기에서 자료를 넣고 문제를 만들면 여기서 풀 수 있어요.' }),
      h('div', { class: 'row center' },
        s ? h('button', { type: 'button', class: 'btn primary', text: (s.exam ? '풀던 모의시험 이어 풀기 (' : '풀던 문제 이어 풀기 (') + progressOf(s) + '/' + s.count + ')', onclick: function () { resumeSession(s); } }) : null,
        h('button', { type: 'button', class: s ? 'btn' : 'btn primary', text: '만들기로 가기', onclick: function () { go('make'); } }))));
  }
  function withBlanks(text) {
    var parts = String(text).split('____');
    var frag = document.createDocumentFragment();
    parts.forEach(function (p, i) {
      frag.append(document.createTextNode(p));
      if (i < parts.length - 1) frag.append(h('span', { class: 'blank', text: '    ' }));
    });
    return frag;
  }
  function answerLabel(q) {
    if (q.type === 'mc') return CIRC[q.answer] + ' ' + q.choices[q.answer];
    if (q.type === 'ox') return q.answer ? 'O' : 'X';
    if (q.type === 'essay') return q.model || q.answer;
    if (q.type === 'order') return q.answer.map(function (j, p) { return CIRC[p] + ' ' + q.items[j]; }).join('  ');
    if (q.type === 'match') return q.items.map(function (t, i) { return t + ' = ' + LET[q.answer[i]] + '. ' + q.options[q.answer[i]]; }).join(' / ');
    return q.answer;
  }
  function givenLabel(q, g) {
    if (g == null) return '무응답';
    if (q.type === 'mc') return q.choices[g] != null ? CIRC[g] + ' ' + q.choices[g] : String(g);
    if (q.type === 'ox') return g ? 'O' : 'X';
    if (q.type === 'order' && Array.isArray(g)) return g.map(function (j, p) { return CIRC[p] + ' ' + q.items[j]; }).join('  ');
    if (q.type === 'match' && Array.isArray(g)) return g.map(function (v, i) { return q.items[i] + ' = ' + (v >= 0 ? LET[v] : '-'); }).join(', ');
    return String(g);
  }

  // 순서 맞추기·짝짓기 화면 부품. 풀기와 모의시험이 같이 써요. onChange(값)은 다 골랐을 때만 값을, 아니면 null을 줘요.
  function isRight(q, g) {
    if (g == null) return false;
    if (q.type === 'short') return E.checkShort(g, q);
    if (q.type === 'essay') return E.essayGrade(g, q).ok;
    if (q.type === 'order' || q.type === 'match') return E.sameArr(g, q.answer);
    return g === q.answer;
  }
  function orderWidget(q, init, onChange) {
    var picked = Array.isArray(init) ? init.slice() : [], locked = false;
    var el = h('div', { class: 'ordering' }), pool = h('div', { class: 'ord-pool' }), mine = h('div', { class: 'ord-mine' });
    var undo = h('button', { type: 'button', class: 'btn small', text: '↶ 하나 취소', onclick: function () { picked.pop(); paint(); emit(); } });
    function get() { return picked.length === q.items.length ? picked.slice() : null; }
    function emit() { if (onChange) onChange(get()); }
    function paint() {
      pool.replaceChildren(); mine.replaceChildren();
      q.items.forEach(function (t, i) {
        var used = picked.indexOf(i) >= 0;
        pool.append(h('button', { type: 'button', class: 'choice ord-item' + (used ? ' used' : ''), disabled: used || locked, onclick: function () { picked.push(i); paint(); emit(); } }, h('span', { class: 'ct', text: t })));
      });
      picked.forEach(function (i, n) { mine.append(h('div', { class: 'ord-pick' }, h('span', { class: 'bub', text: CIRC[n] }), h('span', { text: q.items[i] }))); });
      if (!picked.length) mine.append(h('p', { class: 'hint', text: '위 문장을 먼저 나온 순서대로 눌러 주세요.' }));
      undo.disabled = locked || !picked.length;
    }
    el.append(h('div', { class: 'hint', text: '문장 (누르면 아래로 내려가요)' }), pool, h('div', { class: 'hint', text: '내가 놓은 순서' }), mine, h('div', { class: 'row' }, undo));
    paint();
    return { el: el, get: get, reveal: function () { locked = true; paint(); } };
  }
  function matchWidget(q, init, onChange) {
    var sel = q.items.map(function (_, i) { return Array.isArray(init) && init[i] != null ? init[i] : -1; }), selects = [], rows = [];
    var el = h('div', { class: 'matching' });
    function get() { return sel.every(function (v) { return v >= 0; }) ? sel.slice() : null; }
    el.append(h('div', { class: 'hint', text: '설명' }), h('div', { class: 'mt-opts' }, q.options.map(function (o, i) { return h('div', { class: 'mt-opt' }, h('b', { text: LET[i] + '. ' }), o); })),
      h('div', { class: 'hint', text: '용어에 맞는 설명의 글자를 골라 주세요' }));
    q.items.forEach(function (term, i) {
      var sl = h('select', { 'aria-label': term + '의 설명 고르기' }, h('option', { value: '-1', text: '고르기' }), q.options.map(function (_, k) { return h('option', { value: String(k), text: LET[k] }); }));
      sl.value = String(sel[i]);
      sl.addEventListener('change', function () { sel[i] = Number(sl.value); if (onChange) onChange(get()); });
      var row = h('div', { class: 'mt-row' }, h('span', { class: 'mt-term', text: term }), sl);
      selects.push(sl); rows.push(row); el.append(row);
    });
    return { el: el, get: get, reveal: function () {
      selects.forEach(function (x) { x.disabled = true; });
      rows.forEach(function (r, i) { r.classList.add(sel[i] === q.answer[i] ? 'ok' : 'bad'); });
    } };
  }

  function starBtn(q) {
    var b = h('button', { type: 'button', class: 'btn small star', 'aria-pressed': stars[q.k] ? 'true' : 'false', text: stars[q.k] ? '★ 별표' : '☆ 별표' });
    b.addEventListener('click', function () {
      if (stars[q.k]) delete stars[q.k]; else stars[q.k] = JSON.parse(JSON.stringify(q));
      saveStars();
      b.textContent = stars[q.k] ? '★ 별표' : '☆ 별표';
      b.setAttribute('aria-pressed', stars[q.k] ? 'true' : 'false');
    });
    return b;
  }

  // 풀던 문제 중 마음에 안 드는 문제를 지워요. 푸는 목록, 별표, 오답노트에서 빠지고 같은 글로 다시 만들어도 나오지 않아요.
  function delBtn(q) {
    var b = confirmBtn('🗑 삭제', '정말 삭제?', function () {
      if (Q.answered || Q.list[Q.i] !== q) return;
      stopTimer();
      banQ(q);
      Q.list.splice(Q.i, 1);
      if (!Q.list.length && !Q.results.length) {
        sessionsCache = sessionsCache.filter(function (x) { return x.id !== Q.sid; });
        DB.del('sessions', Q.sid).catch(function () { /* ignore */ });
        DB.del('lists', Q.sid).catch(function () { /* ignore */ });
        alert0('문제를 지웠어요. 남은 문제가 없어요.');
        go('make'); return;
      }
      Q.listSaved = true;
      DB.put('lists', { id: Q.sid, list: Q.list }).catch(function () { /* ignore */ });
      saveSession(false);
      alert0('문제를 지웠어요. 같은 글로 다시 만들어도 나오지 않아요.');
      renderQ();
    }, 'delq');
    b.setAttribute('aria-label', '이 문제 삭제');
    return b;
  }

  function renderQ() {
    stopTimer();
    var root = $('solveBody');
    root.replaceChildren();
    if (Q.i >= Q.list.length) return renderResult();
    var q = Q.list[Q.i];
    Q.answered = false;
    var p = Math.round((Q.i / Q.list.length) * 100);
    var card = h('div', { class: 'qcard' });
    card.append(h('div', { class: 'qmeta' }, h('span', { class: 'kind', text: kindLabel(q) }), q.review ? h('span', { class: 'kind alt', text: '복습' }) : null, q.my ? h('span', { class: 'kind alt', text: '내 문제' }) : null, readBtn(function () { return qSpeech(q); }), starBtn(q), q.my ? null : delBtn(q)));
    if (q.passage) card.append(h('div', { class: 'passage' }, withBlanks(q.passage)));
    card.append(h('p', { class: 'qtext', text: q.q }));

    var area = h('div', {});
    Q.widget = null;
    if (q.type === 'order' || q.type === 'match') {
      var w = q.type === 'order' ? orderWidget(q, null, null) : matchWidget(q, null, null);
      Q.widget = w; area = w.el;
      area.append(h('button', { type: 'button', class: 'btn primary', text: '확인', onclick: function () { var g = w.get(); if (g) submit(q, g); else alert0(q.type === 'order' ? '문장을 모두 놓은 뒤에 눌러 주세요.' : '모든 용어에 설명을 고른 뒤에 눌러 주세요.'); } }));
    } else if (q.type === 'mc') {
      area.className = 'choices';
      q.choices.forEach(function (c, k) {
        area.append(h('button', { type: 'button', class: 'choice', 'data-k': k, onclick: function () { submit(q, k); } },
          h('span', { class: 'bub', text: CIRC[k] }), h('span', { class: 'ct', text: c })));
      });
    } else if (q.type === 'ox') {
      area.className = 'oxrow';
      area.append(
        h('button', { type: 'button', class: 'choice', 'data-k': 'O', 'aria-label': 'O 맞다', text: 'O', onclick: function () { submit(q, true); } }),
        h('button', { type: 'button', class: 'choice', 'data-k': 'X', 'aria-label': 'X 틀리다', text: 'X', onclick: function () { submit(q, false); } }));
    } else if (q.type === 'essay') {
      area.className = 'essay';
      var ta = h('textarea', { id: 'essayIn', rows: '5', maxlength: '1000', placeholder: '본문 내용을 떠올려서 내 말로 써 보세요.', 'aria-label': '서술형 답 쓰기' });
      var sendE = h('button', { type: 'button', class: 'btn primary', text: '답 제출', onclick: function () { if (ta.value.trim()) submitEssay(q, ta.value.trim(), false); else ta.focus(); } });
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && ta.value.trim()) submitEssay(q, ta.value.trim(), false); });
      area.append(ta, sendE);
    } else {
      area.className = 'short';
      var inp = h('input', { type: 'text', id: 'shortIn', autocomplete: 'off', placeholder: q.hint ? '정답 (' + q.hint + ')' : '정답', 'aria-label': '정답 입력' });
      var ok = h('button', { type: 'button', class: 'btn primary', text: '확인', onclick: function () { if (inp.value.trim()) submit(q, inp.value.trim()); } });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && inp.value.trim()) submit(q, inp.value.trim()); });
      area.append(inp, ok);
    }
    card.append(area, h('div', { id: 'fbSlot' }));

    root.append(
      h('div', { class: 'prog' }, h('span', { text: '문제 ' + (Q.i + 1) + ' / ' + Q.list.length }), h('div', { class: 'bar' }, h('i', { style: 'width:' + p + '%' })), Q.tl ? h('span', { class: 'timer', id: 'qTimer', role: 'timer' }) : null),
      card);
    if (Q.tl) startQTimer(q);
    var first = area.querySelector('input,textarea');
    if (first) first.focus({ preventScroll: true });
    if (a11y.read) speak(qSpeech(q));
  }

  function makeAttempt(q, i, ok, given, t) {
    return { id: Q.sid + '.' + i, uid: me.uid, name: me.name, sid: Q.sid, n: i, t: t, k: q.k, type: q.type, target: q.target || '', ok: ok, given: given, trick: !!q.trick, q: ok ? null : JSON.parse(JSON.stringify(q)) };
  }

  // 문제마다 시간이 흘러요. 시간이 다 되면 그 문제는 틀린 것으로 하고 정답을 보여줘요. (다음 문제로는 직접 눌러서 가요)
  function startQTimer(q) {
    var end = Date.now() + Q.tl * 1000, sid = Q.sid, idx = Q.i;
    var tick = function () {
      if (Q.sid !== sid || Q.i !== idx || Q.answered) { stopTimer(); return; }
      var left = Math.ceil((end - Date.now()) / 1000), el = $('qTimer');
      if (el) { el.textContent = '남은 시간 ' + fmtClock(left); el.classList.toggle('warn', left <= 10); }
      if (left <= 0) { stopTimer(); timeUp(q); }
    };
    tick(); examTimer = setInterval(tick, 250);
  }
  function timeUp(q) {
    if (Q.answered) return;
    if (q.type === 'essay') { var ta = $('essayIn'); submitEssay(q, ta && ta.value.trim() ? ta.value.trim() : null, true); return; }
    var inp = $('shortIn'), given = q.type === 'short' && inp && inp.value.trim() ? inp.value.trim() : null;
    if (Q.widget) given = Q.widget.get();
    submit(q, given, true);
  }
  // 서술형: 내 답에 핵심어가 들어간 비율로 자동 채점해요. (뜻을 이해해서 채점하는 게 아니라 단어 포함 여부만 봐요)
  //  75% 이상 '정답이에요!' · 60% 이상 '비슷해요.'(여기까지 정답 처리) · 40% 이상 '조금 달라요' · 그 미만 '괜찮아요, 다시 봐요'(오답 처리)
  //  75% 미만이면 모범답안을 꼭 보여줘요.
  var ESSAY_MSG = { full: '정답이에요!', close: '비슷해요.', partial: '조금 달라요', low: '괜찮아요, 다시 봐요' };
  function recordEssay(q, ok, given) {
    Q.answered = true;
    Q.results.push({ idx: Q.i, ok: ok, given: given });
    var rec = makeAttempt(q, Q.i, ok, given, Date.now());
    addAttempt(rec);
    DB.put('attempts', rec).catch(function () { /* ignore */ });
    saveSession(Q.i + 1 >= Q.list.length);
    updateBadge();
  }
  function submitEssay(q, text, timedOut) {
    if (Q.answered || Q.essayShown === Q.i + ':' + Q.sid) return;
    Q.essayShown = Q.i + ':' + Q.sid;
    stopTimer();
    var easy = a11y.easy, last = Q.i + 1 >= Q.list.length;
    var ta = $('essayIn'); if (ta) ta.disabled = true;
    document.querySelectorAll('.essay .btn').forEach(function (b) { b.disabled = true; });
    var g = text ? E.essayGrade(text, q) : E.essayGrade('', q);
    var ok = !timedOut && g.ok;
    recordEssay(q, ok, text);
    var body = [], model = q.model || q.answer;
    body.push(h('p', { class: 'mine' }, '내 답  ', h('span', { text: text || '(쓰지 못했어요)' })));
    if (g.total) {
      body.push(h('p', { class: 'hint', text: '핵심어 ' + g.hit.length + ' / ' + g.total + '개 (' + g.pct + '%)가 내 답에 들어 있어요.' + (timedOut ? ' 시간이 지나서 틀린 것으로 쳤어요.' : '') }));
      body.push(h('div', { class: 'chips kw' }, (q.keywords || []).map(function (k) { var yes = g.hit.indexOf(k) >= 0; return h('span', { class: 'chip ' + (yes ? 'hit' : 'miss'), text: (yes ? '✓ ' : '✗ ') + k }); })));
    }
    if (g.level === 'full' && !timedOut) body.push(h('details', {}, h('summary', { text: '모범답안 보기' }), h('div', { class: 'quote' }, model)));
    else body.push(h('div', { class: 'quote' }, h('b', { text: '모범답안' }), model));
    if (q.explain && !easy && !ok) body.push(h('p', { text: q.explain }));
    if (a11y.read) speak((timedOut ? '시간이 다 됐어요. ' : ESSAY_MSG[g.level] + ' ') + (g.level === 'full' && !timedOut ? '' : '모범답안은 ' + model));
    var title = timedOut ? (easy ? '시간이 다 됐어요. 같이 봐요' : '시간이 지났어요') : ESSAY_MSG[g.level];
    var fb = h('div', { class: 'fb ' + (ok ? 'ok' : (easy ? 'soft' : 'bad')), role: 'status' }, h('h3', { text: title }), body,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', id: 'btnNext', text: last ? '결과 보기' : '다음 문제', onclick: function () { Q.i++; renderQ(); window.scrollTo(0, 0); } })));
    $('fbSlot').append(fb);
    $('btnNext').focus({ preventScroll: true });
    fb.scrollIntoView({ block: 'nearest', behavior: SB() });
  }
  function submit(q, given, timedOut) {
    if (Q.answered) return;
    Q.answered = true;
    stopTimer();
    var ok = isRight(q, given);
    Q.results.push({ idx: Q.i, ok: ok, given: given });
    var now = Date.now();
    var rec = makeAttempt(q, Q.i, ok, given, now);
    addAttempt(rec);
    DB.put('attempts', rec).catch(function () { /* ignore */ });
    saveSession(Q.i + 1 >= Q.list.length);
    updateBadge();

    var area = $('solveBody').querySelector('.choices,.oxrow,.short,.ordering,.matching');
    if (q.type === 'mc') {
      area.querySelectorAll('.choice').forEach(function (b) {
        var k = Number(b.dataset.k);
        b.disabled = true;
        if (k === q.answer) b.classList.add('correct'); else if (k === given) b.classList.add('wrong');
      });
    } else if (q.type === 'ox') {
      area.querySelectorAll('.choice').forEach(function (b) {
        var v = b.dataset.k === 'O';
        b.disabled = true;
        if (v === q.answer) b.classList.add('correct'); else if (v === given) b.classList.add('wrong');
      });
    } else {
      area.querySelectorAll('input,button,select').forEach(function (x) { x.disabled = true; });
      if (Q.widget) Q.widget.reveal();
    }

    var body = [], easy = a11y.easy;
    if (!easy && q.type === 'mc' && !ok && given != null) {
      var f = (q.feedback && q.feedback[given]) || '';
      if (f) body.push(h('p', { text: f }));
    }
    if (!ok) body.push(h('p', {}, '정답은 ', h('b', { text: answerLabel(q) }), easy ? ' 이에요.' : ''));
    if (!easy && q.explain && !(q.type === 'short' && ok)) body.push(h('p', { text: q.explain }));
    if (q.evidence && (!ok || !easy)) body.push(h('div', { class: 'quote' }, h('b', { text: easy ? '책에는 이렇게 나와요' : '본문 근거' }), q.evidence));
    var last = Q.i + 1 >= Q.list.length;
    if (a11y.read) speak(ok ? '맞았어요. 잘했어요.' : (timedOut ? '시간이 다 됐어요. ' : '괜찮아요. ') + '정답은 ' + (q.type === 'mc' ? q.choices[q.answer] : q.type === 'ox' ? (q.answer ? '오' : '엑스') : Array.isArray(q.answer) ? answerLabel(q) : q.answer) + ' 이에요.');
    var fb = h('div', { class: 'fb ' + (ok ? 'ok' : (easy ? 'soft' : 'bad')), role: 'status' },
      h('h3', { text: ok ? (easy ? '맞았어요! 잘했어요 👏' : '정답이에요') : timedOut ? (easy ? '시간이 다 됐어요. 같이 봐요' : '시간이 지났어요') : (easy ? '괜찮아요. 같이 봐요' : '틀렸어요') }), body,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', id: 'btnNext', text: last ? (easy ? '끝! 결과 보기' : '결과 보기') : (easy ? '다음' : '다음 문제'), onclick: function () { Q.i++; renderQ(); window.scrollTo(0, 0); } })));
    $('fbSlot').append(fb);
    $('btnNext').focus({ preventScroll: true });
    fb.scrollIntoView({ block: 'nearest', behavior: SB() });
  }

  /* ---------- 모의시험 ---------- */
  var examTimer = null, examSaveT = null;
  function stopTimer() { if (examTimer) { clearInterval(examTimer); examTimer = null; } }
  function fmtClock(sec) { sec = Math.max(0, sec); var m = Math.floor(sec / 60), r = sec % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }
  function saveExamSoon() { clearTimeout(examSaveT); examSaveT = setTimeout(function () { if (Q.exam) { Q.exam.cur = Q.i; saveSession(false); } }, 400); }
  function examHas(i) { return Object.prototype.hasOwnProperty.call(Q.exam.answers, i); }
  function gridCls(i) { return 'qn' + (examHas(i) ? ' done' : '') + (Q.exam.flags[i] ? ' flag' : '') + (i === Q.i ? ' cur' : ''); }
  function buildGrid() {
    return h('div', { class: 'qgrid', id: 'qgrid' }, Q.list.map(function (_, i) {
      return h('button', { type: 'button', class: gridCls(i), text: String(i + 1), 'aria-label': (i + 1) + '번 문제', onclick: function () { Q.i = i; saveExamSoon(); renderExam(); window.scrollTo(0, 0); } });
    }));
  }
  function refreshExamBits() {
    var g = $('qgrid');   // 번호판은 새로 만들지 않고 바뀐 칸의 색만 고쳐요
    if (g) for (var i = 0; i < g.children.length; i++) { var c = gridCls(i); if (g.children[i].className !== c) g.children[i].className = c; }
    var a = $('examAns'); if (a) a.textContent = '답한 문제 ' + Object.keys(Q.exam.answers).length + ' / ' + Q.list.length;
  }
  function setAns(i, val) { Q.exam.answers[i] = val; saveExamSoon(); refreshExamBits(); }

  function renderExam() {
    stopTimer();
    var root = $('solveBody');
    root.replaceChildren();
    var ex = Q.exam, q = Q.list[Q.i], n = Q.list.length;
    var timerEl = ex.deadline ? h('span', { class: 'timer', id: 'examTimer' }) : null;
    root.append(h('div', { class: 'prog exam' }, h('span', { text: '모의시험 ' + (Q.i + 1) + ' / ' + n }), h('span', { class: 'ans', id: 'examAns' }), timerEl));
    var card = h('div', { class: 'qcard' });
    card.append(h('div', { class: 'qmeta' }, h('span', { class: 'kind', text: kindLabel(q) }), q.review ? h('span', { class: 'kind alt', text: '복습' }) : null, q.my ? h('span', { class: 'kind alt', text: '내 문제' }) : null, readBtn(function () { return qSpeech(q); }), starBtn(q)));
    if (q.passage) card.append(h('div', { class: 'passage' }, withBlanks(q.passage)));
    card.append(h('p', { class: 'qtext', text: q.q }));
    var area = h('div', {});
    if (q.type === 'order' || q.type === 'match') {
      var qi = Q.i, mk = q.type === 'order' ? orderWidget : matchWidget;
      area = mk(q, examHas(qi) ? ex.answers[qi] : null, function (v) {
        if (v) setAns(qi, v); else { delete ex.answers[qi]; saveExamSoon(); refreshExamBits(); }
      }).el;
    } else if (q.type === 'mc') {
      area.className = 'choices';
      q.choices.forEach(function (c, k) {
        area.append(h('button', { type: 'button', class: 'choice' + (ex.answers[Q.i] === k && examHas(Q.i) ? ' selected' : ''), 'data-k': k, onclick: function () {
          setAns(Q.i, k);
          area.querySelectorAll('.choice').forEach(function (b) { b.classList.toggle('selected', Number(b.dataset.k) === k); });
        } }, h('span', { class: 'bub', text: CIRC[k] }), h('span', { class: 'ct', text: c })));
      });
    } else if (q.type === 'ox') {
      area.className = 'oxrow';
      [['O', true], ['X', false]].forEach(function (pair) {
        area.append(h('button', { type: 'button', class: 'choice' + (examHas(Q.i) && ex.answers[Q.i] === pair[1] ? ' selected' : ''), 'data-k': pair[0], 'aria-label': pair[0], text: pair[0], onclick: function () {
          setAns(Q.i, pair[1]);
          area.querySelectorAll('.choice').forEach(function (b) { b.classList.toggle('selected', (b.dataset.k === 'O') === pair[1]); });
        } }));
      });
    } else if (q.type === 'essay') {
      area.className = 'essay';
      var eta = h('textarea', { rows: '5', maxlength: '1000', placeholder: '내 말로 써 보세요.', 'aria-label': '서술형 답 쓰기' });
      eta.value = examHas(Q.i) ? String(ex.answers[Q.i]) : '';
      eta.addEventListener('input', function () {
        var v = eta.value.trim();
        if (v) setAns(Q.i, v); else { delete ex.answers[Q.i]; saveExamSoon(); refreshExamBits(); }
      });
      area.append(eta);
    } else {
      area.className = 'short';
      var inp = h('input', { type: 'text', autocomplete: 'off', placeholder: q.hint ? '정답 (' + q.hint + ')' : '정답', 'aria-label': '정답 입력', value: examHas(Q.i) ? String(ex.answers[Q.i]) : '' });
      inp.addEventListener('input', function () {
        var v = inp.value.trim();
        if (v) setAns(Q.i, v); else { delete ex.answers[Q.i]; saveExamSoon(); refreshExamBits(); }
      });
      area.append(inp);
    }
    card.append(area);
    var flagBtn = h('button', { type: 'button', class: 'btn small', text: ex.flags[Q.i] ? '⚑ 표시 해제' : '⚑ 나중에 다시 보기', onclick: function () {
      if (ex.flags[Q.i]) delete ex.flags[Q.i]; else ex.flags[Q.i] = 1;
      flagBtn.textContent = ex.flags[Q.i] ? '⚑ 표시 해제' : '⚑ 나중에 다시 보기'; saveExamSoon(); refreshExamBits();
    } });
    card.append(h('div', { class: 'row' }, flagBtn));
    var armed = false;
    var subBtn = h('button', { type: 'button', class: 'btn primary', text: '제출하기' });
    subBtn.addEventListener('click', function () {
      var left = n - Object.keys(ex.answers).length;
      if (!armed) { armed = true; subBtn.classList.add('danger'); subBtn.classList.remove('primary'); subBtn.textContent = left ? '답 안 한 ' + left + '문제가 있어요. 정말 제출?' : '정말 제출할까요?'; return; }
      submitExam();
    });
    root.append(card, h('div', { class: 'row between navrow' },
      h('button', { type: 'button', class: 'btn', text: '이전', disabled: Q.i === 0, onclick: function () { Q.i--; saveExamSoon(); renderExam(); window.scrollTo(0, 0); } }),
      h('button', { type: 'button', class: 'btn', text: '다음', disabled: Q.i >= n - 1, onclick: function () { Q.i++; saveExamSoon(); renderExam(); window.scrollTo(0, 0); } })),
      buildGrid(), h('div', { class: 'row center' }, subBtn));
    refreshExamBits();
    if (ex.deadline) {
      var tick = function () {
        if (Q.exam !== ex) { stopTimer(); return; }
        var left = Math.ceil((ex.deadline - Date.now()) / 1000), el = $('examTimer');
        if (el) { el.textContent = '남은 시간 ' + fmtClock(left); el.classList.toggle('warn', left <= 60); }
        if (left <= 0) submitExam();
      };
      tick(); if (Q.exam === ex && !ex.submittedAt) examTimer = setInterval(tick, 1000);
    }
  }
  function submitExam() {
    stopTimer();
    var ex = Q.exam; if (!ex || ex.submittedAt) return;
    var now = Date.now();
    ex.submittedAt = now;
    Q.results = [];
    Q.list.forEach(function (q, i) {
      var has = Object.prototype.hasOwnProperty.call(ex.answers, i), g = has ? ex.answers[i] : null;
      var ok = has && isRight(q, g);
      Q.results.push({ idx: i, ok: ok, given: g });
      var rec = makeAttempt(q, i, ok, g, now);
      addAttempt(rec);
      DB.put('attempts', rec).catch(function () { /* ignore */ });
    });
    saveSession(true);
    updateBadge();
    Q.i = Q.list.length;
    renderResult();
  }

  function renderResult() {
    stopTimer();
    var root = $('solveBody');
    root.replaceChildren();
    var total = Q.results.length, right = Q.results.filter(function (r) { return r.ok; }).length;
    var wrong = Q.results.filter(function (r) { return !r.ok; });
    var timeLine = Q.exam && Q.exam.submittedAt ? ' · 걸린 시간 ' + fmtClock(Math.round((Q.exam.submittedAt - Q.t0) / 1000)) : '';
    root.append(h('div', { class: 'resultbox' },
      h('div', { class: 'score' },
        h('div', { class: 'n' }, String(right), h('small', { text: ' / ' + total })),
        a11y.easy
          ? h('p', { class: 'hint big', text: '잘했어요! ' + total + '개 중 ' + right + '개 맞았어요. ' + '⭐'.repeat(Math.max(1, Math.round((right / Math.max(1, total)) * 5))) })
          : h('p', { class: 'hint', text: pct(right, total) + '점' + timeLine + (Q.exam && Q.list.some(function (x) { return x.type === 'essay'; }) ? ' · 서술형은 핵심어가 60% 이상 들어 있으면 맞은 것으로 쳤어요' : '') + ' · ' + (wrong.length ? '틀린 ' + wrong.length + '문제는 오답노트에 담았어요.' : '모두 맞혔어요.') })),
      wrong.length ? h('div', { class: 'list' }, wrong.slice(0, a11y.easy ? 5 : 40).map(function (r) {
        var q = Q.list[r.idx];
        return h('div', { class: 'note' },
          h('div', { class: 'meta' }, h('span', { class: 'kind', text: (r.idx + 1) + '번 · ' + kindLabel(q) })),
          q.passage ? h('div', { class: 'passage' }, withBlanks(q.passage)) : null,
          h('p', { class: 'qtext', text: q.q }),
          h('p', { class: 'mine' }, '내 답 ', h('span', { class: 'x', text: givenLabel(q, r.given) }), ' → 정답 ', h('span', { class: 'o', text: answerLabel(q) })),
          h('details', {}, h('summary', { text: '해설 보기' }),
            h('div', { class: 'detail' },
              q.type === 'mc' && r.given != null && q.feedback && q.feedback[r.given] ? h('p', { text: q.feedback[r.given] }) : null,
              q.explain ? h('p', { text: q.explain }) : null,
              q.evidence ? h('div', { class: 'quote' }, h('b', { text: '본문 근거' }), q.evidence) : null)));
      }).concat(wrong.length > 40 ? [h('p', { class: 'hint', text: '나머지 ' + (wrong.length - 40) + '개는 오답노트에서 볼 수 있어요.' })] : [])) : null,
      h('div', { class: 'row' },
        wrong.length ? h('button', { type: 'button', class: 'btn primary', text: '틀린 문제 다시 풀기', onclick: function () { startPicked(wrong.map(function (r) { var c = JSON.parse(JSON.stringify(Q.list[r.idx])); c.review = true; return c; }), 'retry'); } }) : null,
        h('button', { type: 'button', class: 'btn', text: '오답노트', onclick: function () { go('notes'); } }),
        h('button', { type: 'button', class: 'btn', text: '새로 만들기', onclick: function () { go('make'); } }))));
    window.scrollTo(0, 0);
  }

  /* ---------- 오답노트 / 별표 ---------- */
  var notesTab = 'wrong';
  function noteCard(q, metaRight, lastWrong, actions) {
    return h('div', { class: 'note' },
      h('div', { class: 'meta' }, h('span', { class: 'kind', text: kindLabel(q) }), h('span', { text: metaRight })),
      q.passage ? h('div', { class: 'passage' }, withBlanks(q.passage)) : null,
      h('p', { class: 'qtext', text: q.q }),
      h('p', { class: 'mine' }, lastWrong ? ['내 답 ', h('span', { class: 'x', text: givenLabel(q, lastWrong.given) }), ' → '] : null, '정답 ', h('span', { class: 'o', text: answerLabel(q) })),
      h('details', {}, h('summary', { text: '해설 보기' }),
        h('div', { class: 'detail' },
          q.type === 'mc' && lastWrong && lastWrong.given != null && q.feedback && q.feedback[lastWrong.given] ? h('p', { text: q.feedback[lastWrong.given] }) : null,
          q.explain ? h('p', { text: q.explain }) : null,
          q.evidence ? h('div', { class: 'quote' }, h('b', { text: '본문 근거' }), q.evidence) : null)),
      actions ? h('div', { class: 'row tight' }, actions) : null);
  }
  function renderNotes() {
    renderNotesInner();
    var n = Object.keys(banned).length;
    if (n) {
      $('notesBody').append(h('div', { class: 'box' },
        h('p', { class: 'hint', text: '지운 문제 ' + n + '개는 오답노트에 안 보이고, 같은 글로 문제를 만들어도 나오지 않아요.' }),
        confirmBtn('지운 문제 전부 되돌리기', '정말 되돌릴까요?', function () {
          banned = {}; saveBanned(); renderNotes(); alert0('지운 문제를 되돌렸어요.');
        })));
    }
    var G = srcGroups(), ids = Object.keys(G);
    if (ids.length) {
      var gb = h('div', { class: 'box adv' }, h('h2', { class: 'sec-h', text: '글별로 지우기' }),
        h('p', { class: 'hint', text: '같은 글에서 만든 문제를 한꺼번에 지워요. 그 글의 틀린 문제, 별표, 풀이 기록이 같이 지워지고 같은 글로 다시 만들어도 나오지 않아요.' }));
      ids.forEach(function (id) {
        var g = G[id], parts = [];
        if (g.notes.length) parts.push('틀린 문제 ' + g.notes.length);
        if (g.stars.length) parts.push('별표 ' + g.stars.length);
        if (g.sess.length) parts.push('풀이 ' + g.sess.length);
        gb.append(h('div', { class: 'grow' },
          h('div', { class: 'gt' }, h('b', { text: '‘' + (g.t || '이름 없는 글') + '…’' }), h('span', { class: 'hint', text: ' ' + parts.join(' · ') })),
          confirmBtn('이 글 문제 모두 지우기', '정말 지울까요?', function () { deleteSrc(id); })));
      });
      $('notesBody').append(gb);
    }
  }
  // 같은 글에서 나온 문제끼리 묶어요. (글 정보가 없는 예전 문제는 묶이지 않아요)
  function srcGroups() {
    var G = {};
    function g(id, t) { return G[id] || (G[id] = { t: t || '', notes: [], stars: [], sess: [] }); }
    currentNotes().forEach(function (x) { if (x.s.q.src) g(x.s.q.src, x.s.q.srcT).notes.push(x); });
    Object.keys(stars).forEach(function (k) { var q = stars[k]; if (q && q.src) g(q.src, q.srcT).stars.push(q); });
    sessionsCache.forEach(function (x) { if (x.src) g(x.src, x.srcT).sess.push(x); });
    return G;
  }
  function deleteSrc(id) {
    var g = srcGroups()[id];
    if (!g) return;
    var ks = {};
    g.notes.forEach(function (x) { ks[x.k] = 1; });
    g.stars.forEach(function (q) { ks[q.k] = 1; });
    Promise.all(g.sess.map(function (x) {
      return DB.get('lists', x.id).then(function (rec) {
        ((rec && rec.list) || []).forEach(function (q) { if (q.src === id && q.k) ks[q.k] = 1; });
      }).catch(function () { /* ignore */ });
    })).then(function () {
      Object.keys(ks).forEach(function (k) { banned[k] = 1; delete stars[k]; });
      saveBanned(); saveStars();
      var gone = {};
      g.sess.forEach(function (x) { gone[x.id] = 1; DB.del('sessions', x.id).catch(function () { /* ignore */ }); DB.del('lists', x.id).catch(function () { /* ignore */ }); });
      sessionsCache = sessionsCache.filter(function (x) { return !gone[x.id]; });
      if (pending && pending.questions.some(function (q) { return q.src === id; })) { pending = null; $('understandSec').hidden = true; }
      updateBadge(); renderResume(); renderNotes();
      alert0('이 글의 문제 ' + Object.keys(ks).length + '개를 지웠어요.');
    });
  }
  function renderNotesInner() {
    var root = $('notesBody');
    root.replaceChildren();
    updateBadge();
    var starList = Object.keys(stars).reverse().map(function (k) { return stars[k]; });
    var list = currentNotes();
    root.append(h('div', { class: 'tabs' },
      h('button', { type: 'button', class: 'btn tab', 'aria-selected': notesTab === 'wrong' ? 'true' : 'false', text: '틀린 문제 ' + list.length, onclick: function () { notesTab = 'wrong'; renderNotes(); } }),
      h('button', { type: 'button', class: 'btn tab', 'aria-selected': notesTab === 'star' ? 'true' : 'false', text: '★ 별표 ' + starList.length, onclick: function () { notesTab = 'star'; renderNotes(); } })));
    if (notesTab === 'star') {
      if (!starList.length) { root.append(h('div', { class: 'empty' }, h('p', { text: '별표 친 문제가 없어요.' }), h('p', { class: 'hint', text: '문제를 풀다가 ☆ 별표를 누르면 여기에 모여요. 시험 전에 헷갈리는 것만 다시 볼 수 있어요.' }))); return; }
      var sv = h('div', { class: 'box' });
      sv.append(h('div', { class: 'row between' }, h('h2', { class: 'sec-h', text: '별표 문제 ' + starList.length + '개' }),
        h('button', { type: 'button', class: 'btn primary', text: '별표 문제 풀기', onclick: function () {
          startPicked(starList.map(function (q) { var c = JSON.parse(JSON.stringify(q)); c.review = true; return c; }), 'star', null, 50);
        } })));
      sv.append(h('div', { class: 'list' }, starList.slice(0, 100).map(function (q) {
        return noteCard(q, '별표', null, [h('button', { type: 'button', class: 'btn small', text: '별표 빼기', onclick: function () { delete stars[q.k]; saveStars(); renderNotes(); } }),
          confirmBtn('🗑 문제 삭제', '정말 삭제?', function () { banQ(q); renderNotes(); alert0('문제를 지웠어요.'); })]);
      })));
      root.append(sv);
      return;
    }
    if (!list.length) {
      root.append(h('div', { class: 'empty' }, h('p', { text: '아직 틀린 문제가 없어요.' }), h('p', { class: 'hint', text: '문제를 풀다 틀리면 여기에 모여요. 다시 풀어서 맞히면 노트에서 빠져요. 틀린 기록 자체는 기록 탭에 계속 남아요.' })));
      return;
    }
    var view = h('div', { class: 'box' });
    view.append(h('div', { class: 'row between' },
      h('h2', { class: 'sec-h', text: '틀린 문제 ' + list.length + '개' }),
      h('button', { type: 'button', class: 'btn primary', text: '많이 틀린 순 풀기', onclick: function () {
        var arr = list.filter(function (x) { return (!a11y.easy || easyOk(x.s.q)) && typeOk(x.s.q); }).slice(0, a11y.easy ? 10 : 30).map(function (x) { var c = JSON.parse(JSON.stringify(x.s.q)); c.review = true; return c; });
        if (!arr.length) { alert0('고른 종류에 맞는 문제가 없어요. ‘문제 종류’를 바꿔 보세요.'); return; }
        startQuiz(arr, 'notes');
      } })));
    var lw = {};
    for (var i = A.length - 1; i >= 0; i--) if (!A[i].ok && !lw[A[i].k]) lw[A[i].k] = A[i];
    view.append(h('div', { class: 'list' }, list.slice(0, 100).map(function (x) {
      return noteCard(x.s.q, '틀린 횟수 ' + x.s.wrong + ' · ' + fmtDate(x.s.t), lw[x.k] || null, [confirmBtn('🗑 문제 삭제', '정말 삭제?', function () { banQ(x.s.q); renderNotes(); alert0('문제를 지웠어요. 같은 글로 다시 만들어도 나오지 않아요.'); })]);
    })));
    if (list.length > 100) view.append(h('p', { class: 'hint', text: '많이 틀린 100개만 보여요.' }));
    root.append(view);
  }

  /* ---------- 암기카드 ---------- */
  var C = { cards: [], all: [], i: 0, flipped: false, known: 0, unsure: [] };
  function startCards(cards) {
    C = { cards: cards.slice(), all: cards.slice(), i: 0, flipped: false, known: 0, unsure: [] };
    go('cards');
  }
  function rateCard(ok) {
    var c = C.cards[C.i], now = Date.now();
    var rec = { id: 'card.' + now.toString(36) + '.' + Math.random().toString(36).slice(2, 6), uid: me.uid, name: me.name, sid: 'cards', n: C.i, t: now, k: c.k, type: 'card', target: c.target || '', ok: ok, given: null, trick: false, q: null };
    addAttempt(rec); DB.put('attempts', rec).catch(function () { /* ignore */ });
    if (ok) C.known++; else C.unsure.push(c);
    C.i++; C.flipped = false; renderCard(); window.scrollTo(0, 0);
  }
  function renderCard() {
    var root = $('cardsBody');
    root.replaceChildren();
    if (C.i >= C.cards.length) {
      root.append(h('div', { class: 'resultbox' },
        h('div', { class: 'score' }, h('div', { class: 'n' }, String(C.known), h('small', { text: ' / ' + C.cards.length })), h('p', { class: 'hint', text: '알아요로 표시한 카드예요. 헷갈린 용어는 다음 문제에 더 자주 나와요.' })),
        h('div', { class: 'row' },
          C.unsure.length ? h('button', { type: 'button', class: 'btn primary', text: '헷갈린 카드 ' + C.unsure.length + '장 다시', onclick: function () { startCards(C.unsure); } }) : null,
          h('button', { type: 'button', class: 'btn', text: '문제로 풀기', onclick: function () { go('make'); } }))));
      return;
    }
    var c = C.cards[C.i];
    root.append(h('div', { class: 'prog' }, h('span', { text: '카드 ' + (C.i + 1) + ' / ' + C.cards.length }), h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round((C.i / C.cards.length) * 100) + '%' }))));
    if (canSpeak) root.append(h('div', { class: 'row center' }, readBtn(function () { return C.flipped ? c.back : String(c.front).replace(/____/g, ' 빈칸 '); })));
    var face = h('button', { type: 'button', class: 'flash' + (C.flipped ? ' back' : ''), 'aria-label': C.flipped ? '카드 뒷면' : '카드 앞면, 눌러서 뒤집기', onclick: function () { C.flipped = !C.flipped; renderCard(); } },
      h('span', { class: 'kind', text: C.flipped ? '답' : '질문' }),
      h('div', { class: 'ftxt' }, C.flipped ? c.back : withBlanks(c.front)),
      h('span', { class: 'hint', text: C.flipped ? '' : '눌러서 답 보기' }));
    root.append(face);
    if (C.flipped) {
      root.append(h('div', { class: 'row center' },
        h('button', { type: 'button', class: 'btn', text: '헷갈려요', onclick: function () { rateCard(false); } }),
        h('button', { type: 'button', class: 'btn primary', text: '알아요', onclick: function () { rateCard(true); } })));
    }
  }

  /* ---------- 기록 ---------- */
  function renderHistory() {
    var root = $('historyBody');
    root.replaceChildren();
    var R = real(), total = R.length, right = R.filter(function (a) { return a.ok; }).length;
    root.append(h('div', { class: 'stats four' },
      stat('푼 문제', total), stat('정답률', pct(right, total) + '%'), stat('풀이 횟수', sessionsCache.length), stat('연속 공부', studyStreak() + '일')));

    var DN = ['일', '월', '화', '수', '목', '금', '토'], days = [], mx = 1, bucket = {};
    R.forEach(function (a) { var k = dayKey(a.t), b2 = bucket[k] || (bucket[k] = { n: 0, ok: 0 }); b2.n++; if (a.ok) b2.ok++; });
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var bk = bucket[dayKey(d.getTime())] || { n: 0, ok: 0 };
      days.push({ label: DN[d.getDay()], n: bk.n, ok: bk.ok });
      mx = Math.max(mx, bk.n);
    }
    root.append(h('div', { class: 'box' }, h('h2', { class: 'sec-h', text: '최근 7일' }),
      h('div', { class: 'week' }, days.map(function (d2) {
        return h('div', { class: 'col' }, h('span', { class: 'v', text: d2.n ? String(d2.n) : '' }),
          h('div', { class: 'bw' }, h('i', { style: 'height:' + (d2.n ? Math.max(6, Math.round((d2.n / mx) * 100)) : 0) + '%', title: d2.n ? pct(d2.ok, d2.n) + '%' : '' })),
          h('span', { class: 'd', text: d2.label }));
      }))));

    var byType = { mc: [0, 0], ox: [0, 0], short: [0, 0] };
    R.forEach(function (a) { if (!byType[a.type] && (a.type === 'match' || a.type === 'order')) byType[a.type] = [0, 0]; });
    R.forEach(function (a) { if (byType[a.type]) { byType[a.type][1]++; if (a.ok) byType[a.type][0]++; } });
    var wk = weakStats().byTerm, wt = Object.keys(wk).filter(function (t) { return wk[t].wrong; })
      .sort(function (a, b) { return wk[b].wrong - wk[a].wrong; }).slice(0, 8);
    root.append(h('div', { class: 'box' }, h('h2', { class: 'sec-h', text: '내 약점' }),
      h('div', { class: 'typerow' }, Object.keys(byType).map(function (t) {
        return h('div', { class: 'tcell' }, h('b', { text: byType[t][1] ? pct(byType[t][0], byType[t][1]) + '%' : '-' }), h('span', { text: E.KIND_NAME[t] }));
      })),
      wt.length ? h('div', {}, h('div', { class: 'hint', text: '자주 틀리는 핵심어 (틀린 횟수/시도)' }),
        h('div', { class: 'chips' }, wt.map(function (t) { return h('span', { class: 'chip', text: t + ' ' + wk[t].wrong + '/' + wk[t].total }); })))
        : h('p', { class: 'hint', text: '아직 약점이 없어요. 문제를 풀면 여기에 분석돼요.' })));

    if (!sessionsCache.length) {
      root.append(h('div', { class: 'empty' }, h('p', { text: '아직 푼 기록이 없어요.' })));
    } else {
      root.append(h('div', { class: 'list' }, sessionsCache.slice(0, 60).map(function (s) {
        var r = s.results.filter(function (x) { return x.ok; }).length;
        var det = h('details', {}, h('summary', {},
          h('span', { class: 'hs' }, fmtDate(s.t) + (s.exam ? ' · 시험' : '')),
          h('span', { class: 'hn', text: s.exam && !s.done ? '시험 중' : r + ' / ' + s.results.length + (s.done ? '' : ' (푸는 중)') }),
          h('span', { class: 'hp', text: s.exam && !s.done ? '' : pct(r, s.results.length) + '%' })));
        var filled = false;
        det.addEventListener('toggle', function () {
          if (!det.open || filled) return; filled = true;
          var holder = h('div', { class: 'detail' }, h('p', { class: 'hint', text: '불러오는 중…' }));
          det.append(holder);
          DB.get('lists', s.id).then(function (rec) {
            var L = (rec && rec.list) || s.list;
            var delRow = h('div', { class: 'row tight' }, confirmBtn('🗑 이 풀이 기록 지우기', '정말 지울까요?', function () { deleteSession(s); }));
            if (!L) { holder.replaceChildren(h('p', { class: 'hint', text: '이 풀이의 문제 내용을 찾을 수 없어요.' }), delRow); return; }
            holder.replaceChildren.apply(holder, s.results.map(function (x) {
              var q = L[x.idx];
              return h('div', { class: 'hrow ' + (x.ok ? 'ok' : 'bad') },
                h('span', { class: 'hm', text: x.ok ? 'O' : 'X' }),
                h('span', { class: 'ht', text: (q.passage || q.q) + (x.ok ? '' : '  →  내 답: ' + givenLabel(q, x.given) + ' / 정답: ' + answerLabel(q)) }));
            }).concat([delRow]));
          });
        });
        return h('div', { class: 'note tight' }, det);
      })));
    }
    root.append(h('div', { class: 'box' },
      h('h2', { class: 'sec-h', text: '기록 보내기' }),
      h('p', { class: 'hint', text: '모든 문제와 채점 기록은 이 기기에 저장돼요. 선생님(관리자)에게 보내려면 아래 버튼으로 파일을 만들어 전달하세요.' }),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', text: '내 기록 파일 만들기', onclick: exportMine }))));
  }
  function stat(label, value) { return h('div', { class: 'stat' }, h('b', { text: String(value) }), h('span', { text: label })); }

  /* ---------- 내보내기 / 가져오기 ---------- */
  function saveFile(name, text) {
    var file = null;
    try { file = new File([text], name, { type: 'application/json' }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      return navigator.share({ files: [file], title: name }).catch(function () { download(name, text); });
    }
    download(name, text);
    return Promise.resolve();
  }
  function download(name, text) {
    var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    var a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function attachLists(sessions) {
    return DB.all('lists').then(function (all) {
      var m = {}; all.forEach(function (x) { m[x.id] = x.list; });
      return sessions.map(function (s) { return s.list ? s : Object.assign({}, s, { list: m[s.id] || [] }); });
    });
  }
  function buildExport(uid) {
    return Promise.all([DB.all('attempts'), DB.all('sessions')]).then(function (r) {
      return attachLists(r[1].filter(function (s) { return s.uid === uid; })).then(function (ses) {
        return {
          app: 'quiznote', v: 1, t: Date.now(), user: { uid: me.uid, name: me.name },
          sessions: ses,
          attempts: r[0].filter(function (a) { return a.uid === uid; })
        };
      });
    });
  }
  function safeName(s) { return String(s || 'user').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 20) || 'user'; }
  function exportMine() {
    if (!me.name) { alert0('이름을 먼저 적어 주세요.'); return; }
    buildExport(me.uid).then(function (d) { return saveFile('quiznote-' + safeName(me.name) + '.json', JSON.stringify(d)); });
  }
  function alert0(msg) { var el = $('toast'); el.textContent = msg; el.hidden = false; setTimeout(function () { el.hidden = true; }, 2600); }

  /* ---------- 관리자 ---------- */
  function aggregate(attempts, sessions) {
    var realA = attempts.filter(function (a) { return a.type !== 'card'; });
    var total = realA.length, right = realA.filter(function (a) { return a.ok; }).length;
    var terms = {}, byK = {};
    attempts.forEach(function (a) {
      if (a.target) { var t = terms[a.target] || (terms[a.target] = { w: 0, n: 0 }); t.n++; if (!a.ok) t.w++; }
      var s = byK[a.k] || (byK[a.k] = { w: 0, n: 0, q: null }); s.n++; if (!a.ok) { s.w++; if (a.q) s.q = a.q; }
    });
    var weakTerms = Object.keys(terms).filter(function (t) { return terms[t].w; })
      .sort(function (a, b) { return terms[b].w - terms[a].w; }).slice(0, 6).map(function (t) { return t + ' ' + terms[t].w + '/' + terms[t].n; });
    var weakQs = Object.keys(byK).filter(function (k) { return byK[k].w && byK[k].q; })
      .sort(function (a, b) { return byK[b].w - byK[a].w; }).slice(0, 8).map(function (k) { return { q: byK[k].q, w: byK[k].w, n: byK[k].n }; });
    var last = attempts.reduce(function (m, a) { return Math.max(m, a.t); }, 0);
    return { total: total, right: right, sessions: sessions.length, last: last, weakTerms: weakTerms, weakQs: weakQs };
  }
  function adminUsers() {
    return Promise.all([DB.all('attempts'), DB.all('sessions'), DB.all('imports')]).then(function (r) {
      var map = {};
      function add(uid, name, attempts, sessions, src) {
        var u = map[uid] || (map[uid] = { uid: uid, name: name, attempts: [], sessions: [], src: src });
        if (name) u.name = name;
        u.attempts = attempts; u.sessions = sessions;
      }
      var localIds = {};
      r[0].forEach(function (a) { localIds[a.uid] = 1; });
      r[1].forEach(function (s) { localIds[s.uid] = 1; });
      Object.keys(localIds).forEach(function (id) {
        var att = r[0].filter(function (a) { return a.uid === id; }), ses = r[1].filter(function (s) { return s.uid === id; });
        var nm = (ses[0] && ses[0].name) || (att[0] && att[0].name) || '';
        add(id, nm, att, ses, id === me.uid ? '이 기기' : '이 기기(다른 이름)');
      });
      r[2].forEach(function (im) { add(im.uid, im.name, im.attempts || [], im.sessions || [], '가져옴 ' + fmtDate(im.importedAt)); });
      return Object.keys(map).map(function (k) { var u = map[k]; u.agg = aggregate(u.attempts, u.sessions); return u; })
        .sort(function (a, b) { return b.agg.last - a.agg.last; });
    });
  }
  var confirmWipe = false;
  function renderAdmin() {
    var root = $('adminBody');
    root.replaceChildren(h('p', { class: 'hint', text: '불러오는 중…' }));
    adminUsers().then(function (users) {
      root.replaceChildren();
      var all = users.reduce(function (s, u) { return { n: s.n + u.agg.total, r: s.r + u.agg.right }; }, { n: 0, r: 0 });
      root.append(h('div', { class: 'stats' }, stat('사용자', users.length), stat('채점 기록', all.n.toLocaleString('ko-KR')), stat('전체 정답률', pct(all.r, all.n) + '%')));
      root.append(h('div', { class: 'box' },
        h('h2', { class: 'sec-h', text: '사용자 기록 모으기' }),
        h('p', { class: 'hint', text: '서버가 없어서 기록은 각자의 기기에 저장돼요. 사용자가 기록 탭에서 만든 파일을 여기로 불러오면 사용자별 결과를 볼 수 있어요. 같은 사용자의 파일을 다시 불러오면 최신으로 바뀌어요.' }),
        h('div', { class: 'row' },
          h('label', { class: 'file-label' }, h('input', { type: 'file', id: 'importFile', accept: '.json,application/json', multiple: true, onchange: importFiles }), h('span', { class: 'btn primary', text: '기록 파일 불러오기' })),
          h('button', { type: 'button', class: 'btn', text: '모든 기록 내보내기', onclick: function () { exportAll(users); } }))));
      var tIn = h('input', { type: 'number', class: 'textin', min: '0', max: '50', step: '1', value: String(effTrick()), 'aria-label': '함정 문제 간격' });
      var tMsg = h('p', { class: 'hint', text: '지금 적용: ' + (effTrick() ? effTrick() + '문제마다 1개' : '꺼짐') + ' (' + trickSource() + ')' });
      function tVal() { var n = Math.floor(Number(tIn.value)); return isNaN(n) ? 10 : Math.max(0, Math.min(50, n)); }
      root.append(h('div', { class: 'box' },
        h('h2', { class: 'sec-h', text: '함정 문제 간격' }),
        h('p', { class: 'hint', text: '몇 문제마다 정답이 ‘정답 없음’인 함정 문제를 넣을지 정해요. 0이면 꺼요. 쉬운 화면에도 똑같이 적용돼요.' }),
        tIn, tMsg,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn primary', text: '이 기기에 저장', onclick: function () {
            cfg.local = tVal(); DB.put('kv', { k: 'config', trickEvery: cfg.local }).then(function () { alert0('저장했어요: ' + (cfg.local ? cfg.local + '문제마다' : '꺼짐')); renderAdmin(); });
          } }),
          h('button', { type: 'button', class: 'btn', text: '모두에게 적용할 설정 파일 만들기', onclick: function () { saveFile('config.json', JSON.stringify({ trickEvery: tVal() })); } }),
          h('button', { type: 'button', class: 'btn', text: '이 기기 설정 지우기', onclick: function () { cfg.local = null; DB.del('kv', 'config').then(function () { alert0('이 기기 설정을 지웠어요.'); renderAdmin(); }); } })),
        h('p', { class: 'hint', text: '다른 사람의 폰에도 적용하려면 ‘설정 파일 만들기’로 받은 config.json을 깃허브 저장소에 올려 주세요. 사용자는 사이트를 새로 열면 바뀐 값이 적용돼요. 이 기기에 따로 저장한 값이 있으면 그 값이 우선이에요.' })));
      if (!users.length) { root.append(h('div', { class: 'empty' }, h('p', { text: '아직 기록이 없어요.' }))); }
      else {
        root.append(h('div', { class: 'list' }, users.map(function (u) {
          var g = u.agg;
          var det = h('details', {}, h('summary', {},
            h('span', { class: 'un', text: u.name || '(이름 없음)' }),
            h('span', { class: 'hn', text: g.right + ' / ' + g.total }),
            h('span', { class: 'hp', text: pct(g.right, g.total) + '%' })));
          det.append(h('div', { class: 'detail' },
            h('p', { class: 'hint', text: u.src + ' · 풀이 ' + g.sessions + '회 · 마지막 ' + (g.last ? fmtDate(g.last) : '-') }),
            g.weakTerms.length ? h('div', {}, h('div', { class: 'hint', text: '약한 핵심어 (틀린 횟수/시도)' }), h('div', { class: 'chips' }, g.weakTerms.map(function (t) { return h('span', { class: 'chip', text: t }); }))) : null,
            g.weakQs.length ? h('div', {}, h('div', { class: 'hint', text: '자주 틀린 문제' }), g.weakQs.map(function (x) {
              return h('div', { class: 'hrow bad' }, h('span', { class: 'hm', text: x.w + '회' }), h('span', { class: 'ht', text: (x.q.passage || x.q.q) + '  →  정답: ' + answerLabel(x.q) }));
            })) : h('p', { class: 'hint', text: '틀린 문제가 없어요.' }),
            h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', text: '이 사용자 파일로 저장', onclick: function () {
              attachLists(u.sessions).then(function (ses) {
                saveFile('quiznote-' + safeName(u.name) + '.json', JSON.stringify({ app: 'quiznote', v: 1, t: Date.now(), user: { uid: u.uid, name: u.name }, sessions: ses, attempts: u.attempts }));
              });
            } }))));
          return h('div', { class: 'note tight' }, det);
        })));
      }
      root.append(h('div', { class: 'box' },
        h('h2', { class: 'sec-h', text: '관리' }),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn', text: '관리자 잠그기', onclick: function () {
            adminOn = false; try { sessionStorage.removeItem('qn.admin'); } catch (e) { /* ignore */ }
            updateAdminTab(); go('make');
          } }),
          confirmWipe
            ? h('button', { type: 'button', class: 'btn danger', text: '정말 이 기기의 기록을 모두 지울까요?', onclick: function () {
              Promise.all([DB.clear('attempts'), DB.clear('sessions'), DB.clear('imports'), DB.clear('lists')]).then(function () { confirmWipe = false; return reloadData(); }).then(function () { updateBadge(); renderAdmin(); });
            } })
            : h('button', { type: 'button', class: 'btn', text: '이 기기의 기록 모두 지우기', onclick: function () { confirmWipe = true; renderAdmin(); } }))));
    });
  }
  function importFiles(ev) {
    var files = Array.prototype.slice.call(ev.target.files || []);
    ev.target.value = '';
    var ok = 0, bad = 0;
    Promise.all(files.map(function (f) {
      return f.text().then(function (t) {
        var d = JSON.parse(t);
        if (!d || d.app !== 'quiznote' || !d.user || !d.user.uid || !Array.isArray(d.attempts)) throw new Error('bad');
        ok++;
        return DB.put('imports', { uid: d.user.uid, name: d.user.name || '', attempts: d.attempts, sessions: d.sessions || [], importedAt: Date.now(), exportedAt: d.t || 0 });
      }).catch(function () { bad++; });
    })).then(function () { alert0(ok + '개 불러왔어요.' + (bad ? ' ' + bad + '개는 형식이 달라서 건너뛰었어요.' : '')); renderAdmin(); });
  }
  function exportAll(users) {
    Promise.all(users.map(function (u) { return attachLists(u.sessions); })).then(function (all) {
      saveFile('quiznote-all.json', JSON.stringify({ app: 'quiznote-all', v: 1, t: Date.now(), users: users.map(function (u, i) { return { uid: u.uid, name: u.name, sessions: all[i], attempts: u.attempts }; }) }));
    });
  }

  /* ---------- 내 문제: 직접 추가·수정 ---------- */
  // 내 문제는 이 기기에 저장돼요(kv 'myq'). 파일로 내보내서 다른 사람 기기에 불러올 수도 있어요.
  // M.src === 'mine' 이면 저장된 내 문제를, 'draft' 이면 방금 자동으로 만든 문제를 고쳐요.
  var M = { list: [], src: 'mine', editing: null, delIdx: -1 };
  var LIM = { q: 300, passage: 800, choice: 120, answer: 80, note: 500 };
  function loadMine() { return DB.get('kv', 'myq').then(function (r) { M.list = (r && Array.isArray(r.list)) ? r.list : []; }).catch(function () { M.list = []; }); }
  function saveMine() { return DB.put('kv', { k: 'myq', list: M.list }).catch(function () { /* ignore */ }); }
  function mineList() { return M.src === 'draft' ? (pending ? pending.questions : []) : M.list; }
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }
  function shuffled(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var OX_Q_MINE = '다음 설명이 맞으면 O, 틀리면 X를 고르세요.';

  // 파일에서 불러온 문제가 이상해도 앱이 깨지지 않게 형식을 다시 확인해요.
  function sanitizeQ(x) {
    if (!x || typeof x !== 'object') return null;
    var t = x.type, str = function (v, n) { return String(v == null ? '' : v).trim().slice(0, n); };
    if (['mc', 'ox', 'short', 'essay'].indexOf(t) < 0) return null;
    var q = { id: str(x.id, 40) || uid8(), my: true, type: t, q: str(x.q, LIM.q), passage: str(x.passage, LIM.passage), explain: str(x.explain, LIM.note), evidence: str(x.evidence, LIM.note) };
    if (t === 'mc') {
      if (!Array.isArray(x.choices)) return null;
      q.choices = x.choices.slice(0, 6).map(function (c) { return str(c, LIM.choice); });
      var a = Number(x.answer);
      if (q.choices.length < 2 || q.choices.some(function (c) { return !c; }) || !(a >= 0 && a < q.choices.length)) return null;
      q.answer = a; q.feedback = q.choices.map(function (_, i) { return (Array.isArray(x.feedback) && typeof x.feedback[i] === 'string') ? x.feedback[i].slice(0, LIM.note) : ''; });
      if (!q.q) return null;
      q.target = q.choices[a]; if (q.choices[a] === E.NONE) q.trick = true;
    } else if (t === 'essay') {
      q.model = str(x.model || x.answer, LIM.passage);
      q.keywords = Array.isArray(x.keywords) ? x.keywords.slice(0, 8).map(function (v) { return str(v, LIM.answer); }).filter(Boolean) : [];
      if (!q.q || !q.model || !q.keywords.length) return null;
      q.answer = q.model; q.target = '';
    } else if (t === 'ox') {
      if (typeof x.answer !== 'boolean' || !q.passage) return null;
      q.answer = x.answer; q.q = q.q || OX_Q_MINE; q.target = '';
    } else {
      q.answer = str(x.answer, LIM.answer);
      if (!q.answer || !q.q) return null;
      q.accept = Array.isArray(x.accept) ? x.accept.slice(0, 10).map(function (v) { return str(v, LIM.answer); }).filter(Boolean) : [];
      q.hint = str(x.hint, 40); q.target = q.answer;
    }
    q.k = E.hash('my|' + q.id);
    return q;
  }

  function kindLabel(q) { return q.my && q.type === 'mc' ? '객관식' : E.KIND_NAME[q.sub || q.type]; }
  function stateFrom(q) {
    var st = { type: q.type, q: q.q || '', passage: q.passage || '', explain: q.explain || '', evidence: q.evidence || '', choices: (q.choices || ['', '', '', '']).slice(), ans: q.type === 'mc' ? (q.answer | 0) : 0, ox: q.type === 'ox' ? !!q.answer : true, answer: q.type === 'short' ? String(q.answer || '') : '', accept: (q.accept || []).join(', '), hint: q.hint || '', model: q.type === 'essay' ? String(q.model || q.answer || '') : '', kw: (q.keywords || []).join(', ') };
    if (st.type === 'ox' && q.my !== true && q.q) st.q = q.q;
    return st;
  }
  function validateState(st) {
    var need = function (v) { return !String(v).trim(); };
    if (st.type === 'ox') { if (need(st.passage)) return '설명 문장을 적어 주세요.'; return ''; }
    if (need(st.q)) return '문제를 적어 주세요.';
    if (st.type === 'essay') return need(st.model) ? '모범답안을 적어 주세요.' : need(st.kw) ? '핵심어를 1개 이상 적어 주세요. 채점에 써요.' : '';
    if (st.type === 'short') return need(st.answer) ? '정답을 적어 주세요.' : '';
    var cs = st.choices.map(function (c) { return c.trim(); });
    if (cs.some(function (c) { return !c; })) return '비어 있는 보기가 있어요. 채우거나 ‘지우기’를 눌러 주세요.';
    if (cs.length < 2) return '보기는 2개 이상 필요해요.';
    if (cs.filter(function (c, i) { return cs.indexOf(c) !== i; }).length) return '같은 보기가 있어요. 서로 다르게 적어 주세요.';
    return '';
  }
  function composeQ(old, st) {
    var q = Object.assign({}, old || {});
    var cut = function (v, n) { return String(v == null ? '' : v).trim().slice(0, n); };
    if (!q.id && !q.k) { q.id = uid8(); q.my = true; q.k = E.hash('my|' + q.id); }
    var prevType = q.type, prevChoices = q.choices ? JSON.stringify(q.choices) : '', prevFeedback = q.feedback;
    q.type = st.type;
    q.explain = cut(st.explain, LIM.note); q.evidence = cut(st.evidence, LIM.note);
    ['choices', 'feedback', 'accept', 'hint', 'trick', 'model', 'keywords'].forEach(function (f) { delete q[f]; });
    if (st.type === 'ox') {
      q.passage = cut(st.passage, LIM.passage); q.answer = !!st.ox;
      q.q = (prevType === 'ox' && old && old.q) ? old.q : OX_Q_MINE;
      if (prevType !== 'ox') q.target = '';
    } else if (st.type === 'essay') {
      q.passage = cut(st.passage, LIM.passage); q.q = cut(st.q, LIM.q); q.model = cut(st.model, LIM.passage); q.answer = q.model;
      q.keywords = st.kw.split(/[,，]/).map(function (v) { return cut(v, LIM.answer); }).filter(function (v, i, arr) { return v && arr.indexOf(v) === i; }).slice(0, 8);
      if (prevType !== 'essay' || !q.target) q.target = (old && old.target) || '';
    } else if (st.type === 'short') {
      q.passage = cut(st.passage, LIM.passage); q.q = cut(st.q, LIM.q); q.answer = cut(st.answer, LIM.answer);
      q.accept = st.accept.split(/[,，]/).map(function (v) { return cut(v, LIM.answer); }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
      q.hint = cut(st.hint, 40); q.target = q.answer;
    } else {
      q.passage = cut(st.passage, LIM.passage); q.q = cut(st.q, LIM.q);
      q.choices = st.choices.map(function (c) { return cut(c, LIM.choice); });
      q.answer = Math.min(st.ans, q.choices.length - 1);
      q.feedback = (prevType === 'mc' && JSON.stringify(q.choices) === prevChoices && prevFeedback) ? prevFeedback : q.choices.map(function () { return ''; });
      if (q.choices[q.answer] === E.NONE) { q.trick = true; q.target = (old && old.trick && old.target) || ''; } else q.target = q.choices[q.answer];
    }
    return q;
  }

  function openEditor(idx) {
    var list = mineList(), q = idx >= 0 ? list[idx] : null;
    M.editing = { idx: idx, old: q, st: stateFrom(q || { type: 'mc' }), err: '' };
    M.delIdx = -1;
    renderMine();
    var tas = document.querySelectorAll('#mineBody textarea'), first = M.editing && M.editing.st.type !== 'ox' && tas[1] ? tas[1] : tas[0];
    if (first) first.focus({ preventScroll: true });
  }
  function labelled(text, el, hint) { return h('label', { class: 'ed-f' }, h('span', { class: 'lbl', text: text }), el, hint ? h('span', { class: 'hint', text: hint }) : null); }
  function bindText(el, st, key) { el.value = st[key]; el.addEventListener('input', function () { st[key] = el.value; }); return el; }
  function textarea(st, key, rows, max, ph) { return bindText(h('textarea', { rows: String(rows), maxlength: String(max), placeholder: ph || '' }), st, key); }
  function textin(st, key, max, ph) { return bindText(h('input', { type: 'text', class: 'textin', maxlength: String(max), placeholder: ph || '', autocomplete: 'off' }), st, key); }

  function buildEditor() {
    var e = M.editing, st = e.st, draft = M.src === 'draft';
    var body = h('div', { class: 'ed-body' });
    var msg = h('p', { class: 'status err', role: 'alert', text: e.err || '' });
    function fill() {
      body.replaceChildren();
      if (st.type === 'ox') {
        body.append(labelled('설명 문장 (맞는지 틀린지 고르는 문장)', textarea(st, 'passage', 3, LIM.passage, '예: 에스프레소를 뽑을 때 물의 온도는 약 90~95도이다.')));
        body.append(h('div', { class: 'ed-f' }, h('span', { class: 'lbl', text: '정답' }), h('div', { class: 'seg', role: 'radiogroup', 'aria-label': '정답' },
          h('label', {}, h('input', { type: 'radio', name: 'edox', checked: st.ox ? true : null, onchange: function () { st.ox = true; } }), h('span', { text: 'O (맞다)' })),
          h('label', {}, h('input', { type: 'radio', name: 'edox', checked: st.ox ? null : true, onchange: function () { st.ox = false; } }), h('span', { text: 'X (틀리다)' })))));
      } else {
        body.append(labelled('본문 (선택)', textarea(st, 'passage', 3, LIM.passage, '문제에 함께 보여줄 글이에요. 없으면 비워 두세요. 빈칸은 ____ 로 적어요.')));
        body.append(labelled('문제', textarea(st, 'q', 2, LIM.q, st.type === 'mc' ? '예: 크레마는 무엇일까요?' : st.type === 'essay' ? '예: 에스프레소란 무엇인지 설명하세요.' : '예: 에스프레소 위에 생기는 황금빛 거품층을 무엇이라고 할까요?')));
        if (st.type === 'mc') {
          var rows = h('div', { class: 'ed-choices' });
          var draw = function () {
            rows.replaceChildren();
            st.choices.forEach(function (c, i) {
              var inp = h('input', { type: 'text', class: 'textin', maxlength: String(LIM.choice), 'aria-label': (i + 1) + '번 보기', placeholder: (i + 1) + '번 보기', autocomplete: 'off' });
              inp.value = c; inp.addEventListener('input', function () { st.choices[i] = inp.value; });
              rows.append(h('div', { class: 'ed-ch' },
                h('label', { class: 'ed-ok', title: '정답으로 고르기' }, h('input', { type: 'radio', name: 'edans', checked: st.ans === i ? true : null, 'aria-label': (i + 1) + '번이 정답', onchange: function () { st.ans = i; } }), h('span', { text: '정답' })),
                inp,
                st.choices.length > 2 ? h('button', { type: 'button', class: 'btn small', text: '지우기', onclick: function () { st.choices.splice(i, 1); if (st.ans >= st.choices.length) st.ans = st.choices.length - 1; else if (st.ans > i) st.ans--; draw(); } }) : null));
            });
            if (st.choices.length < 6) rows.append(h('div', {}, h('button', { type: 'button', class: 'btn small', text: '+ 보기 추가', onclick: function () { st.choices.push(''); draw(); } })));
          };
          draw();
          body.append(h('div', { class: 'ed-f' }, h('span', { class: 'lbl', text: '보기 (정답 옆 동그라미를 눌러요)' }), rows,
            h('span', { class: 'hint', text: '‘정답 없음’을 보기로 적고 정답으로 고르면 함정 문제가 돼요.' })));
        } else if (st.type === 'essay') {
          body.append(labelled('모범답안', textarea(st, 'model', 4, LIM.passage, '예: 에스프레소는 곱게 간 원두에 뜨거운 물을 높은 압력으로 통과시켜 뽑는 커피이다.')));
          body.append(labelled('핵심어 (채점 기준)', textin(st, 'kw', 200, '쉼표로 구분: 원두, 압력, 뜨거운 물'), '내 답에 핵심어가 75% 이상 들어 있으면 정답, 60% 이상이면 비슷해요(정답 처리)예요.'));
        } else {
          body.append(labelled('정답', textin(st, 'answer', LIM.answer, '예: 크레마')));
          body.append(labelled('다른 정답 (선택)', textin(st, 'accept', 200, '쉼표로 구분: 크레마층, crema'), '이것도 맞는 걸로 쳐요.'));
          body.append(labelled('힌트 (선택)', textin(st, 'hint', 40, '예: 3글자')));
        }
      }
      body.append(labelled('해설 (선택)', textarea(st, 'explain', 2, LIM.note, '풀고 나서 보여줄 설명이에요.')));
      body.append(labelled('근거·출처 (선택)', textarea(st, 'evidence', 2, LIM.note, '예: 교재 45쪽')));
    }
    var typeRow = h('div', { class: 'ed-f' }, h('span', { class: 'lbl', text: '문제 종류' }));
    if (e.idx < 0) {
      var seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': '문제 종류' });
      [['mc', '객관식'], ['ox', 'OX'], ['short', '단답(직접 쓰기)'], ['essay', '서술형']].forEach(function (p) {
        seg.append(h('label', {}, h('input', { type: 'radio', name: 'edtype', value: p[0], checked: st.type === p[0] ? true : null, onchange: function () { st.type = p[0]; fill(); } }), h('span', { text: p[1] })));
      });
      typeRow.append(seg);
    } else typeRow.append(h('p', { class: 'hint', text: kindLabel(e.old) + ' (종류를 바꾸려면 지우고 새로 만들어요)' }));
    fill();
    return h('div', { class: 'editor' },
      h('h3', { text: e.idx < 0 ? '새 문제 만들기' : '문제 고치기' }), typeRow, body, msg,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn primary', text: '저장', onclick: function () {
          var err = validateState(st);
          if (err) { e.err = err; msg.textContent = err; return; }
          var q = composeQ(e.old, st), list = mineList();
          if (e.idx < 0) list.push(q); else list[e.idx] = q;
          if (draft) draftChanged(); else saveMine();
          M.editing = null; renderMine(); alert0('저장했어요.'); window.scrollTo(0, 0);
        } }),
        h('button', { type: 'button', class: 'btn', text: '취소', onclick: function () { M.editing = null; renderMine(); } })));
  }

  function draftChanged() {
    if (!pending) return;
    pending.cards = pending.cards || [];
    status('gen', pending.questions.length + '문제가 준비됐어요. 고친 내용이 반영돼요.');
    renderUnderstand(true);
  }
  function copyToMine(q) {
    var c = JSON.parse(JSON.stringify(q)); delete c.review;
    c.id = uid8(); c.my = true; c.k = E.hash('my|' + c.id);
    M.list.push(c);
  }
  function mineRow(q, idx) {
    var draft = M.src === 'draft', list = mineList(), confirming = M.delIdx === idx;
    var btns = h('div', { class: 'row tight' });
    var plain = ['mc', 'ox', 'short', 'essay'].indexOf(q.type) >= 0;   // 짝짓기·순서 문제는 고치거나 내 문제로 담을 수 없어요
    if (plain) btns.append(h('button', { type: 'button', class: 'btn small', text: '고치기', onclick: function () { openEditor(idx); } }));
    if (draft && plain) btns.append(h('button', { type: 'button', class: 'btn small', text: '내 문제에 담기', onclick: function () { copyToMine(q); saveMine(); alert0('내 문제에 담았어요.'); } }));
    if (confirming) {
      btns.append(h('span', { class: 'hint', text: '정말 지울까요?' }),
        h('button', { type: 'button', class: 'btn small danger', text: '지우기', onclick: function () { list.splice(idx, 1); M.delIdx = -1; if (draft) draftChanged(); else saveMine(); renderMine(); } }),
        h('button', { type: 'button', class: 'btn small', text: '아니요', onclick: function () { M.delIdx = -1; renderMine(); } }));
    } else btns.append(h('button', { type: 'button', class: 'btn small', text: '지우기', onclick: function () { M.delIdx = idx; renderMine(); } }));
    return h('div', { class: 'mq' },
      h('div', { class: 'mqt' }, h('span', { class: 'kind', text: kindLabel(q) }), h('b', { text: clip(q.type === 'ox' ? q.passage : (q.q + (q.passage ? ' · ' + q.passage : '')), 90) })),
      h('div', { class: 'hint', text: (q.type === 'essay' ? '모범답안: ' : '정답: ') + clip(answerLabel(q), 60) + (q.type === 'short' && q.accept && q.accept.length ? ' (다른 정답 ' + q.accept.length + '개)' : '') }),
      btns);
  }
  function renderMine() {
    var root = $('mineBody'); if (!root) return;
    root.replaceChildren();
    var draft = M.src === 'draft';
    if (draft && !pending) { M.src = 'mine'; draft = false; }
    root.append(h('h2', { class: 'sec-h', text: draft ? '만든 문제 고치기' : '내 문제' }));
    if (M.editing) { root.append(buildEditor()); return; }
    var list = mineList();
    root.append(h('p', { class: 'hint', text: draft
      ? '자동으로 만든 문제를 보고 이상한 문제는 고치거나 지울 수 있어요. 다 고치면 아래 ‘풀러 가기’를 눌러요.'
      : '내가 직접 만든 문제예요. 이 기기에 저장돼요. 파일로 내보내서 다른 사람 기기에 불러올 수도 있어요.' }));
    var top = h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', text: '+ 새 문제 추가', onclick: function () { openEditor(-1); } }));
    if (draft) {
      top.append(h('button', { type: 'button', class: 'btn', text: '전부 내 문제에 담기', onclick: function () { list.forEach(copyToMine); saveMine(); alert0(list.length + '개를 내 문제에 담았어요.'); } }));
    } else {
      top.append(h('label', { class: 'file-label' }, h('input', { type: 'file', accept: '.json,application/json', onchange: function (ev) { importMine(ev.target.files); ev.target.value = ''; } }), h('span', { class: 'btn', text: '파일에서 불러오기' })));
      if (list.length) top.append(h('button', { type: 'button', class: 'btn', text: '파일로 내보내기', onclick: function () { saveFile('quiznote-my-questions.json', JSON.stringify({ app: 'quiznote-myq', v: 1, t: Date.now(), list: M.list })); } }));
    }
    root.append(top);
    if (!list.length) {
      root.append(h('div', { class: 'empty' }, h('p', { text: draft ? '문제가 하나도 없어요.' : '아직 만든 문제가 없어요.' }), h('p', { class: 'hint', text: '‘+ 새 문제 추가’를 눌러 첫 문제를 만들어 보세요. 객관식, OX, 직접 쓰는 단답을 만들 수 있어요.' })));
    } else {
      root.append(h('p', { class: 'hint', text: '문제 ' + list.length + '개' }), h('div', { class: 'list' }, list.map(mineRow)));
    }
    if (draft) {
      root.append(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', text: '다 고쳤어요. 풀러 가기', onclick: function () { go('make'); renderUnderstand(false); } })));
    } else if (list.length) {
      var cnt = h('select', { class: 'textin', id: 'mineCount', 'aria-label': '풀 문제 수' }, h('option', { value: '0', text: '전부' }), [5, 10, 20, 50].filter(function (n) { return n < list.length; }).map(function (n) { return h('option', { value: String(n), text: n + '문제' }); }));
      var shuf = h('input', { type: 'checkbox', id: 'mineShuffle', checked: true });
      var playable = h('p', { class: 'hint' });
      var refreshPlayable = function () {
        var ok = M.list.filter(typeOk).length;
        playable.textContent = ok ? '고른 종류로 풀 수 있는 문제: ' + ok + '개' : '고른 종류에 맞는 문제가 없어요. 종류를 바꿔 보세요.';
        var pb = $('btnPlayMine'); if (pb) pb.disabled = !ok;
      };
      var kinds = h('div', { class: 'seg', role: 'group', 'aria-label': '풀고 싶은 문제 종류' }, TYPE_LIST.filter(function (p) { return !a11y.easy || (p[0] !== 'short' && p[0] !== 'essay'); }).map(function (p) {
        var cb = h('input', { type: 'checkbox', checked: currentTypes().indexOf(p[0]) >= 0 ? true : null, onchange: function () {
          var mk = document.querySelector('input[name="t"][value="' + p[0] + '"]');
          if (mk) { mk.checked = cb.checked; mk.dispatchEvent(new Event('change')); }
          refreshPlayable();
        } });
        return h('label', {}, cb, h('span', { text: p[1] }));
      }));
      root.append(h('div', { class: 'sec minePlay' }, h('h3', { text: '내 문제 풀기' }),
        h('div', { class: 'ed-f' }, h('span', { class: 'lbl', text: '풀 문제 종류 (끈 종류는 안 나와요)' }), kinds, playable),
        h('div', { class: 'row' }, cnt, h('label', { class: 'chk' }, shuf, h('span', { text: '순서 섞기' }))),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', id: 'btnPlayMine', text: '내 문제 풀기', onclick: function () {
          var n = Number(cnt.value) || 0, ls = M.list.filter(typeOk).map(function (q) { return JSON.parse(JSON.stringify(q)); });
          if (shuf.checked) ls = shuffled(ls);
          if (n) ls = ls.slice(0, n);
          if (!ls.length) { alert0(noTypeMsg()); return; }
          startQuiz(ls, 'mine');
        } }))));
      refreshPlayable();
    }
  }
  function importMine(files) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    var added = 0, bad = 0;
    Promise.all(files.map(function (f) {
      return f.text().then(function (t) {
        var d = JSON.parse(t), arr = Array.isArray(d) ? d : (d && Array.isArray(d.list) ? d.list : null);
        if (!arr) throw new Error('bad');
        arr.forEach(function (x) {
          var q = sanitizeQ(x);
          if (!q) { bad++; return; }
          if (M.list.some(function (m) { return m.id === q.id; })) q = Object.assign(q, { id: uid8(), k: '' }), q.k = E.hash('my|' + q.id);
          M.list.push(q); added++;
        });
      }).catch(function () { bad++; });
    })).then(function () {
      saveMine(); renderMine();
      alert0(added + '개를 불러왔어요.' + (bad ? ' ' + bad + '개는 형식이 맞지 않아 건너뛰었어요.' : ''));
    });
  }
  $('btnEditDraft').addEventListener('click', function () { if (!pending) return; M.src = 'draft'; M.editing = null; M.delIdx = -1; go('mine'); });

  /* ---------- 시작 ---------- */
  setSrc(EXAMPLE, true);
  bindA11y(); applyA11y();
  updateAdminTab();
  if (isNative()) {
    $('ocrHint').textContent = '사진·스캔 PDF의 글자는 폰에 내장된 구글 글자 인식(ML Kit)이 읽어요. 인터넷이 필요 없어요. 읽은 글에 틀린 글자가 있으면 위 칸에서 고쳐 주세요.';
  }
  loadMe().then(reloadData).then(loadMine).then(function () {
    nameIn.value = me.name;
    applyTl();
    applyTypes();
    applyA11y();
    updateBadge();
    show(location.hash.slice(1) || 'make');
    updateCap();
    if (srcIsExample && !pending) autoMake(false);
  });
  show(location.hash.slice(1) || 'make');

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0 && !isNative()) {
    window.addEventListener('load', function () {
      var had = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('./sw.js').catch(function () { /* 설치 없이도 동작해요 */ });
      // 새 버전이 설치되면 풀고 있는 문제가 없을 때 한 번만 새로 불러와요
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!had) { had = true; return; }
        if (!Q.list.length && !sessionStorage.getItem('qn.reloaded')) { try { sessionStorage.setItem('qn.reloaded', '1'); } catch (e) { /* ignore */ } location.reload(); }
      });
    });
  }
})();
