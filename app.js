(() => {
  'use strict';

  const STORAGE_KEY = 'eishakubun:v1';
  const SAVE_DEBOUNCE_MS = 50;

  const $ = (sel) => document.querySelector(sel);
  const els = {
    ja: $('#ja'),
    en: $('#en'),
    altWrap: $('#alt-wrap'),
    altList: $('#alt-list'),
    answer: $('#answer'),
    revealRow: $('#reveal-row'),
    revealBtn: $('#reveal-btn'),
    skipBtn: $('#skip-btn'),
    answerBlock: $('#answer-block'),
    okBtn: $('#ok-btn'),
    ngBtn: $('#ng-btn'),
    progressLabel: $('#progress-label'),
    scoreLabel: $('#score-label'),
    progressBar: $('#progress-bar'),
    problemId: $('#problem-id'),
    modeLabel: $('#mode-label'),
    wrongCount: $('#wrong-count'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    resetBtn: $('#reset-btn'),
    card: $('#card'),
    finished: $('#finished'),
    finishTitle: $('#finish-title'),
    finishMsg: $('#finish-msg'),
    gotoReview: $('#goto-review'),
    restartBtn: $('#restart-btn'),
    clearStorage: $('#clear-storage'),
  };

  let problems = [];
  let state = loadState();

  function defaultState() {
    return {
      mode: 'all',
      // queue: array of problem ids remaining in current run
      queue: [],
      // stats for current run
      okCount: 0,
      ngCount: 0,
      // persistent: ids the user has marked × at any point (review pool)
      wrongIds: [],
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      return Object.assign(defaultState(), s);
    } catch {
      return defaultState();
    }
  }

  let saveTimer = null;
  function saveState() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {}
    }, SAVE_DEBOUNCE_MS);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildQueue(mode) {
    if (mode === 'review') {
      const ids = state.wrongIds.filter((id) => problems.some((p) => p.id === id));
      return shuffle(ids);
    }
    return shuffle(problems.map((p) => p.id));
  }

  function startMode(mode) {
    state.mode = mode;
    state.queue = buildQueue(mode);
    state.okCount = 0;
    state.ngCount = 0;
    saveState();
    render();
  }

  function getProblemById(id) {
    return problems.find((p) => p.id === id);
  }

  function currentProblem() {
    if (!state.queue.length) return null;
    return getProblemById(state.queue[0]);
  }

  function totalForMode() {
    if (state.mode === 'review') {
      return state.okCount + state.ngCount + state.queue.length;
    }
    return problems.length;
  }

  function answeredCount() {
    return state.okCount + state.ngCount;
  }

  function judge(correct) {
    const p = currentProblem();
    if (!p) return;
    if (correct) {
      state.okCount++;
      state.wrongIds = state.wrongIds.filter((id) => id !== p.id);
    } else {
      state.ngCount++;
      if (!state.wrongIds.includes(p.id)) state.wrongIds.push(p.id);
    }
    state.queue.shift();
    saveState();
    render();
  }

  function skip() {
    if (!state.queue.length) return;
    const id = state.queue.shift();
    state.queue.push(id);
    saveState();
    render();
  }

  function setMode(mode) {
    if (mode === state.mode && state.queue.length) {
      render();
      return;
    }
    if (mode === 'review' && state.wrongIds.length === 0) {
      startMode('review');
      return;
    }
    startMode(mode);
  }

  function resetCurrentRun() {
    if (!confirm('現在のセッションを最初からやり直します。よろしいですか？')) return;
    startMode(state.mode);
  }

  function clearAll() {
    if (!confirm('学習データ（できなかったリスト・進捗）をすべて削除します。よろしいですか？')) return;
    state = defaultState();
    saveState();
    startMode('all');
  }

  function updateProgressUI() {
    const total = totalForMode();
    const done = answeredCount();
    els.progressLabel.textContent = total ? `${Math.min(done + 1, total)} / ${total}` : '0 / 0';
    els.scoreLabel.textContent = `○${state.okCount} / ×${state.ngCount}`;
    const pct = total ? (done / total) * 100 : 0;
    els.progressBar.style.width = pct + '%';
    els.wrongCount.textContent = state.wrongIds.length;
    els.modeBtns.forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
    });
    els.modeLabel.textContent = state.mode === 'review' ? '復習モード' : '通常モード';
    els.modeLabel.classList.toggle('review', state.mode === 'review');
  }

  function showFinished() {
    els.card.hidden = true;
    els.finished.hidden = false;
    if (state.mode === 'review') {
      els.finishTitle.textContent = state.wrongIds.length === 0 ? '全問クリア！🎉' : '復習セッション終了';
      els.finishMsg.textContent =
        state.wrongIds.length === 0
          ? 'できなかった問題は残っていません。素晴らしい！'
          : `残り ${state.wrongIds.length} 問が「できなかった」リストにあります。`;
      els.gotoReview.hidden = state.wrongIds.length === 0;
      els.gotoReview.textContent = '残りを再挑戦';
    } else {
      els.finishTitle.textContent = '全問終了！お疲れさまでした';
      els.finishMsg.textContent =
        state.wrongIds.length > 0
          ? `「できなかった」が ${state.wrongIds.length} 問あります。復習モードで仕上げましょう。`
          : '全問正解！復習することはありません。';
      els.gotoReview.hidden = state.wrongIds.length === 0;
      els.gotoReview.textContent = `復習モードへ（${state.wrongIds.length}問）`;
    }
  }

  function showCard() {
    els.card.hidden = false;
    els.finished.hidden = true;
  }

  function render() {
    updateProgressUI();
    const p = currentProblem();
    if (!p) {
      showFinished();
      return;
    }
    showCard();
    const idx = problems.findIndex((x) => x.id === p.id);
    els.problemId.textContent = idx >= 0 ? `#${idx + 1} / ${problems.length}` : `#${problems.length}`;
    const alts = Array.isArray(p.enAlts) ? p.enAlts : [];
    const totalAnswers = 1 + alts.length;
    els.ja.textContent = totalAnswers > 1 ? `${p.ja}（${totalAnswers}）` : p.ja;
    els.en.textContent = p.en;
    els.altList.innerHTML = '';
    if (alts.length) {
      for (const a of alts) {
        const li = document.createElement('li');
        li.textContent = a;
        els.altList.appendChild(li);
      }
      els.altWrap.hidden = false;
    } else {
      els.altWrap.hidden = true;
    }
    els.answer.value = '';
    els.revealRow.hidden = false;
    els.answerBlock.hidden = true;
    requestAnimationFrame(() => els.answer.focus({ preventScroll: true }));
  }

  function reveal() {
    els.revealRow.hidden = true;
    els.answerBlock.hidden = false;
  }

  function bind() {
    els.revealBtn.addEventListener('click', reveal);
    els.skipBtn.addEventListener('click', skip);
    els.okBtn.addEventListener('click', () => judge(true));
    els.ngBtn.addEventListener('click', () => judge(false));
    els.modeBtns.forEach((b) => {
      b.addEventListener('click', () => setMode(b.dataset.mode));
    });
    els.resetBtn.addEventListener('click', resetCurrentRun);
    els.clearStorage.addEventListener('click', clearAll);
    els.gotoReview.addEventListener('click', () => setMode('review'));
    els.restartBtn.addEventListener('click', () => startMode('all'));

    document.addEventListener('keydown', (e) => {
      if (e.target === els.answer) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          if (els.answerBlock.hidden) reveal();
          else judge(true);
        }
        return;
      }
      if (els.finished.hidden === false) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (els.answerBlock.hidden) reveal();
      } else if (e.key === '1' || e.key.toLowerCase() === 'o') {
        if (!els.answerBlock.hidden) judge(true);
      } else if (e.key === '2' || e.key.toLowerCase() === 'x') {
        if (!els.answerBlock.hidden) judge(false);
      } else if (e.key === 's') {
        skip();
      }
    });
  }

  // CEO所有のGoogleスプレッドシート（公開: 閲覧のみ）
  // 行を追加するだけで自動反映される。失敗したら同梱の problems.json にフォールバック。
  const SHEET_CSV_URL =
    'https://docs.google.com/spreadsheets/d/1PQknGfb_XYxUMydvWPgD3dBXi-bZqZIRvoZKqzbyElA/gviz/tq?tqx=out:csv&gid=0';

  function parseCSV(text) {
    const rows = [];
    let i = 0, field = '', row = [], inQuotes = false;
    while (i < text.length) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); field = ''; row = []; i++; continue; }
      if (c === '\r') { i++; continue; }
      field += c; i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // 内容ベースの安定ID。FNV-1a 32bit。行を入れ替え／削除しても同じ問題は同じIDを保つ
  function stableId(ja, en) {
    const s = ja + '' + en;
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return 'h_' + h.toString(36);
  }

  // 日本語の文字を含むかを判定（ひらがな/カタカナ/漢字）
  function containsJapanese(s) {
    return /[぀-ゟ゠-ヿ一-龯]/.test(s || '');
  }

  function rowsToProblems(rows) {
    // 1行目で列の順序を自動判定
    // 新フォーマット: A=日本語, B=英語(主), C/D/...=英語(別表現)
    // 旧フォーマット: A=英語, B=日本語
    const out = [];
    const seen = new Set();
    let jaFirst = null;
    for (const r of rows) {
      if (!r || r.length < 2) continue;
      const c0 = (r[0] || '').trim();
      const c1 = (r[1] || '').trim();
      if (!c0 || !c1) continue;
      if (jaFirst === null) {
        jaFirst = containsJapanese(c0) && !containsJapanese(c1);
      }
      const ja = jaFirst ? c0 : c1;
      const enPrimary = jaFirst ? c1 : c0;
      const enAlts = [];
      if (jaFirst) {
        for (let k = 2; k < r.length; k++) {
          const v = (r[k] || '').trim();
          if (v) enAlts.push(v);
        }
      }
      if (!ja || !enPrimary) continue;
      const id = stableId(ja, enPrimary);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, ja, en: enPrimary, enAlts });
    }
    return out;
  }

  async function fetchFromSheet() {
    const r = await fetch(SHEET_CSV_URL, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Sheet HTTP ' + r.status);
    const text = await r.text();
    const rows = parseCSV(text);
    const list = rowsToProblems(rows);
    if (!list.length) throw new Error('Sheet returned no usable rows');
    return list;
  }

  async function fetchFromBundle() {
    const r = await fetch('problems.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('bundle HTTP ' + r.status);
    const list = await r.json();
    if (!Array.isArray(list) || list.length === 0) throw new Error('bundle is empty');
    return list;
  }

  async function loadProblems() {
    let source = 'sheet';
    try {
      problems = await fetchFromSheet();
    } catch (sheetErr) {
      console.warn('Live sheet fetch failed; falling back to bundled problems.json', sheetErr);
      try {
        problems = await fetchFromBundle();
        source = 'bundle';
      } catch (bundleErr) {
        els.ja.textContent =
          '問題データの読み込みに失敗しました（' + sheetErr.message + ' / ' + bundleErr.message + '）';
        throw bundleErr;
      }
    }
    return source;
  }

  function pruneStaleQueueRefs() {
    const validIds = new Set(problems.map((p) => p.id));
    state.queue = state.queue.filter((id) => validIds.has(id));
    state.wrongIds = state.wrongIds.filter((id) => validIds.has(id));
  }

  async function init() {
    bind();
    await loadProblems();
    pruneStaleQueueRefs();
    if (!state.queue.length && state.okCount === 0 && state.ngCount === 0) {
      startMode(state.mode || 'all');
    } else {
      render();
    }
  }

  init();
})();
