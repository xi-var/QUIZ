(function () {
  'use strict';
  var E = window.QuizEngine;
  var CIRC = ['①', '②', '③', '④'];
  var EXAMPLE = '광합성이란 식물이 빛에너지를 이용해 이산화탄소와 물로 포도당을 만드는 과정이다. 광합성은 식물 세포 안의 엽록체에서 일어난다. 엽록체에는 엽록소라는 초록색 색소가 들어 있어 빛을 흡수한다. 뿌리에서 흡수한 물은 줄기를 지나 잎까지 이동한다. 이산화탄소는 잎의 기공을 통해 공기 중에서 들어온다. 광합성 결과 포도당과 산소가 만들어진다. 포도당은 식물의 생장에 필요한 에너지원으로 쓰이고 남은 양은 녹말로 저장된다. 산소는 기공을 통해 공기 중으로 방출된다. 빛의 세기가 강해지면 광합성량도 늘어나지만 일정한 세기를 넘으면 더 이상 증가하지 않는다. 이산화탄소 농도와 온도도 광합성량에 영향을 준다.';
  var PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var OCR_LANGS = 'kor+eng';

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
      var kids = [].concat(arguments[i]);
      kids.forEach(function (kid) {
        if (kid == null || kid === false) return;
        el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
      });
    }
    return el;
  }

  /* ---------- storage (오답노트는 이 기기의 브라우저에만 저장돼요) ---------- */
  var store = {
    mem: {},
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : (k in this.mem ? this.mem[k] : d); }
      catch (e) { return k in this.mem ? this.mem[k] : d; }
    },
    set: function (k, v) { this.mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  var NOTES_KEY = 'quiznote.notes.v1';
  var notes = store.get(NOTES_KEY, []);
  if (!Array.isArray(notes)) notes = [];

  /* ---------- views ---------- */
  var VIEWS = ['make', 'solve', 'notes'];
  function show(view) {
    if (VIEWS.indexOf(view) < 0) view = 'make';
    VIEWS.forEach(function (v) { $('view-' + v).hidden = v !== view; });
    document.querySelectorAll('.nav button').forEach(function (b) {
      if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (view === 'notes') renderNotes();
    if (view === 'solve' && !Q.list.length) renderSolveEmpty();
  }
  function go(view) {
    show(view);
    if (location.hash.slice(1) !== view) { try { location.hash = view; } catch (e) { /* ignore */ } }
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.nav button').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.view); }); });
  window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });

  function updateBadge() {
    var b = $('noteBadge');
    b.textContent = String(notes.length);
    b.hidden = notes.length === 0;
  }

  /* ---------- make: source ---------- */
  var src = $('src');
  var srcIsExample = true;
  function setSrc(t, example) { src.value = t; srcIsExample = !!example; updateCount(); }
  function updateCount() { $('count').textContent = src.value.length.toLocaleString('ko-KR') + '자'; }
  src.addEventListener('input', function () { srcIsExample = false; updateCount(); });
  setSrc(EXAMPLE, true);
  $('btnExample').addEventListener('click', function () { setSrc(EXAMPLE, true); status('read', '예시 글을 불러왔어요.'); });
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
  var ocr = { worker: null, cancel: null, cancelFn: null, onProgress: null };
  var LOG_KO = {
    'loading tesseract core': '인식 엔진을 불러오는 중…',
    'initializing tesseract': '인식 엔진을 준비하는 중…',
    'loading language traineddata': '한글 인식 데이터를 내려받는 중… (처음 한 번만, 수 MB)',
    'initializing api': '인식 준비 중…'
  };
  function newCancel() {
    ocr.cancel = new Promise(function (_, reject) { ocr.cancelFn = function () { reject({ code: 'cancelled' }); }; });
    ocr.cancel.catch(function () { /* handled where raced */ });
  }
  function race(p) { return Promise.race([p, ocr.cancel]); }
  async function getWorker() {
    if (!window.Tesseract) throw { code: 'notess' };
    if (ocr.worker) return ocr.worker;
    ocr.worker = await race(window.Tesseract.createWorker(OCR_LANGS, 1, {
      logger: function (m) {
        if (m.status === 'recognizing text') { if (ocr.onProgress) ocr.onProgress(m.progress); }
        else if (LOG_KO[m.status]) status('read', LOG_KO[m.status]);
      }
    }));
    return ocr.worker;
  }
  function stopOcr() {
    if (ocr.cancelFn) ocr.cancelFn();
    if (ocr.worker) { try { ocr.worker.terminate(); } catch (e) { /* ignore */ } ocr.worker = null; }
  }
  /* 큰 사진은 줄이고 작은 이미지는 키운 뒤 흑백으로 바꿔요. 인식이 빨라지고 정확해져요. */
  function toGrayCanvas(drawable, w, h2) {
    var longest = Math.max(w, h2), scale = 1;
    if (longest > 2200) scale = 2200 / longest; else if (longest < 1000) scale = Math.min(2, 1400 / longest);
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * scale)); cv.height = Math.max(1, Math.round(h2 * scale));
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(drawable, 0, 0, cv.width, cv.height);
    var img = ctx.getImageData(0, 0, cv.width, cv.height), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
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
  async function ocrCanvases(canvases, label) {
    var worker = await getWorker();
    var out = [];
    for (var i = 0; i < canvases.length; i++) {
      ocr.onProgress = function (p) { status('read', '글자를 읽는 중… ' + label + (canvases.length > 1 ? ' ' + (i + 1) + '/' + canvases.length : '') + ' · ' + Math.round(p * 100) + '%'); };
      status('read', '글자를 읽는 중… ' + label + (canvases.length > 1 ? ' ' + (i + 1) + '/' + canvases.length : ''));
      var res = await race(worker.recognize(canvases[i]));
      out.push(res.data.text);
    }
    return out.join('\n\n');
  }

  /* ---------- 파일 인식: PDF ---------- */
  async function pdfWorkerSrc() {
    try {
      var code = await (await fetch(PDF_WORKER)).text();
      return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    } catch (e) { return PDF_WORKER; }
  }
  async function readPdf(file) {
    if (!window.pdfjsLib) throw { code: 'nopdf' };
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
    if (!window.Tesseract) return { text: text, scan: true };
    // 글자가 거의 없으면 스캔본으로 보고 페이지를 그림으로 바꿔 인식해요.
    var n = Math.min(pdf.numPages, 15), canvases = [];
    for (var q = 1; q <= n; q++) {
      var pg = await pdf.getPage(q);
      var vp = pg.getViewport({ scale: 2 });
      var cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      canvases.push(toGrayCanvas(cv, cv.width, cv.height));
    }
    return { canvases: canvases, truncated: pdf.numPages > n };
  }

  $('file').addEventListener('change', async function (ev) {
    var files = Array.prototype.slice.call(ev.target.files || []);
    ev.target.value = '';
    if (!files.length) return;
    newCancel();
    $('stopRow').hidden = false;
    var extra = [];
    try {
      for (var i = 0; i < files.length; i++) {
        var f = files[i], name = f.name.toLowerCase();
        if (f.type.indexOf('image/') === 0) {
          status('read', '이미지를 준비하는 중… ' + f.name);
          var cv = await fileToCanvas(f);
          appendSource(await ocrCanvases([cv], f.name));
          continue;
        }
        if (name.slice(-4) === '.pdf' || f.type === 'application/pdf') {
          status('read', 'PDF를 읽는 중이에요…');
          var r = await race(readPdf(f));
          if (r.text) appendSource(r.text);
          if (r.canvases) {
            appendSource(await ocrCanvases(r.canvases, f.name));
            if (r.truncated) extra.push('스캔 PDF는 앞 15쪽만 읽었어요.');
          } else if (r.scan) extra.push('글자가 거의 없는 PDF예요. 사진으로 올리거나 글을 붙여 넣어 주세요.');
          continue;
        }
        if (/\.(txt|md)$/.test(name) || f.type.indexOf('text/') === 0) { appendSource(await f.text()); continue; }
        extra.push('‘' + f.name + '’은(는) 읽을 수 없는 형식이에요.');
      }
      status('read', ['글을 읽어 왔어요. 인식이 틀린 글자가 있을 수 있으니 위 칸에서 고쳐 주세요.'].concat(extra).join(' '));
    } catch (e) {
      var msg;
      if (e && e.code === 'cancelled') msg = '읽기를 멈췄어요.';
      else if (e && e.code === 'notess') msg = '글자 인식 도구를 불러오지 못했어요. 인터넷에 연결한 뒤 다시 해 주세요. 글 붙여넣기는 연결 없이도 돼요.';
      else if (e && e.code === 'nopdf') msg = 'PDF 읽기 도구를 불러오지 못했어요. 인터넷에 연결한 뒤 다시 해 주세요.';
      else msg = '파일을 읽지 못했어요. 다른 파일을 쓰거나 글을 붙여 넣어 주세요.';
      status('read', msg, true);
    } finally {
      $('stopRow').hidden = true;
      ocr.onProgress = null;
    }
  });
  $('btnStopRead').addEventListener('click', stopOcr);

  /* ---------- make: generate ---------- */
  var pending = null;
  function opt(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; }
  function selectedTypes() { return Array.prototype.map.call(document.querySelectorAll('input[name="t"]:checked'), function (x) { return x.value; }); }

  $('btnMake').addEventListener('click', function () {
    var text = src.value.trim();
    var n = Number(opt('n')) || 10, types = selectedTypes();
    $('understandSec').hidden = true; pending = null;
    if (text.length < 40) { status('gen', '자료가 너무 짧아요. 문장이 3개 이상 되도록 글을 넣어 주세요.', true); return; }
    if (!types.length) { status('gen', '문제 유형을 하나 이상 골라 주세요.', true); return; }
    var out = E.generate(text, { count: n, types: types, seed: (Date.now() % 1000003) });
    if (!out.questions.length) {
      status('gen', '문제로 만들 문장을 찾지 못했어요. 14자 이상인 문장이 더 필요해요.', true);
      return;
    }
    pending = { questions: out.questions, concepts: out.concepts, keySentences: out.keySentences };
    var short = out.questions.length < n ? ' (쓸 만한 문장이 ' + out.questions.length + '개라서 요청보다 적어요)' : '';
    status('gen', out.questions.length + '문제를 만들었어요.' + short);
    renderUnderstand();
  });

  function renderUnderstand() {
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
    var kinds = {};
    pending.questions.forEach(function (q) { kinds[q.type] = (kinds[q.type] || 0) + 1; });
    box.append(h('p', { class: 'hint', text: '만든 문제 ' + pending.questions.length + '개: ' + Object.keys(kinds).map(function (k) { return E.KIND_NAME[k] + ' ' + kinds[k]; }).join(', ') }));
    $('understandSec').hidden = false;
  }
  $('btnStart').addEventListener('click', function () { if (pending) startQuiz(pending.questions, 'make'); });

  /* ---------- solve ---------- */
  var Q = { list: [], i: 0, results: [], source: 'make', answered: false };
  function startQuiz(list, source) {
    Q = { list: list, i: 0, results: [], source: source, answered: false };
    go('solve');
    renderQ();
  }
  function renderSolveEmpty() {
    $('solveBody').replaceChildren(h('div', { class: 'empty' },
      h('p', { text: '풀 문제가 아직 없어요.' }),
      h('p', { class: 'hint', text: '만들기에서 자료를 넣고 문제를 만들면 여기서 풀 수 있어요.' }),
      h('div', { class: 'row', style: 'justify-content:center;margin-top:12px' }, h('button', { type: 'button', class: 'btn primary', text: '만들기로 가기', onclick: function () { go('make'); } }))));
  }

  function withBlanks(text) {
    var parts = String(text).split('____');
    var frag = document.createDocumentFragment();
    parts.forEach(function (p, i) {
      frag.append(document.createTextNode(p));
      if (i < parts.length - 1) frag.append(h('span', { class: 'blank', text: '    ' }));
    });
    return frag;
  }
  function answerLabel(q) {
    if (q.type === 'mc') return CIRC[q.answer] + ' ' + q.choices[q.answer];
    if (q.type === 'ox') return q.answer ? 'O' : 'X';
    return q.answer;
  }
  function givenLabel(q, g) {
    if (q.type === 'mc') return CIRC[g] + ' ' + q.choices[g];
    if (q.type === 'ox') return g ? 'O' : 'X';
    return String(g);
  }

  function renderQ() {
    var root = $('solveBody');
    root.replaceChildren();
    if (Q.i >= Q.list.length) return renderResult();
    var q = Q.list[Q.i];
    Q.answered = false;
    var pct = Math.round((Q.i / Q.list.length) * 100);
    var card = h('div', { class: 'qcard' });
    card.append(h('span', { class: 'kind', text: E.KIND_NAME[q.type] }));
    if (q.passage) card.append(h('div', { class: 'passage' }, withBlanks(q.passage)));
    card.append(h('p', { class: 'qtext', text: q.q }));

    var area = h('div', {});
    if (q.type === 'mc') {
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
    } else {
      area.className = 'short';
      var inp = h('input', { type: 'text', id: 'shortIn', autocomplete: 'off', placeholder: q.hint ? '정답 (' + q.hint + ')' : '정답', 'aria-label': '정답 입력' });
      var ok = h('button', { type: 'button', class: 'btn primary', text: '확인', onclick: function () { if (inp.value.trim()) submit(q, inp.value.trim()); } });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && inp.value.trim()) submit(q, inp.value.trim()); });
      area.append(inp, ok);
    }
    card.append(area, h('div', { id: 'fbSlot' }));

    root.append(
      h('div', { class: 'prog' }, h('span', { text: '문제 ' + (Q.i + 1) + ' / ' + Q.list.length }), h('div', { class: 'bar' }, h('i', { style: 'width:' + pct + '%' }))),
      card);
    var first = area.querySelector('input,button');
    if (first && q.type === 'short') first.focus();
  }

  function submit(q, given) {
    if (Q.answered) return;
    Q.answered = true;
    var ok = q.type === 'short' ? E.checkShort(given, q) : given === q.answer;
    Q.results.push({ q: q, given: given, ok: ok });
    if (!ok) addNote(q, given); else if (Q.source === 'notes') removeNote(q);

    var area = $('solveBody').querySelector('.choices,.oxrow,.short');
    if (q.type === 'mc') {
      area.querySelectorAll('.choice').forEach(function (b) {
        var k = Number(b.dataset.k);
        b.disabled = true;
        if (k === q.answer) b.classList.add('correct');
        else if (k === given) b.classList.add('wrong');
      });
    } else if (q.type === 'ox') {
      area.querySelectorAll('.choice').forEach(function (b) {
        var v = b.dataset.k === 'O';
        b.disabled = true;
        if (v === q.answer) b.classList.add('correct'); else if (v === given) b.classList.add('wrong');
      });
    } else {
      area.querySelectorAll('input,button').forEach(function (x) { x.disabled = true; });
    }

    var body = [];
    if (q.type === 'mc') {
      var f = ok ? '' : (q.feedback && q.feedback[given]) || '';
      if (f) body.push(h('p', { text: f }));
    }
    if (!ok) body.push(h('p', {}, '정답: ', h('b', { text: answerLabel(q) })));
    if (q.explain && !(q.type === 'short' && ok)) body.push(h('p', { text: q.explain }));
    if (q.evidence) body.push(h('div', { class: 'quote' }, h('b', { text: '본문 근거' }), q.evidence));
    var last = Q.i + 1 >= Q.list.length;
    var fb = h('div', { class: 'fb ' + (ok ? 'ok' : 'bad'), role: 'status' },
      h('h3', { text: ok ? '정답이에요' : '틀렸어요' }), body,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', id: 'btnNext', text: last ? '결과 보기' : '다음 문제', onclick: function () { Q.i++; renderQ(); window.scrollTo(0, 0); } })));
    $('fbSlot').append(fb);
    $('btnNext').focus({ preventScroll: true });
    fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function renderResult() {
    var root = $('solveBody');
    root.replaceChildren();
    var total = Q.results.length, right = Q.results.filter(function (r) { return r.ok; }).length;
    var wrong = Q.results.filter(function (r) { return !r.ok; });
    root.append(h('div', { class: 'view', style: 'margin-top:0' },
      h('div', { class: 'score' },
        h('div', { class: 'n' }, String(right), h('small', { text: ' / ' + total })),
        h('p', { class: 'hint', text: wrong.length ? '틀린 ' + wrong.length + '문제는 오답노트에 담았어요.' : '모두 맞혔어요.' })),
      wrong.length ? h('div', { class: 'list' }, wrong.map(function (r) {
        return h('div', { class: 'note' },
          r.q.passage ? h('div', { class: 'passage' }, withBlanks(r.q.passage)) : null,
          h('p', { class: 'qtext', text: r.q.q }),
          h('p', { class: 'mine' }, '내 답 ', h('span', { class: 'x', text: givenLabel(r.q, r.given) }), ' → 정답 ', h('span', { class: 'o', text: answerLabel(r.q) })));
      })) : null,
      h('div', { class: 'row' },
        wrong.length ? h('button', { type: 'button', class: 'btn primary', text: '틀린 문제 다시 풀기', onclick: function () { startQuiz(wrong.map(function (r) { return r.q; }), Q.source); } }) : null,
        h('button', { type: 'button', class: 'btn', text: '오답노트', onclick: function () { go('notes'); } }),
        h('button', { type: 'button', class: 'btn', text: '새로 만들기', onclick: function () { go('make'); } }))));
    window.scrollTo(0, 0);
  }

  /* ---------- notes ---------- */
  function noteKey(q) { return E.normForMatch((q.passage || '') + '|' + q.q + '|' + (q.type === 'mc' ? q.choices.join(',') : '')); }
  function addNote(q, given) {
    var k = noteKey(q);
    notes = notes.filter(function (n) { return n.k !== k; });
    var copy = JSON.parse(JSON.stringify(q));
    notes.unshift({ k: k, q: copy, given: given, t: Date.now() });
    notes = notes.slice(0, 200);
    store.set(NOTES_KEY, notes); updateBadge();
  }
  function removeNote(q) {
    var k = noteKey(q);
    notes = notes.filter(function (n) { return n.k !== k; });
    store.set(NOTES_KEY, notes); updateBadge();
  }
  var confirmClear = false;
  function renderNotes() {
    var root = $('notesBody');
    root.replaceChildren();
    updateBadge();
    if (!notes.length) {
      root.append(h('div', { class: 'empty' }, h('p', { text: '아직 틀린 문제가 없어요.' }), h('p', { class: 'hint', text: '문제를 풀다 틀리면 여기에 모여요. 다시 풀어서 맞히면 노트에서 빠져요.' })));
      return;
    }
    var view = h('div', { class: 'view', style: 'margin-top:0' });
    view.append(h('div', { class: 'row between' },
      h('h2', { class: 'sec-h', text: '틀린 문제 ' + notes.length + '개' }),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn primary', text: '오답 풀기', onclick: function () { startQuiz(notes.slice(0, 15).map(function (n) { return n.q; }), 'notes'); } }),
        confirmClear
          ? h('button', { type: 'button', class: 'btn danger', text: '정말 모두 지울까요?', onclick: function () { notes = []; store.set(NOTES_KEY, notes); confirmClear = false; renderNotes(); } })
          : h('button', { type: 'button', class: 'btn', text: '모두 지우기', onclick: function () { confirmClear = true; renderNotes(); } }))));
    view.append(h('div', { class: 'list' }, notes.map(function (n) {
      var q = n.q, d = new Date(n.t);
      return h('div', { class: 'note' },
        h('div', { class: 'meta' }, h('span', { class: 'kind', text: E.KIND_NAME[q.type] }), h('span', { text: (d.getMonth() + 1) + '월 ' + d.getDate() + '일' })),
        q.passage ? h('div', { class: 'passage' }, withBlanks(q.passage)) : null,
        h('p', { class: 'qtext', text: q.q }),
        h('p', { class: 'mine' }, '내 답 ', h('span', { class: 'x', text: givenLabel(q, n.given) }), ' → 정답 ', h('span', { class: 'o', text: answerLabel(q) })),
        h('details', {}, h('summary', { text: '해설 보기' }),
          h('div', { style: 'display:grid;gap:8px;margin-top:8px' },
            q.type === 'mc' && q.feedback && q.feedback[n.given] ? h('p', { text: q.feedback[n.given] }) : null,
            q.explain ? h('p', { text: q.explain }) : null,
            q.evidence ? h('div', { class: 'quote' }, h('b', { text: '본문 근거' }), q.evidence) : null)),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', text: '노트에서 빼기', onclick: function () { removeNote(q); renderNotes(); } })));
    })));
    root.append(view);
  }

  updateBadge();
  show(location.hash.slice(1) || 'make');

  /* ---------- 앱처럼 설치 (PWA) ---------- */
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () { /* 설치 없이도 동작해요 */ }); });
  }
})();
