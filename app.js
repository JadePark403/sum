/* =========================================================
   숨 — 앱의 움직임을 담당하는 파일
   ========================================================= */

/* ---------- 화면 바꾸기 ----------
   주소 끝의 "#/..." 부분(해시)을 보고 어떤 화면을 보여 줄지 정해요.
   이렇게 하면 폰의 "뒤로 가기" 버튼도 자연스럽게 동작해요. */
const screens = document.querySelectorAll('.screen');

function showScreen() {
  const name = location.hash.replace('#/', '').split('?')[0] || 'home';
  let found = false;
  screens.forEach((el) => {
    const match = el.dataset.screen === name;
    el.hidden = !match;
    if (match) found = true;
  });
  if (!found) document.getElementById('screen-home').hidden = false;
  window.scrollTo(0, 0);
  onScreenChange(found ? name : 'home');
}

window.addEventListener('hashchange', showScreen);
// 처음 열 때 화면을 고르는 일은 이 파일 맨 아래에서 해요 (모든 준비가 끝난 뒤).

/* ---------- 잠깐 뜨는 안내 문구 ---------- */
const toast = document.getElementById('toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

/* 아직 만들지 않은 기능 */
document.querySelectorAll('[data-soon]').forEach((btn) => {
  btn.addEventListener('click', () => showToast('곧 만나요. 지금은 준비 중이에요.'));
});

/* ---------- 도움받을 곳 안내 창 ---------- */
const helpSheet = document.getElementById('help-sheet');
document.getElementById('open-help').addEventListener('click', () => helpSheet.showModal());
// 창 바깥 어두운 곳을 누르면 닫기
helpSheet.addEventListener('click', (e) => {
  if (e.target === helpSheet) helpSheet.close();
});

/* ---------- 오늘 상태 ----------
   고른 상태는 이 기기 안(localStorage)에만 저장돼요. 점수를 매기지 않아요. */
const MOOD_KEY = 'soom.todayMood';

const moodSuggestions = {
  ok: {
    text: '좋아요. 숨을 한 번 고르고 하루를 가볍게 이어 가 볼까요?',
    actions: [
      { label: '1분 숨 고르기', href: '#/breathe?min=1', main: true },
      { label: '미뤄 둔 일 조금만', href: '#/start' },
    ],
  },
  tense: {
    text: '그럴 수 있어요. 몸부터 조금 풀어 볼까요?',
    actions: [
      { label: '3분 숨 고르기', href: '#/breathe?min=3', main: true },
      { label: '생각이 꼬리를 물 때', href: '#/thought' },
    ],
  },
  hard: {
    text: '많이 힘들었군요. 지금은 다른 건 미뤄 두고, 같이 숨만 쉬어요.',
    actions: [{ label: '지금 같이 숨 쉬기', href: '#/sos', main: true }],
  },
};

const moodButtons = document.querySelectorAll('.mood-btn');
const suggestionBox = document.getElementById('mood-suggestion');

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function selectMood(mood) {
  moodButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mood === mood)));

  const s = moodSuggestions[mood];
  suggestionBox.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = s.text;
  const row = document.createElement('div');
  row.className = 'actions';
  s.actions.forEach((a) => {
    const el = a.soon ? document.createElement('button') : document.createElement('a');
    el.className = a.main ? 'btn-main' : 'btn-soft';
    el.textContent = a.label;
    if (a.soon) el.addEventListener('click', () => showToast('곧 만나요. 지금은 준비 중이에요.'));
    else el.href = a.href;
    row.appendChild(el);
  });
  suggestionBox.append(p, row);
  suggestionBox.hidden = false;
}

moodButtons.forEach((btn) => {
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => {
    const mood = btn.dataset.mood;
    selectMood(mood);
    try {
      localStorage.setItem(MOOD_KEY, JSON.stringify({ day: todayString(), mood }));
    } catch (e) { /* 저장이 안 되는 환경이어도 앱은 그대로 동작해요 */ }
  });
});

// 오늘 이미 골랐다면 그대로 보여 주기 (날이 바뀌면 새로 고르기)
try {
  const saved = JSON.parse(localStorage.getItem(MOOD_KEY));
  if (saved && saved.day === todayString() && moodSuggestions[saved.mood]) selectMood(saved.mood);
} catch (e) { /* 무시 */ }

/* =========================================================
   호흡 따라 하기
   들숨 4초 → 날숨 6초. 내쉬는 숨이 더 길면 몸이 차분해지기 쉬워요.
   ========================================================= */
const INHALE_MS = 4000;
const EXHALE_MS = 6000;
const CYCLE_MS = INHALE_MS + EXHALE_MS;   // 한 번 숨쉬는 데 10초

/* 원 하나와 글자 하나를 받아서 "숨쉬기 도우미"를 만들어 주는 함수예요.
   숨 고르기 화면과 SOS 화면이 같은 도우미를 나눠 써요. */
function createBreather(circle, label) {
  let timer = null;
  let running = false;

  function setCircle(scale, ms) {
    circle.style.transitionDuration = ms + 'ms';
    circle.style.transform = `scale(${scale})`;
  }

  function stop() {
    running = false;
    clearTimeout(timer);
    setCircle(0.5, 1200);           // 천천히 원래 크기로
  }

  // cycles: 몇 번 숨쉴지 (Infinity면 멈출 때까지 계속)
  function start(cycles, { onCycle, onDone } = {}) {
    stop();
    running = true;
    let count = 0;

    function inhale() {
      if (!running) return;
      if (count >= cycles) {
        running = false;
        label.textContent = '편하게 숨 쉬어요';
        setCircle(0.5, 1200);
        if (onDone) onDone();
        return;
      }
      label.textContent = '들이쉬어요';
      setCircle(1, INHALE_MS);
      timer = setTimeout(exhale, INHALE_MS);
    }

    function exhale() {
      if (!running) return;
      label.textContent = '천천히 내쉬어요';
      setCircle(0.5, EXHALE_MS);
      count += 1;
      if (onCycle) onCycle(count);
      timer = setTimeout(inhale, EXHALE_MS);
    }

    // 원이 작은 상태에서 시작하도록 한 박자 쉬고 출발
    setCircle(0.5, 0);
    timer = setTimeout(inhale, 400);
  }

  return { start, stop };
}

/* 숨 쉬는 동안 화면이 꺼지지 않게 (지원하는 브라우저에서만) */
let wakeLock = null;
async function keepScreenOn() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch (e) { /* 안 되면 그냥 넘어가요 */ }
}
function releaseScreen() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

/* ---------- 숨 고르기 화면 ---------- */
const breathe = createBreather(
  document.getElementById('breathe-circle'),
  document.getElementById('breathe-label'),
);
const lengthButtons = document.querySelectorAll('.length-btn');
const startBtn = document.getElementById('breathe-start');
const stopBtn = document.getElementById('breathe-stop');
const remainingEl = document.getElementById('breathe-remaining');
const doneEl = document.getElementById('breathe-done');
let chosenMin = 1;
let countdown = null;

function chooseLength(min) {
  chosenMin = min;
  lengthButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.min) === min)));
}
lengthButtons.forEach((b) => b.addEventListener('click', () => chooseLength(Number(b.dataset.min))));

function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function setBreatheRunning(isRunning) {
  startBtn.hidden = isRunning;
  stopBtn.hidden = !isRunning;
  lengthButtons.forEach((b) => { b.disabled = isRunning; });
}

function resetBreathe() {
  breathe.stop();
  clearInterval(countdown);
  releaseScreen();
  setBreatheRunning(false);
  document.getElementById('breathe-label').textContent = '준비되면 시작해요';
  remainingEl.innerHTML = '&nbsp;';
  doneEl.hidden = true;
  startBtn.textContent = '시작하기';
}

startBtn.addEventListener('click', () => {
  const totalMs = chosenMin * 60 * 1000;
  const endAt = Date.now() + totalMs + 400;
  doneEl.hidden = true;
  setBreatheRunning(true);
  keepScreenOn();

  remainingEl.textContent = `남은 시간 ${formatTime(totalMs)}`;
  clearInterval(countdown);
  countdown = setInterval(() => {
    remainingEl.textContent = `남은 시간 ${formatTime(endAt - Date.now())}`;
  }, 1000);

  breathe.start(totalMs / CYCLE_MS, {
    onDone() {
      clearInterval(countdown);
      releaseScreen();
      setBreatheRunning(false);
      remainingEl.innerHTML = '&nbsp;';
      doneEl.textContent = '잘했어요. 잠깐 멈춰서 숨을 고른 것만으로 충분해요.';
      doneEl.hidden = false;
      startBtn.textContent = '한 번 더 하기';
    },
  });
});

// 중간에 멈춰도 괜찮아요. 실패가 아니에요.
stopBtn.addEventListener('click', () => {
  resetBreathe();
  doneEl.hidden = false;
  doneEl.textContent = '멈춰도 괜찮아요. 여기까지 한 것도 충분해요.';
});

/* ---------- SOS 화면 ---------- */
const sos = createBreather(
  document.getElementById('sos-circle'),
  document.getElementById('sos-label'),
);
const sosPhrase = document.getElementById('sos-phrase');
const SOS_PHRASES = [
  '지금 위험한 게 아니에요',
  '이 느낌은 지나가요',
  '숨을 길게 내쉬기만 하면 돼요',
  '여기 그대로 있어도 괜찮아요',
];

function startSos() {
  let i = 0;
  sosPhrase.textContent = SOS_PHRASES[0];
  sosPhrase.classList.remove('fading');
  keepScreenOn();
  sos.start(Infinity, {
    // 숨을 두 번 쉴 때마다(약 20초) 문장을 천천히 바꿔요
    onCycle(count) {
      if (count % 2 !== 0) return;
      sosPhrase.classList.add('fading');
      setTimeout(() => {
        i = (i + 1) % SOS_PHRASES.length;
        sosPhrase.textContent = SOS_PHRASES[i];
        sosPhrase.classList.remove('fading');
      }, 1200);
    },
  });
}

document.getElementById('sos-better').addEventListener('click', () => {
  setTimeout(() => showToast('잘 견뎠어요. 천천히 쉬어 가요.'), 300);
});

/* =========================================================
   생각 사슬 끊기
   1. 한 줄씩 적기 → 2. 일어난 일 / 일어날 것 같은 일 나누기
   → 3. 친구라면 뭐라고 해 줄까 → 끝
   쓰는 도중의 내용만 이 기기에 잠깐 저장해요(화면을 나갔다 와도 이어서 쓰게).
   마치면 바로 지워요. 정답도, 판정도 없어요.
   ========================================================= */
const THOUGHT_KEY = 'soom.thoughtDraft';
const KIND_LABELS = { fact: '실제로 일어난 일', maybe: '일어날 것 같은 일' };

function emptyThought() {
  return { step: 1, lines: [], friend: '' };   // lines: [{ text, kind }]
}

let thought = emptyThought();

function saveThought() {
  try { localStorage.setItem(THOUGHT_KEY, JSON.stringify(thought)); } catch (e) { /* 무시 */ }
}
function loadThought() {
  try {
    const saved = JSON.parse(localStorage.getItem(THOUGHT_KEY));
    if (saved && Array.isArray(saved.lines) && saved.step < 4) return saved;
  } catch (e) { /* 무시 */ }
  return emptyThought();
}
function clearThought() {
  thought = emptyThought();
  try { localStorage.removeItem(THOUGHT_KEY); } catch (e) { /* 무시 */ }
}

const thoughtForm = document.getElementById('thought-form');
const thoughtInput = document.getElementById('thought-input');
const thoughtList = document.getElementById('thought-list');
const sortList = document.getElementById('sort-list');
const friendThoughts = document.getElementById('friend-thoughts');
const friendText = document.getElementById('friend-text');
const toStep2 = document.getElementById('to-step-2');
const thoughtClear = document.getElementById('thought-clear');

// 화면에 지금 단계를 그려 주는 함수
function renderThought() {
  document.querySelectorAll('.thought-step').forEach((sec) => {
    sec.hidden = Number(sec.dataset.step) !== thought.step;
  });
  document.querySelectorAll('[data-dot]').forEach((dot) => {
    dot.classList.toggle('on', Number(dot.dataset.dot) === thought.step);
  });
  document.querySelector('.step-dots').hidden = thought.step === 4;

  // 1단계 목록
  thoughtList.innerHTML = '';
  thought.lines.forEach((line, i) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = line.text;               // textContent: 적은 글을 글자 그대로 보여 줘요
    const del = document.createElement('button');
    del.className = 'remove';
    del.textContent = '×';
    del.setAttribute('aria-label', `"${line.text}" 지우기`);
    del.addEventListener('click', () => {
      thought.lines.splice(i, 1);
      saveThought();
      renderThought();
    });
    li.append(span, del);
    thoughtList.appendChild(li);
  });
  toStep2.disabled = thought.lines.length === 0;
  thoughtClear.hidden = thought.lines.length === 0;

  // 2단계: 줄마다 두 가지 중 하나 (다시 누르면 선택 풀림)
  sortList.innerHTML = '';
  thought.lines.forEach((line) => {
    const li = document.createElement('li');
    const p = document.createElement('p');
    p.textContent = line.text;
    const chips = document.createElement('div');
    chips.className = 'chips';
    Object.entries(KIND_LABELS).forEach(([kind, label]) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = label;
      chip.setAttribute('aria-pressed', String(line.kind === kind));
      chip.addEventListener('click', () => {
        line.kind = line.kind === kind ? null : kind;
        saveThought();
        renderThought();
      });
      chips.appendChild(chip);
    });
    li.append(p, chips);
    sortList.appendChild(li);
  });

  // 3단계: "일어날 것 같은 일"을 먼저 보여 줘요
  friendThoughts.innerHTML = '';
  const ordered = [...thought.lines].sort((a, b) => (b.kind === 'maybe') - (a.kind === 'maybe'));
  ordered.forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line.text;
    if (line.kind) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = KIND_LABELS[line.kind];
      li.appendChild(tag);
    }
    friendThoughts.appendChild(li);
  });
  if (document.activeElement !== friendText) friendText.value = thought.friend;
}

function goThoughtStep(step) {
  thought.step = step;
  saveThought();
  renderThought();
  window.scrollTo(0, 0);
}

thoughtForm.addEventListener('submit', (e) => {
  e.preventDefault();                          // 폼을 보내지 않고(새로고침 없이) 여기서 처리
  const text = thoughtInput.value.trim();
  if (!text) return;
  thought.lines.push({ text, kind: null });
  thoughtInput.value = '';
  saveThought();
  renderThought();
  thoughtInput.focus();                        // 바로 다음 줄을 이어서 쓸 수 있게
});

toStep2.addEventListener('click', () => goThoughtStep(2));
document.querySelectorAll('[data-go]').forEach((btn) => {
  btn.addEventListener('click', () => goThoughtStep(Number(btn.dataset.go)));
});

thoughtClear.addEventListener('click', () => {
  clearThought();
  renderThought();
  thoughtInput.focus();
});

friendText.addEventListener('input', () => {
  thought.friend = friendText.value;
  saveThought();
});

document.getElementById('thought-finish').addEventListener('click', () => {
  const words = friendText.value.trim();
  const echo = document.getElementById('friend-echo');
  echo.textContent = words;
  echo.hidden = !words;
  clearThought();                              // 마치면 적은 내용은 지워요
  thought.step = 4;
  renderThought();
  window.scrollTo(0, 0);
});

/* =========================================================
   첫걸음 만들기
   일 하나 → 2분 첫걸음 → 2분 타이머 → "시작했어요"
   할 일 목록이 아니에요. 한 번에 하나만 다루고, 마치면 지워요.
   ========================================================= */
const START_KEY = 'soom.startDraft';
const TIMER_MS = 2 * 60 * 1000;
const RING = 339.3;                            // 타이머 원의 둘레 (style.css와 같은 값)
const FIRST_STEP_IDEAS = ['필요한 것 꺼내 놓기', '파일이나 공책 열기', '제목만 적기', '딱 한 줄만 쓰기', '자리에 앉아 보기'];

let start = { step: 1, task: '', first: '' };

function saveStart() {
  try { localStorage.setItem(START_KEY, JSON.stringify(start)); } catch (e) { /* 무시 */ }
}
function loadStart() {
  try {
    const saved = JSON.parse(localStorage.getItem(START_KEY));
    // 4단계("시작했어요")까지 갔던 기록은 새로 시작해요
    if (saved && typeof saved.task === 'string' && saved.step < 4) return saved;
  } catch (e) { /* 무시 */ }
  return { step: 1, task: '', first: '' };
}
function clearStart() {
  start = { step: 1, task: '', first: '' };
  try { localStorage.removeItem(START_KEY); } catch (e) { /* 무시 */ }
}

const taskInput = document.getElementById('task-input');
const firstInput = document.getElementById('first-input');
const toTimer = document.getElementById('to-timer');
const timerText = document.getElementById('timer-text');
const timerBar = document.getElementById('timer-bar');
const timerStart = document.getElementById('timer-start');
const timerStop = document.getElementById('timer-stop');
const timerBack = document.getElementById('timer-back');
let timerInterval = null;

function renderStart() {
  document.querySelectorAll('.start-step').forEach((sec) => {
    sec.hidden = Number(sec.dataset.sstep) !== start.step;
  });
  document.querySelectorAll('[data-sdot]').forEach((dot) => {
    dot.classList.toggle('on', Number(dot.dataset.sdot) === start.step);
  });
  document.getElementById('start-dots').hidden = start.step === 4;

  taskInput.value = start.task;
  document.getElementById('task-name').textContent = start.task;
  firstInput.value = start.first;
  toTimer.disabled = !start.first.trim();
  document.getElementById('first-step-text').textContent = start.first;
}

function goStartStep(step) {
  start.step = step;
  saveStart();
  renderStart();
  window.scrollTo(0, 0);
}

// 1단계 → 2단계
document.getElementById('task-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const task = taskInput.value.trim();
  if (!task) { taskInput.focus(); return; }
  start.task = task;
  goStartStep(2);
});

// 첫걸음 예시: 누르면 입력칸에 채워 줘요 (고쳐 써도 돼요)
const ideaChips = document.getElementById('idea-chips');
FIRST_STEP_IDEAS.forEach((idea) => {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = idea;
  chip.addEventListener('click', () => {
    firstInput.value = idea;
    firstInput.dispatchEvent(new Event('input'));
  });
  ideaChips.appendChild(chip);
});

firstInput.addEventListener('input', () => {
  start.first = firstInput.value;
  toTimer.disabled = !start.first.trim();
  saveStart();
});

// 2단계 → 3단계
document.getElementById('first-form').addEventListener('submit', (e) => {
  e.preventDefault();
  start.first = firstInput.value.trim();
  if (!start.first) return;
  resetTimerView();
  goStartStep(3);
});

document.querySelectorAll('[data-sgo]').forEach((btn) => {
  btn.addEventListener('click', () => {
    stopTimer();
    goStartStep(Number(btn.dataset.sgo));
  });
});

/* ---------- 2분 타이머 ---------- */
function drawTimer(remainingMs) {
  timerText.textContent = formatTime(remainingMs);
  timerBar.style.strokeDashoffset = String(RING * (1 - remainingMs / TIMER_MS));
}

function resetTimerView() {
  // 원을 꽉 찬 모양으로 "순식간에" 되돌리기 (이때만 움직임 효과를 잠깐 꺼요)
  timerBar.style.transition = 'none';
  drawTimer(TIMER_MS);
  void timerBar.getBoundingClientRect();       // 브라우저가 바뀐 모양을 먼저 그리게 해요
  timerBar.style.transition = '';
  timerStart.hidden = false;
  timerBack.hidden = false;
  timerStop.hidden = true;
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    releaseScreen();
  }
}

function runTimer() {
  stopTimer();
  resetTimerView();
  timerStart.hidden = true;
  timerBack.hidden = true;
  timerStop.hidden = false;
  keepScreenOn();
  // 시계 시각을 기준으로 계산해서, 폰이 잠깐 느려져도 시간이 밀리지 않아요
  const endAt = Date.now() + TIMER_MS;
  timerInterval = setInterval(() => {
    const left = endAt - Date.now();
    drawTimer(Math.max(0, left));
    if (left <= 0) finishStart(true);
  }, 250);
}

// 끝까지 해도, 중간에 멈춰도 똑같이 "시작했어요"예요
function finishStart(fullTime) {
  stopTimer();
  document.getElementById('start-result').textContent = fullTime
    ? '2분이 지났어요. 시작한 것, 그게 제일 어려운 부분이었어요.'
    : '멈춰도 괜찮아요. 시작했다는 게 중요해요.';
  goStartStep(4);
}

timerStart.addEventListener('click', runTimer);
timerStop.addEventListener('click', () => finishStart(false));

// 멈춰도 돼요 → 오늘은 여기까지
document.getElementById('start-done').addEventListener('click', () => {
  clearStart();
  location.hash = '#/';
  setTimeout(() => showToast('오늘 시작한 걸로 충분해요.'), 300);
});

// 조금 더 할래요 → 같은 첫걸음으로 2분 더
document.getElementById('start-more').addEventListener('click', () => {
  goStartStep(3);
  runTimer();
});

// 다음 첫걸음 정하기 → 같은 일, 새 첫걸음
document.getElementById('start-next').addEventListener('click', () => {
  start.first = '';
  goStartStep(2);
  firstInput.focus();
});

/* ---------- 화면이 바뀔 때마다 ---------- */
function onScreenChange(name) {
  document.body.classList.toggle('on-sos', name === 'sos');

  // 다른 화면으로 가면 숨쉬기는 모두 멈춰요
  if (name !== 'sos') sos.stop();
  if (name !== 'breathe') resetBreathe();
  if (name !== 'sos' && name !== 'breathe') releaseScreen();

  if (name !== 'start') stopTimer();
  if (name === 'start') {
    start = loadStart();                       // 쓰다 만 게 있으면 이어서
    if (start.step === 3) resetTimerView();    // 타이머는 다시 "시작하기"부터
    renderStart();
  }

  if (name === 'thought') {
    thought = loadThought();                   // 쓰다 만 게 있으면 이어서
    renderThought();
  }

  if (name === 'sos') startSos();
  if (name === 'breathe') {
    resetBreathe();
    const min = new URLSearchParams(location.hash.split('?')[1]).get('min');
    chooseLength(min === '3' ? 3 : 1);
  }
}

// 폰 화면을 껐다 켜면 "화면 켜 두기"를 다시 요청해요
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !document.getElementById('screen-sos').hidden) keepScreenOn();
});

/* 모든 준비가 끝났으니 지금 주소에 맞는 화면을 보여 줘요 */
showScreen();

/* ---------- 인터넷 없이도 열리게 (서비스 워커 등록) ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* ---------- 시작 화면 ----------
   CSS가 알아서 사라지게 하고, 여기서는 다 사라진 뒤 치워 주기만 해요.
   화면을 누르면 기다리지 않고 바로 넘어가요. */
const splash = document.getElementById('splash');
if (splash) {
  splash.addEventListener('click', () => splash.classList.add('leaving'));
  splash.addEventListener('animationend', (e) => {
    if (e.target === splash) splash.remove();
  });
  // 혹시 움직임이 멈춰 있어도(절전 모드 등) 시작 화면이 앱을 가리지 않게, 3초 뒤엔 무조건 치워요
  setTimeout(() => splash.remove(), 3000);
}
