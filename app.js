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
}

window.addEventListener('hashchange', showScreen);
showScreen();

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
