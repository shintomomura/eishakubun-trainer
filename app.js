(() => {
  'use strict';

  const STORAGE_KEY = 'eishakubun:v1';
  const SAVE_DEBOUNCE_MS = 50;

  const $ = (sel) => document.querySelector(sel);
  const els = {
    ja: $('#ja'),
    en: $('#en'),
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
    els.problemId.textContent = `#${p.id}`;
    els.ja.textContent = p.ja;
    els.en.textContent = p.en;
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

  async function loadProblems() {
    try {
      const r = await fetch('problems.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      problems = await r.json();
      if (!Array.isArray(problems) || problems.length === 0) {
        throw new Error('problems.json is empty');
      }
    } catch (e) {
      els.ja.textContent = '問題データの読み込みに失敗しました: ' + e.message;
      throw e;
    }
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
