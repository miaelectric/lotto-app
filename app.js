(() => {
  const MAX = 45;
  const PICK = 6;
  const MAX_FIXED = 5;
  const HISTORY_KEY = "lotto-history-v1";
  const HISTORY_LIMIT = 20;

  // 0 = 없음, 1 = 고정, 2 = 제외
  const state = new Array(MAX + 1).fill(0);

  const $ = (id) => document.getElementById(id);
  const picker = $("picker");
  const results = $("results");
  const errorEl = $("error");

  const rangeClass = (n) => "r" + Math.min(5, Math.ceil(n / 10));

  // 암호학적으로 안전한 난수 (모듈로 편향 제거)
  function randInt(max) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % max;
  }

  function pickNumbers(fixed, excluded) {
    const pool = [];
    for (let n = 1; n <= MAX; n++) {
      if (!fixed.includes(n) && !excluded.includes(n)) pool.push(n);
    }
    const chosen = [...fixed];
    while (chosen.length < PICK) {
      const i = randInt(pool.length);
      chosen.push(pool.splice(i, 1)[0]);
    }
    return chosen.sort((a, b) => a - b);
  }

  function ballEl(n, small) {
    const s = document.createElement("span");
    s.className = `ball ${rangeClass(n)}${small ? " small" : ""}`;
    s.textContent = n;
    return s;
  }

  // 번호 선택판
  function renderPicker() {
    picker.innerHTML = "";
    for (let n = 1; n <= MAX; n++) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = n;
      b.className = ["", "fixed", "excluded"][state[n]];
      b.setAttribute("aria-label", `${n}번 ${["선택 안 함", "고정", "제외"][state[n]]}`);
      b.addEventListener("click", () => {
        const fixedCount = state.filter((v) => v === 1).length;
        let next = (state[n] + 1) % 3;
        if (next === 1 && fixedCount >= MAX_FIXED) next = 2;
        state[n] = next;
        errorEl.textContent = "";
        renderPicker();
      });
      picker.appendChild(b);
    }
  }

  function generate() {
    const fixed = [], excluded = [];
    state.forEach((v, n) => { if (v === 1) fixed.push(n); if (v === 2) excluded.push(n); });

    if (MAX - excluded.length < PICK) {
      errorEl.textContent = `제외수가 너무 많아요. 최소 ${PICK}개 번호는 남겨 주세요.`;
      return;
    }
    errorEl.textContent = "";

    const count = Number($("sets").value);
    const games = Array.from({ length: count }, () => pickNumbers(fixed, excluded));

    results.innerHTML = "";
    games.forEach((nums, gi) => {
      const row = document.createElement("div");
      row.className = "game";
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = String.fromCharCode(65 + gi);
      const balls = document.createElement("div");
      balls.className = "balls";
      nums.forEach((n, i) => {
        const b = ballEl(n);
        b.style.animationDelay = `${gi * 60 + i * 70}ms`;
        balls.appendChild(b);
      });
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "ghost copy";
      copy.textContent = "복사";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(nums.join(", "));
          copy.textContent = "복사됨";
        } catch {
          copy.textContent = "실패";
        }
        setTimeout(() => (copy.textContent = "복사"), 1200);
      });
      row.append(label, balls, copy);
      results.appendChild(row);
    });

    saveHistory(games);
  }

  // 기록 (브라우저에만 저장)
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
  }
  function saveHistory(games) {
    const now = Date.now();
    const list = [...games.map((nums) => ({ t: now, nums })), ...loadHistory()].slice(0, HISTORY_LIMIT);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch {}
    renderHistory();
  }
  function renderHistory() {
    const list = loadHistory();
    $("historyCard").hidden = list.length === 0;
    const ol = $("history");
    ol.innerHTML = "";
    list.forEach(({ t, nums }) => {
      const li = document.createElement("li");
      const time = document.createElement("span");
      time.className = "time";
      const d = new Date(t);
      time.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      li.appendChild(time);
      nums.forEach((n) => li.appendChild(ballEl(n, true)));
      ol.appendChild(li);
    });
  }

  $("generate").addEventListener("click", generate);
  $("resetPicker").addEventListener("click", () => { state.fill(0); errorEl.textContent = ""; renderPicker(); });
  $("clearHistory").addEventListener("click", () => {
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
    renderHistory();
  });

  renderPicker();
  renderHistory();
})();
