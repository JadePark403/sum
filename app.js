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
    actions: [{ label: '1분 숨 고르기', href: '#/breathe?min=1', main: true }],
  },
  tense: {
    text: '그럴 수 있어요. 몸부터 조금 풀어 볼까요?',
    actions: [
      { label: '3분 숨 고르기', href: '#/breathe?min=3', main: true },
      { label: '생각이 꼬리를 물 때', soon: true },
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

/* ---------- 화면이 바뀔 때마다 ---------- */
function onScreenChange(name) {
  document.body.classList.toggle('on-sos', name === 'sos');

  // 다른 화면으로 가면 숨쉬기는 모두 멈춰요
  if (name !== 'sos') sos.stop();
  if (name !== 'breathe') resetBreathe();
  if (name !== 'sos' && name !== 'breathe') releaseScreen();

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
