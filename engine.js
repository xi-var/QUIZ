(function (root) {
  'use strict';

  var PARTICLES = ['에서는','에서도','으로는','으로도','에게는','으로써','으로서','까지는','부터는','이라는','이라고','라는','에서','으로','에게','까지','부터','라고','처럼','보다','마다','에는','에도','이나','이며','이고','이란','와는','과는','은','는','이','가','을','를','의','에','로','와','과','도','만','란']
    .sort(function (a, b) { return b.length - a.length; });
  var STOP_KO = new Set(['그','이','저','것','수','등','및','또는','그리고','하지만','그러나','따라서','때문','경우','이후','이전','대한','통해','위해','매우','가장','주로','더','또','다른','같은','모든','각','여러','어떤','이런','그런','우리','때','중','안','위','아래','다음','먼저','이상','이하','정도','하나','가지','사이','결과','내용','부분','방법','문제','시간','일정','영향','다시','이미','아직','바로','함께','모두','어떻게','무엇','만드','이루','일으','나타','늘어','줄어','높아','낮아','커지','작아','강해','약해','이용','사용','필요','너무','아주','조금','많이','빨리','천천히','과도','충분','생기','생겨','곱게','굵게','알맞','보통','오래']);
  var STOP_EN = new Set(['the','and','for','are','but','not','you','all','any','can','had','her','was','one','our','out','has','have','this','that','with','from','they','will','would','there','their','what','which','when','who','how','been','were','also','into','than','then','them','these','those','its','his','she','him','may','such','more','most','other','some','only','over','very']);
  var NONE = '정답 없음';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36);
  }
  function batchimOf(word) {
    var c = word.charCodeAt(word.length - 1);
    if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28;
    var ch = word.charAt(word.length - 1);
    return /[0-9]/.test(ch) && '013678'.indexOf(ch) >= 0 ? 1 : 0;
  }
  // 문장 끝 서술어만 반대로 바꿔요: ~이다 → ~이 아니다, ~있다 → ~없다, ~한다 → ~하지 않는다 …
  // 항상 말이 되는 틀린 문장이 나오게, 아래 규칙에 맞는 문장 끝만 바꿔요.
  function negate(sentence) {
    var m = /^(.*?)([.!?。]*)$/.exec(sentence.trim()), core = m[1], tail = m[2] || '.';
    if (!/다$/.test(core) || /(었다|았다|였다|했다|겠다)$/.test(core)) return null;
    var body;
    if (/이다$/.test(core)) {
      var pre = core.slice(0, -2);
      if (!pre || /이라고 한다$/.test(core)) return null;
      body = /적$/.test(pre) ? pre + '이지 않다' : pre + (batchimOf(pre) ? '이' : '가') + ' 아니다';
    } else if (/있다$/.test(core)) body = core.slice(0, -2) + '있지 않다';
    else if (/없다$/.test(core)) body = core.slice(0, -2) + '있다';
    else if (/[가-힣]는다$/.test(core)) body = core.slice(0, -2) + '지 않는다';
    else {
      var last = core.charCodeAt(core.length - 2);
      if (last >= 0xAC00 && last <= 0xD7A3 && (last - 0xAC00) % 28 === 4) {   // ㄴ받침 + 다: 한다, 만든다, 된다 …
        var fixed = core.charAt(core.length - 2) === '든' ? '들' : String.fromCharCode(last - 4);   // 만든다 → 만들지
        body = core.slice(0, -2) + fixed + '지 않는다';
      } else if (/하다$/.test(core)) body = core.slice(0, -2) + '하지 않다';
      else if (/[가-힣]다$/.test(core) && core.length > 3) body = core.slice(0, -1) + '지 않다';
      else return null;
    }
    return body + tail;
  }
  function josa(word, pair) { return batchimOf(word) ? pair.charAt(0) : pair.charAt(1); }

  /* ---------- 글 정리: 줄바꿈으로 잘린 문장을 이어 붙이고 쪽 번호, 머리말을 지워요 ---------- */
  function endsSentence(l) {
    return /[.!?。？！…]["'”’)\]」』]*$/.test(l) || /(다|요|함|음|임|됨)$/.test(l);
  }
  function cleanText(text) {
    var t = String(text || '').replace(/\r/g, '').replace(/[ \t]/g, ' ').replace(/ {2,}/g, ' ');
    var lines = t.split('\n').map(function (l) { return l.trim(); });
    lines = lines.filter(function (l) {
      return !(/^[-–—\s]*\d{1,4}[-–—\s]*$/.test(l) || /^\d{1,4}\s*\/\s*\d{1,4}$/.test(l) || /^(page|p\.)\s*\d+$/i.test(l));
    });
    var freq = {};
    lines.forEach(function (l) { if (l.length >= 4 && l.length <= 40) freq[l] = (freq[l] || 0) + 1; });
    lines = lines.filter(function (l) { return !(freq[l] >= 3 && !endsSentence(l)); });
    var out = [], cur = '', last = '';
    function flush() { if (cur) { out.push(cur); cur = ''; } }
    var listRe = /^([-•·*▪■□◆◇○●]|\d{1,2}[.)]|[①-⑳]|[가-하][.)])\s*/;
    lines.forEach(function (l) {
      if (!l) { flush(); last = ''; return; }
      if (!cur) { cur = l; last = l; return; }
      var heading = cur === last && last.length <= 14 && last.split(' ').length <= 2 && !endsSentence(last) && !/(은|는|이|가|을|를|의|에|로|와|과|도|서|며|고|인|한|는데|라는|하는|에서|으로|에게)$/.test(last);
      if (endsSentence(cur) || listRe.test(l) || heading) { flush(); cur = l; }
      else cur += ' ' + l;
      last = l;
    });
    flush();
    return out.join('\n');
  }
  function splitSentences(text) {
    return cleanText(text)
      .replace(/([.!?。？！])\s+/g, '$1\n')
      .split(/\n+/)
      .map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
      .filter(function (s) { return s.length >= 10; });
  }

  var stemMemo = new Map();
  function stemOf(tok) {
    var key = String(tok), hit = stemMemo.get(key);
    if (hit !== undefined) return hit;
    var r = stemOfRaw(key);
    if (stemMemo.size > 50000) stemMemo.clear();
    stemMemo.set(key, r);
    return r;
  }
  function stemOfRaw(tok) {
    var t = String(tok).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!t) return null;
    if (/^[A-Za-z][A-Za-z\-']*$/.test(t)) return t;
    for (var i = 0; i < PARTICLES.length; i++) {
      var p = PARTICLES[i];
      var minLeft = 1;
      if (t.length - p.length >= minLeft && t.slice(-p.length) === p) return t.slice(0, -p.length);
    }
    return t;
  }
  function kindOf(s) {
    if (/^[A-Za-z]/.test(s)) return 'en';
    if (/^\d/.test(s)) return 'num';
    return 'ko';
  }
  function isCandidate(s) {
    if (!s) return false;
    if (/^[A-Za-z][A-Za-z\-']*$/.test(s)) return s.length >= 3 && !STOP_EN.has(s.toLowerCase());
    if (/^\d[\d,.]*(%|퍼센트|년|월|일|개|명|원|배|도|℃|km|kg|cm|mm|ml|m|g|L)?$/i.test(s)) return s.length >= 2;
    if (!/^[\p{Script=Hangul}\p{N}A-Za-z]+$/u.test(s)) return false;
    if (s.length < 2 || s.length > 10) return false;
    if (STOP_KO.has(s)) return false;
    if (/(다|요|니다|하고|하며|하여|해서|하는|되는|있는|없는|같은|위한|통해|대해|때문|그리고|하지만|그러나|으로|에서|으면|려면|하면|되면|나지|하지|되지|않는|지만|는데)$/.test(s)) return false;
    if (s.length >= 3 && /(한|된|할|될|적|게|면)$/.test(s)) return false;
    if (/(수록|시켜|어서|여서|져서|해서|워서|들고|르고|으며|스럽고)$/.test(s)) return false;
    if (s.length >= 3 && /고$/.test(s) && !/(냉장|저장|보관|창|금|분리|연구|보호)고$/.test(s)) return false;
    if (/(거운|가운|로운|스러운|올린|내린|들린|물린|돌린|걸린|열린|닫힌|놓인|넣은|굵은|고운)$/.test(s)) return false;
    if (/^(곱|굵|크|작|높|낮|많|적|길|짧|세|약하|강하|빠르|느리|얇|두껍|뜨겁|차갑)게$/.test(s)) return false;
    if (/^(넣|쓰|많|적|크|작|높|낮|굵|곱|빠르|느리|강하|약하|뜨겁|차갑|맑|진하|연하)고$/.test(s)) return false;
    if (/(어|아|여|며|에|드|나드)$/.test(s) && !/^(언어|영어|단어|국어|외국어|한국어|모국어|소수|분자|원자)$/.test(s)) return false;
    return true;
  }
  function tokensOf(sentence) {
    var out = [], re = /[^\s,;:()\[\]{}"'“”‘’·…\/]+/g, m;
    while ((m = re.exec(sentence))) out.push({ raw: m[0], stem: stemOf(m[0]), index: m.index });
    return out;
  }
  function fixParticle(rest, repl) {
    var m = /^(.*?)([.!?。,]*)$/.exec(rest), core = m[1], tail = m[2], b = batchimOf(repl);
    var pairs = [['은', '는'], ['이', '가'], ['을', '를'], ['과', '와']];
    for (var i = 0; i < pairs.length; i++) {
      if (core === pairs[i][0] || core === pairs[i][1]) return (b ? pairs[i][0] : pairs[i][1]) + tail;
    }
    if (core === '이란' || core === '란') return (b ? '이란' : '란') + tail;
    if (core === '으로' || core === '로') return (b && b !== 8 ? '으로' : '로') + tail;
    return rest;
  }
  function replaceTerm(sentence, target, repl, tokens) {
    var toks = tokens || tokensOf(sentence), out = '', last = 0, blank = repl === '____';
    toks.forEach(function (t) {
      if (t.stem === target) {
        var p = t.raw.indexOf(target);
        if (p < 0) return;
        out += sentence.slice(last, t.index + p) + repl;
        if (blank) { last = t.index + p + target.length; }
        else { out += fixParticle(t.raw.slice(p + target.length), repl); last = t.index + t.raw.length; }
      }
    });
    return out + sentence.slice(last);
  }
  function trunc(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function normForMatch(s) { return String(s || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, ''); }
  function checkShort(given, q) {
    var raw = String(given || '').trim();
    if (!raw) return false;
    var forms = [normForMatch(raw)], st = stemOf(raw);
    if (st) forms.push(normForMatch(st));
    var list = [q.answer].concat(q.accept || []).map(normForMatch);
    return forms.some(function (f) { return f && list.indexOf(f) >= 0; });
  }

  // 서술형: 내 답에 핵심어가 몇 개 들어 있는지 세어요. (뜻을 이해해서 채점하는 게 아니라 단어 포함 여부만 봐요)
  function essayCheck(given, q) {
    var g = normForMatch(given), kws = (q && q.keywords) || [], hit = [], miss = [];
    kws.forEach(function (k) {
      var n = normForMatch(k), st = normForMatch(stemOf(k) || k);
      if ((n && g.indexOf(n) >= 0) || (st.length >= 2 && g.indexOf(st) >= 0)) hit.push(k); else miss.push(k);
    });
    return { hit: hit, miss: miss, ratio: kws.length ? hit.length / kws.length : 0 };
  }

  // 서술형 채점 기준 (핵심어가 들어간 비율): 75% 이상 정답 · 60% 이상 비슷해요(정답 처리) · 40% 이상 조금 달라요 · 그 미만 괜찮아요(오답 처리)
  function essayGrade(given, q) {
    var c = essayCheck(given, q), total = ((q && q.keywords) || []).length, h = c.hit.length;
    var level = !total ? 'low' : h * 100 >= 75 * total ? 'full' : h * 100 >= 60 * total ? 'close' : h * 100 >= 40 * total ? 'partial' : 'low';
    return { hit: c.hit, miss: c.miss, total: total, pct: total ? Math.round(h * 100 / total) : 0, level: level, ok: level === 'full' || level === 'close' };
  }

  var analyzeMemo = { text: null, A: null };
  function analyze(text) {
    if (analyzeMemo.text === text && analyzeMemo.A) return analyzeMemo.A;
    var A = analyzeRaw(text);
    analyzeMemo.text = text; analyzeMemo.A = A;
    return A;
  }
  function analyzeRaw(text) {
    var sentences = splitSentences(text);
    var toks = sentences.map(tokensOf);
    var counts = new Map();
    toks.forEach(function (ts) {
      ts.forEach(function (t) {
        if (t.stem && isCandidate(t.stem)) counts.set(t.stem, (counts.get(t.stem) || 0) + 1);
      });
    });
    var defRe = /^(.{2,30}?)(이란|란|은|는)\s(.{6,}?)(이다|말한다|뜻한다|의미한다|부른다|한다)\.?$/;
    var defs = [], defTerms = new Set();
    sentences.forEach(function (s, i) {
      var m = defRe.exec(s);
      if (!m) return;
      var parts = m[1].trim().split(' ');
      if (parts.length > 2) return;
      var term = stemOf(parts[parts.length - 1]);
      if (term && isCandidate(term)) { defTerms.add(term); defs.push({ term: term, sentence: s, index: i }); }
    });
    var terms = [], termMap = new Map();
    counts.forEach(function (count, term) {
      var kind = kindOf(term);
      var score = count * 2 + (kind === 'ko' && term.length >= 3 && term.length <= 6 ? 1 : 0) + (kind === 'num' ? 1 : 0) + (defTerms.has(term) ? 3 : 0);
      var info = { term: term, count: count, score: score, kind: kind };
      terms.push(info); termMap.set(term, info);
    });
    terms.sort(function (a, b) { return b.score - a.score || b.count - a.count; });
    var sentTerms = toks.map(function (ts) {
      var set = new Set();
      ts.forEach(function (t) { if (t.stem && termMap.has(t.stem)) set.add(t.stem); });
      return set;
    });
    var termSents = new Map();
    sentTerms.forEach(function (set, i) { set.forEach(function (t) { var a = termSents.get(t); if (a) a.push(i); else termSents.set(t, [i]); }); });
    return { sentences: sentences, toks: toks, terms: terms, termMap: termMap, sentTerms: sentTerms, termSents: termSents, defs: defs };
  }

  var KIND_NAME = { mc: '빈칸 객관식', ox: 'OX', short: '단답', essay: '서술형' };

  function candidateItems(A, boost, maxLen) {
    var items = [];
    A.sentences.forEach(function (s, i) {
      if (s.length < 14 || s.length > (maxLen || 150)) return;
      var ts = A.toks[i];
      if (ts.length < 4) return;
      var seen = {}, cands = [];
      ts.forEach(function (t) {
        var info = t.stem && A.termMap.get(t.stem);
        if (info && !seen[t.stem]) { seen[t.stem] = 1; cands.push(info); }
      });
      cands.sort(function (a, b) { return b.score - a.score; });
      cands.slice(0, 4).forEach(function (info, rank) {
        items.push({ i: i, s: s, target: info.term, score: info.score + (boost[info.term] || 0) * 2 - rank * 3, kind: info.kind });
      });
    });
    return items;
  }

  /* 이 글로 만들 수 있는 문제 수(대략). 같은 문장·핵심어도 유형을 바꾸면 다시 쓸 수 있어요. */
  function capacity(text, typeCount, easy) {
    var A = analyze(text), items = candidateItems(A, {}, easy ? 70 : 150);
    if (easy && !items.length) items = candidateItems(A, {}, 150);
    return Math.min(1000, items.length * Math.max(1, typeCount || 3));
  }

  function generate(text, opts) {
    opts = opts || {};
    var count = Math.max(1, Math.min(opts.count || 10, 1000));
    var types = (opts.types && opts.types.length ? opts.types : ['mc', 'ox', 'short']).slice();
    if (opts.easy) { types = types.filter(function (t) { return t !== 'essay'; }); if (!types.length) types = ['mc', 'ox']; }
    var rnd = mulberry32(opts.seed == null ? 1 : opts.seed);
    var A = analyze(text);
    var easy = !!opts.easy;
    var items = candidateItems(A, opts.boost || {}, easy ? 70 : 150);
    if (easy && !items.length) items = candidateItems(A, opts.boost || {}, 150);

    var ranked = items.map(function (it) { return { it: it, k: it.score + rnd() * 2 }; })
      .sort(function (a, b) { return b.k - a.k; }).map(function (x) { return x.it; });
    var cap = ranked.length;

    function distractors(item, n, exclude) {
      var pool = [], T = A.terms, here = A.sentTerms[item.i];
      for (var ti = 0; ti < T.length && pool.length < 160; ti++) {
        var t0 = T[ti];
        if (t0.kind === item.kind && t0.term !== item.target && !here.has(t0.term) &&
          t0.term.indexOf(item.target) < 0 && item.target.indexOf(t0.term) < 0 && (!exclude || exclude.indexOf(t0.term) < 0)) pool.push(t0);
      }
      if (pool.length < n) return null;
      pool.sort(function (a, b) {
        return Math.abs(a.term.length - item.target.length) - Math.abs(b.term.length - item.target.length) || b.score - a.score;
      });
      return shuffle(pool.slice(0, 8), rnd).slice(0, n).map(function (t) { return t.term; });
    }
    function nearMiss(item) {
      var pool = [], T = A.terms, here = A.sentTerms[item.i];
      for (var ti = 0; ti < T.length && pool.length < 40; ti++) {
        var t0 = T[ti];
        if (t0.kind === item.kind && t0.term !== item.target && !here.has(t0.term) &&
          t0.term.indexOf(item.target) < 0 && item.target.indexOf(t0.term) < 0) pool.push(t0);
      }
      if (!pool.length) return null;
      var tc = item.target.split('');
      var best = null, bs = -1e9;
      pool.forEach(function (t) {
        var shared = 0; t.term.split('').forEach(function (c) { if (tc.indexOf(c) >= 0) shared++; });
        var s = shared * 2 + (t.term.charAt(0) === item.target.charAt(0) ? 3 : 0) - Math.abs(t.term.length - item.target.length) + t.score * 0.1;
        if (s > bs) { bs = s; best = t.term; }
      });
      return best;
    }
    function whereUsed(term, exceptIdx) {
      var idx = A.termSents.get(term);
      if (idx) for (var i = 0; i < idx.length; i++) if (idx[i] !== exceptIdx) return A.sentences[idx[i]];
      return null;
    }
    function wrongNote(c, item) {
      var u = whereUsed(c, item.i);
      return '‘' + c + '’' + josa(c, '은는') + ' ' + (u ? '본문의 “' + trunc(u, 60) + '” 같은 다른 문장에 나오는 말이라 이 빈칸에는 맞지 않아요.' : '이 문장의 내용과 맞지 않아요.');
    }
    function base(item, type) {
      return { type: type, target: item.target, evidence: item.s, source: 'rule', k: hash(type + '|' + item.s + '|' + item.target) };
    }

    function buildMC(item, withNone, fewer) {
      var d = distractors(item, fewer ? (withNone ? 1 : 2) : (withNone ? 2 : 3));
      if (!d) return null;
      var choices = shuffle([item.target].concat(d), rnd);
      var answer = choices.indexOf(item.target);
      if (withNone) choices.push(NONE);
      var feedback = choices.map(function (c, k) {
        if (k === answer) return '정답이에요.';
        if (c === NONE) return '본문에 맞는 말이 있어서 ‘정답 없음’은 아니에요. 정답은 ‘' + item.target + '’이에요.';
        return wrongNote(c, item);
      });
      var q = base(item, 'mc');
      q.q = '빈칸에 들어갈 알맞은 말은?'; q.passage = replaceTerm(item.s, item.target, '____', A.toks[item.i]);
      q.choices = choices; q.answer = answer; q.feedback = feedback;
      q.explain = '정답은 ‘' + item.target + '’이에요.';
      return q;
    }
    /* 함정 문제: 문제는 그대로 두고, 진짜 답 대신 비슷해 보이는 말만 보기에 넣어요. 정답은 '정답 없음'이에요. */
    function buildTrick(item, fewer) {
      var near = nearMiss(item);
      if (!near) return null;
      var others = fewer ? [] : distractors(item, 2, [near]);
      if (!others) return null;
      var firstThree = shuffle([near].concat(others), rnd);
      if (fewer) { var one = distractors(item, 1, [near]); if (!one) return null; firstThree = shuffle([near].concat(one), rnd); }
      var choices = firstThree.concat([NONE]);
      var feedback = choices.map(function (c) {
        if (c === NONE) return '맞아요. 본문의 정답은 ‘' + item.target + '’인데 보기에 없어서 ‘정답 없음’이 정답이에요.';
        if (c === near) return '‘' + c + '’' + josa(c, '은는') + ' 본문의 ‘' + item.target + '’과(와) 비슷해 보이지만 다른 말이에요.';
        return wrongNote(c, item);
      });
      var q = base(item, 'mc');
      q.k = hash('trick|' + item.s + '|' + item.target);
      q.trick = true;
      q.q = '빈칸에 들어갈 알맞은 말은?'; q.passage = replaceTerm(item.s, item.target, '____', A.toks[item.i]);
      q.choices = choices; q.answer = choices.length - 1; q.feedback = feedback;
      q.explain = '본문의 진짜 답은 ‘' + item.target + '’이에요. 보기에는 비슷한 말만 있어서 ‘정답 없음’이 정답이에요.';
      return q;
    }
    function buildShort(item) {
      var q = base(item, 'short');
      q.q = '빈칸에 알맞은 말을 쓰세요.'; q.passage = replaceTerm(item.s, item.target, '____', A.toks[item.i]);
      q.answer = item.target; q.hint = item.target.length + '글자';
      q.explain = '정답은 ‘' + item.target + '’이에요.';
      return q;
    }
    // 서술형: 핵심 문장을 모범답안으로 두고, 문장 속 다른 핵심어를 채점 기준으로 삼아요. 핵심어가 2개 미만이면 만들지 않아요.
    function buildEssay(item) {
      if (item.s.length < 20) return null;
      var ts = Array.from(A.sentTerms[item.i] || []).filter(function (t) { return A.termMap.get(t); });
      var top = ts.slice().sort(function (a, b) { return A.termMap.get(b).score - A.termMap.get(a).score; })[0];
      if (top !== item.target) return null;   // 문장의 주제어로만 물어봐요 (엉뚱한 단어를 묻지 않게)
      var kws = Array.from(A.sentTerms[item.i] || []).filter(function (t) { return t !== item.target && A.termMap.get(t); })
        .sort(function (a, b) { return A.termMap.get(b).score - A.termMap.get(a).score; }).slice(0, 5);
      if (kws.length < 2) return null;
      var isDef = A.defs.some(function (d) { return d.index === item.i && d.term === item.target; });
      var q = base(item, 'essay');
      q.k = hash('essay|' + item.s + '|' + item.target);
      q.q = '‘' + item.target + '’' + (isDef ? (batchimOf(item.target) ? '이란' : '란') + ' 무엇인지 본문 내용을 바탕으로 설명하세요.' : '에 대해 본문에서 설명한 내용을 쓰세요.');
      q.model = item.s; q.answer = item.s; q.keywords = kws; q.evidence = '';
      q.explain = '모범답안과 내 답을 비교해 보세요. 핵심어: ' + kws.join(', ');
      return q;
    }
    // OX의 틀린 문장에 쓸 말을 고르는 규칙: 말이 되는 자리에만 바꿔 넣어요.
    //  ① 같은 종류의 말이고 ② 글 속에서 같은 조사(은/는, 을/를, 에 …)와 함께 쓰인 적이 있고
    //  ③ 그 말이 나온 문장이 이 문장과 겹치는 핵심어가 2개 이상일 때만 써요. 없으면 맞는 문장(O)으로 내요.
    function particleClass(raw, term) {
      var p = raw.indexOf(term);
      var tail = (p < 0 ? '' : raw.slice(p + term.length)).replace(/[.!?。,]+$/, '');
      if (!tail) return '-';
      if (tail === '은' || tail === '는' || tail === '이' || tail === '가') return 'S';
      if (tail === '을' || tail === '를') return 'O';
      if (tail === '과' || tail === '와') return 'C';
      if (tail === '로' || tail === '으로') return 'R';
      return tail;
    }
    function classesIn(si, term) {
      var out = {};
      A.toks[si].forEach(function (t) { if (t.stem === term) out[particleClass(t.raw, term)] = 1; });
      return out;
    }
    function neighborsOf(si, term) {
      var out = {}, ts = A.toks[si];
      ts.forEach(function (t, j) {
        if (t.stem !== term) return;
        if (ts[j + 1]) out['n:' + ts[j + 1].raw.replace(/[.!?。,]+$/, '')] = 1;
        if (j > 0) out['p:' + ts[j - 1].raw.replace(/[.!?。,]+$/, '')] = 1;
      });
      return out;
    }
    function unitOf(term) { var m = /[^\d,.\s]+$/.exec(term); return m ? m[0] : ''; }
    function safeSwap(item) {
      var want = classesIn(item.i, item.target), wantNb = neighborsOf(item.i, item.target), here = A.sentTerms[item.i], T = A.terms, best = [], scanned = 0;
      for (var ti = 0; ti < T.length && scanned < 400; ti++) {
        var t0 = T[ti];
        if (t0.kind !== item.kind || t0.term === item.target || here.has(t0.term)) continue;
        if (t0.term.indexOf(item.target) >= 0 || item.target.indexOf(t0.term) >= 0) continue;
        scanned++;
        if (item.kind === 'num' && unitOf(t0.term) !== unitOf(item.target)) continue;
        var sents = A.termSents.get(t0.term) || [], okSlot = false, shared = 0, nb = false;
        for (var k = 0; k < sents.length && k < 12; k++) {
          var cl = classesIn(sents[k], t0.term);
          if (!okSlot) Object.keys(cl).forEach(function (c) { if (want[c]) okSlot = true; });
          if (!nb) Object.keys(neighborsOf(sents[k], t0.term)).forEach(function (x) { if (wantNb[x]) nb = true; });
          var c2 = 0; A.sentTerms[sents[k]].forEach(function (x) { if (x !== t0.term && x !== item.target && here.has(x)) c2++; });
          if (c2 > shared) shared = c2;
        }
        if (item.kind !== 'num' && (!okSlot || shared < 2 || !nb)) continue;
        if (item.kind === 'num' && !okSlot) continue;
        best.push({ term: t0.term, shared: shared });
      }
      if (!best.length) return null;
      best.sort(function (a, b) { return b.shared - a.shared; });
      return best.slice(0, 3)[Math.floor(rnd() * Math.min(3, best.length))].term;
    }
    // 숫자는 단위를 그대로 두고 값만 바꾸면 항상 말이 돼요 (예: 90도 → 80도)
    function fakeNumber(item) {
      var m = /^(\d[\d,]*)(.*)$/.exec(item.target);
      if (item.kind !== 'num' || !m) return null;
      var v = Number(m[1].replace(/,/g, ''));
      if (!isFinite(v) || v <= 0) return null;
      var step = v >= 100 ? 10 : v >= 20 ? 5 : 1, cand = [v + step * (1 + Math.floor(rnd() * 3)), v - step * (1 + Math.floor(rnd() * 2))].filter(function (x) { return x > 0 && x !== v; });
      // 같은 문장에 같은 단위의 다른 숫자가 있으면(예: 90도에서 95도) 순서가 뒤집히거나 같아지지 않게 해요
      var others = [], mine = -1;
      A.toks[item.i].forEach(function (t, j) {
        var mm = /^(\d[\d,]*)(도|초|기압|%|퍼센트|년|월|일|개|명|원|배|℃|km|kg|cm|mm|ml|m|g|L)?/i.exec(t.raw || '');
        if (!mm) return;
        if (t.stem === item.target) { if (mine < 0) mine = j; return; }
        if ((mm[2] || '') === unitOf(item.target)) others.push({ j: j, v: Number(mm[1].replace(/,/g, '')) });
      });
      if (others.length) {
        var lo = Math.min.apply(null, others.map(function (o) { return o.v; })), hi = Math.max.apply(null, others.map(function (o) { return o.v; }));
        cand = cand.filter(function (x) { return others.every(function (o) { return x !== o.v; }) && (others[0].j > mine ? x < lo : x > hi); });
      }
      if (!cand.length) return null;
      return String(cand[Math.floor(rnd() * cand.length)]) + m[2];
    }
    function buildOX(item) {
      var q = base(item, 'ox');
      q.q = '다음 설명이 본문 내용과 맞으면 O, 틀리면 X를 고르세요.';
      if (rnd() < 0.5) {
        var opts2 = [], sw = safeSwap(item) || fakeNumber(item);
        if (sw) {
          var st = replaceTerm(item.s, item.target, sw, A.toks[item.i]);
          if (st !== item.s) opts2.push({ stmt: st, why: '‘' + sw + '’이(가) 아니라 ‘' + item.target + '’이(가) 맞아요.', key: item.target });
        }
        var ng = negate(item.s);
        if (ng && ng !== item.s) opts2.push({ stmt: ng, why: '끝부분이 반대로 바뀌었어요. 본문의 뜻은 원래 문장 그대로예요.', key: 'neg' });
        if (opts2.length) {
          var pick = opts2[Math.floor(rnd() * opts2.length)];
          q.passage = pick.stmt; q.answer = false;
          q.explain = '본문에는 “' + item.s + '”라고 나와 있어요. ' + pick.why;
          q.k = hash('ox-false|' + item.s + '|' + pick.key);
          return q;
        }
      }
      q.passage = item.s; q.answer = true; q.explain = '본문에 같은 내용이 나와 있어요.';
      return q;
    }

    var slots = [];
    for (var r = 0; r < types.length && slots.length < count; r++) {
      for (var idx = 0; idx < cap && slots.length < count; idx++) slots.push({ item: ranked[idx], type: types[(idx + r) % types.length], r: r });
    }
    slots.sort(function (a, b) { return a.item.i - b.item.i || a.r - b.r; });

    var every = opts.trickEvery == null ? 10 : Math.max(0, Math.floor(opts.trickEvery));
    if (every === 1) every = 2;
    var trickOn = every > 0 && types.indexOf('mc') >= 0;
    var questions = [], n = 0, seen = {};
    slots.forEach(function (sl) {
      n++;
      var q = null;
      if (trickOn && n % every === 0) q = buildTrick(sl.item, easy);
      if (!q) {
        if (sl.type === 'mc') q = buildMC(sl.item, rnd() < 0.25, easy) || buildShort(sl.item);
        else if (sl.type === 'ox') q = buildOX(sl.item);
        else if (sl.type === 'essay') q = buildEssay(sl.item) || buildShort(sl.item);
        else q = buildShort(sl.item);
      }
      if (q && q.type === 'essay' && seen['essay|' + q.q]) q = buildShort(sl.item);
      if (q && q.type === 'essay') seen['essay|' + q.q] = 1;
      if (q && q.type === 'ox' && seen['ox|' + q.passage]) q = buildShort(sl.item);
      if (q && q.type === 'ox') seen['ox|' + q.passage] = 1;
      if (q) questions.push(q);
    });

    var keySentences = items.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 3)
      .sort(function (a, b) { return a.i - b.i; }).map(function (x) { return x.s; });
    var cards = A.defs.map(function (d) {
      return { front: '‘' + d.term + '’' + josa(d.term, '은는') + ' 무엇일까요?', back: d.sentence, target: d.term, k: hash('card|def|' + d.term) };
    });
    var usedS = {};
    A.defs.forEach(function (d) { usedS[d.index] = 1; });
    items.slice().sort(function (a, b) { return b.score - a.score; }).forEach(function (it) {
      if (cards.length >= 40 || usedS[it.i]) return;
      usedS[it.i] = 1;
      cards.push({ front: replaceTerm(it.s, it.target, '____', A.toks[it.i]), back: it.target + ' — ' + it.s, target: it.target, k: hash('card|' + it.s + '|' + it.target) });
    });
    return {
      cards: cards,
      questions: questions,
      concepts: A.terms.slice(0, 10).map(function (t) { return { term: t.term, count: t.count }; }),
      definitions: A.defs.map(function (d) { return { term: d.term, sentence: d.sentence }; }),
      keySentences: keySentences,
      stats: { sentences: A.sentences.length, usable: items.length, capacity: items.length * types.length }
    };
  }

  var api = {
    generate: generate, capacity: capacity, cleanText: cleanText, splitSentences: splitSentences, josa: josa, stemOf: stemOf,
    checkShort: checkShort, essayCheck: essayCheck, essayGrade: essayGrade, normForMatch: normForMatch, analyze: analyze, hash: hash, KIND_NAME: KIND_NAME, NONE: NONE
  };
  root.QuizEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.QuizEngine;
