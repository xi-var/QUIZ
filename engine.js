(function (root) {
  'use strict';

  var PARTICLES = ['에서는','에서도','으로는','으로도','에게는','으로써','으로서','까지는','부터는','이라는','이라고','라는','에서','으로','에게','까지','부터','라고','처럼','보다','마다','에는','에도','이나','이며','이고','이란','와는','과는','은','는','이','가','을','를','의','에','로','와','과','도','만','란']
    .sort(function (a, b) { return b.length - a.length; });
  var STOP_KO = new Set(['그','이','저','것','수','등','및','또는','그리고','하지만','그러나','따라서','때문','경우','이후','이전','대한','통해','위해','매우','가장','주로','더','또','다른','같은','모든','각','여러','어떤','이런','그런','우리','때','중','안','위','아래','다음','먼저','이상','이하','정도','하나','가지','사이','결과','내용','부분','방법','문제','시간','일정','영향','다시','이미','아직','바로','함께','모두','어떻게','무엇','만드','이루','일으','나타','늘어','줄어','높아','낮아','커지','작아','강해','약해','이용','사용','필요']);
  var STOP_EN = new Set(['the','and','for','are','but','not','you','all','any','can','had','her','was','one','our','out','has','have','this','that','with','from','they','will','would','there','their','what','which','when','who','how','been','were','also','into','than','then','them','these','those','its','his','she','him','may','such','more','most','other','some','only','over','very']);

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
  function josa(word, pair) {
    var ch = word.charAt(word.length - 1), c = ch.charCodeAt(0), has = false;
    if (c >= 0xAC00 && c <= 0xD7A3) has = ((c - 0xAC00) % 28) !== 0;
    else if (/[0-9]/.test(ch)) has = '013678'.indexOf(ch) >= 0;
    return has ? pair.charAt(0) : pair.charAt(1);
  }
  function splitSentences(text) {
    return String(text || '').replace(/\r/g, '')
      .replace(/([.!?。？！])\s+/g, '$1\n')
      .split(/\n+/)
      .map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
      .filter(function (s) { return s.length >= 10; });
  }
  function stemOf(tok) {
    var t = String(tok).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!t) return null;
    if (/^[A-Za-z][A-Za-z\-']*$/.test(t)) return t;
    for (var i = 0; i < PARTICLES.length; i++) {
      var p = PARTICLES[i];
      var minLeft = p.length >= 2 ? 1 : 2;
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
    return true;
  }
  function tokensOf(sentence) {
    var out = [], re = /[^\s,;:()\[\]{}"'“”‘’·…\/]+/g, m;
    while ((m = re.exec(sentence))) out.push({ raw: m[0], stem: stemOf(m[0]), index: m.index });
    return out;
  }
  function batchimOf(word) {
    var c = word.charCodeAt(word.length - 1);
    if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28;
    var ch = word.charAt(word.length - 1);
    return /[0-9]/.test(ch) && '013678'.indexOf(ch) >= 0 ? 1 : 0;
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
  function replaceTerm(sentence, target, repl) {
    var toks = tokensOf(sentence), out = '', last = 0, blank = repl === '____';
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
    var g = normForMatch(given);
    if (!g) return false;
    var list = [q.answer].concat(q.accept || []);
    return list.some(function (a) { return normForMatch(a) === g; });
  }

  function analyze(text) {
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
    return { sentences: sentences, toks: toks, terms: terms, termMap: termMap, sentTerms: sentTerms, defs: defs };
  }

  var KIND_NAME = { mc: '빈칸 객관식', ox: 'OX', short: '단답' };

  function generate(text, opts) {
    opts = opts || {};
    var count = opts.count || 10;
    var types = (opts.types && opts.types.length ? opts.types : ['mc', 'ox', 'short']).slice();
    var rnd = mulberry32(opts.seed == null ? 1 : opts.seed);
    var A = analyze(text);

    var items = [];
    A.sentences.forEach(function (s, i) {
      if (s.length < 14 || s.length > 150) return;
      var ts = A.toks[i];
      if (ts.length < 4) return;
      var best = null;
      ts.forEach(function (t) {
        var info = t.stem && A.termMap.get(t.stem);
        if (info && (!best || info.score > best.score)) best = info;
      });
      if (best) items.push({ i: i, s: s, target: best.term, score: best.score, kind: best.kind });
    });
    var picked = items.map(function (it) { return { it: it, k: it.score + rnd() * 2 }; })
      .sort(function (a, b) { return b.k - a.k; })
      .slice(0, count).map(function (x) { return x.it; })
      .sort(function (a, b) { return a.i - b.i; });

    function distractors(item, n) {
      var pool = A.terms.filter(function (t) {
        return t.kind === item.kind && t.term !== item.target && !A.sentTerms[item.i].has(t.term) &&
          t.term.indexOf(item.target) < 0 && item.target.indexOf(t.term) < 0;
      });
      if (pool.length < n) return null;
      pool.sort(function (a, b) {
        return Math.abs(a.term.length - item.target.length) - Math.abs(b.term.length - item.target.length) || b.score - a.score;
      });
      return shuffle(pool.slice(0, 8), rnd).slice(0, n).map(function (t) { return t.term; });
    }
    function whereUsed(term, exceptIdx) {
      for (var i = 0; i < A.sentences.length; i++) if (i !== exceptIdx && A.sentTerms[i].has(term)) return A.sentences[i];
      return null;
    }

    function buildMC(item) {
      var d = distractors(item, 3);
      if (!d) return null;
      var choices = shuffle([item.target].concat(d), rnd);
      var answer = choices.indexOf(item.target);
      var feedback = choices.map(function (c, k) {
        if (k === answer) return '정답이에요.';
        var u = whereUsed(c, item.i);
        return '‘' + c + '’' + josa(c, '은는') + ' ' + (u ? '본문의 “' + trunc(u, 60) + '” 같은 다른 문장에 나오는 말이라 이 빈칸에는 맞지 않아요.' : '이 문장의 내용과 맞지 않아요.');
      });
      return {
        type: 'mc', q: '빈칸에 들어갈 알맞은 말은?', passage: replaceTerm(item.s, item.target, '____'),
        choices: choices, answer: answer, feedback: feedback,
        explain: '정답은 ‘' + item.target + '’이에요.', evidence: item.s
      };
    }
    function buildShort(item) {
      return {
        type: 'short', q: '빈칸에 알맞은 말을 쓰세요.', passage: replaceTerm(item.s, item.target, '____'),
        answer: item.target, hint: item.target.length + '글자',
        explain: '정답은 ‘' + item.target + '’이에요.', evidence: item.s
      };
    }
    function buildOX(item) {
      var d = distractors(item, 1);
      var makeFalse = d && rnd() < 0.5;
      if (makeFalse) {
        var stmt = replaceTerm(item.s, item.target, d[0]);
        if (stmt === item.s) makeFalse = false;
        else return {
          type: 'ox', q: '다음 설명이 본문 내용과 맞으면 O, 틀리면 X를 고르세요.', passage: stmt, answer: false,
          explain: '본문에는 “' + item.s + '”라고 나와 있어요. ‘' + d[0] + '’이(가) 아니라 ‘' + item.target + '’이(가) 맞아요.', evidence: item.s
        };
      }
      return {
        type: 'ox', q: '다음 설명이 본문 내용과 맞으면 O, 틀리면 X를 고르세요.', passage: item.s, answer: true,
        explain: '본문에 같은 내용이 나와 있어요.', evidence: item.s
      };
    }

    var questions = [], order = types, ti = 0;
    picked.forEach(function (item) {
      var type = order[ti % order.length]; ti++;
      var q = null;
      if (type === 'mc') q = buildMC(item) || buildShort(item);
      else if (type === 'ox') q = buildOX(item);
      else q = buildShort(item);
      if (q) { q.source = 'rule'; questions.push(q); }
    });

    var keySentences = items.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 3)
      .sort(function (a, b) { return a.i - b.i; }).map(function (x) { return x.s; });
    return {
      questions: questions,
      concepts: A.terms.slice(0, 10).map(function (t) { return { term: t.term, count: t.count }; }),
      definitions: A.defs.map(function (d) { return { term: d.term, sentence: d.sentence }; }),
      keySentences: keySentences,
      stats: { sentences: A.sentences.length, usable: items.length }
    };
  }

  function str(v) { return typeof v === 'string' ? v.trim() : ''; }
  function convertAI(r) {
    if (!r || typeof r !== 'object') return null;
    var type = str(r.type).toLowerCase();
    var base = { q: str(r.q), passage: str(r.passage), explain: str(r.explanation), evidence: str(r.evidence), source: 'ai' };
    if (!base.q || !base.evidence) return null;
    if (type === 'mc') {
      var ch = Array.isArray(r.choices) ? r.choices.map(str) : [];
      if (ch.length !== 4 || ch.some(function (c) { return !c; }) || new Set(ch).size !== 4) return null;
      var a = Number(r.answer);
      if (!Number.isInteger(a) || a < 0 || a > 3) return null;
      var w = Array.isArray(r.wrong) ? r.wrong.map(str) : [];
      var fb = ch.map(function (_, k) { return k === a ? '정답이에요.' : (w[k] || '이 보기는 정답이 아니에요.'); });
      base.type = 'mc'; base.choices = ch; base.answer = a; base.feedback = fb;
      return base;
    }
    if (type === 'ox') {
      var v = r.answer;
      if (typeof v === 'string') v = /^(true|o|참)$/i.test(v.trim()) ? true : (/^(false|x|거짓)$/i.test(v.trim()) ? false : null);
      if (typeof v !== 'boolean' || !base.passage) return null;
      base.type = 'ox'; base.answer = v;
      return base;
    }
    if (type === 'short') {
      var ans = str(r.answer);
      if (!ans) return null;
      base.type = 'short'; base.answer = ans;
      base.accept = Array.isArray(r.accept) ? r.accept.map(str).filter(Boolean) : [];
      return base;
    }
    return null;
  }
  function normalizeAI(raw, source) {
    var out = { questions: [], dropped: 0, concepts: [], summary: '' };
    if (!raw || typeof raw !== 'object') return out;
    out.summary = str(raw.summary);
    out.concepts = Array.isArray(raw.concepts) ? raw.concepts.map(str).filter(Boolean).slice(0, 10) : [];
    var ns = normForMatch(source);
    (Array.isArray(raw.questions) ? raw.questions : []).forEach(function (r) {
      var q = convertAI(r);
      if (!q) { out.dropped++; return; }
      var ev = normForMatch(q.evidence);
      if (ev.length < 6 || ns.indexOf(ev) < 0) { out.dropped++; return; }
      out.questions.push(q);
    });
    return out;
  }

  root.QuizEngine = {
    generate: generate, normalizeAI: normalizeAI, splitSentences: splitSentences, josa: josa, stemOf: stemOf,
    checkShort: checkShort, normForMatch: normForMatch, analyze: analyze, KIND_NAME: KIND_NAME
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.QuizEngine;
