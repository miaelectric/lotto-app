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

  // 올해 당첨번호 (Vercel 함수 -> 실패 시 저장된 JSON)
  let winData = [];
  let winShown = 10;

  async function loadWinning() {
    const sources = ["/api/lotto", "winning-2026.json"];
    for (const url of sources) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const data = await r.json();
        if (Array.isArray(data) && data.length) return data;
      } catch {}
    }
    return [];
  }

  function renderWinning() {
    if (!winData.length) {
      $("winLoading").textContent = "당첨번호를 불러오지 못했어요.";
      return;
    }
    $("winLoading").hidden = true;
    $("winBody").hidden = false;
    const year = winData[0].date.slice(0, 4);
    $("winTitle").textContent = `${year}년 당첨번호`;
    $("winMeta").textContent = `${winData[winData.length - 1].round}~${winData[0].round}회 · ${winData.length}회차`;

    // 출현 횟수 (보너스 제외)
    const count = new Array(MAX + 1).fill(0);
    winData.forEach((d) => d.numbers.forEach((n) => count[n]++));
    const top = Array.from({ length: MAX }, (_, i) => i + 1)
      .sort((a, b) => count[b] - count[a] || a - b)
      .slice(0, 10);
    const hot = $("hot");
    hot.innerHTML = "";
    top.forEach((n) => {
      const item = document.createElement("div");
      item.className = "item";
      item.appendChild(ballEl(n, true));
      item.append(`${count[n]}회`);
      hot.appendChild(item);
    });

    const ol = $("winList");
    ol.innerHTML = "";
    winData.slice(0, winShown).forEach((d) => {
      const li = document.createElement("li");
      const rd = document.createElement("span");
      rd.className = "rd";
      rd.innerHTML = `<b>${d.round}회</b><br>${d.date.slice(5).replace("-", ".")}`;
      li.appendChild(rd);
      d.numbers.forEach((n) => li.appendChild(ballEl(n, true)));
      const plus = document.createElement("span");
      plus.className = "plus";
      plus.textContent = "+";
      li.append(plus, ballEl(d.bonus, true));
      ol.appendChild(li);
    });
    $("winMore").hidden = winShown >= winData.length;
  }

  // 추천 번호 중 직전 회차 당첨번호와 겹치는 번호 표시
  function markHits() {
    if (!winData.length) return;
    const last = new Set(winData[0].numbers);
    document.querySelectorAll(".game .ball").forEach((b) => {
      const hit = last.has(Number(b.textContent));
      b.classList.toggle("hit", hit);
      b.title = hit ? `${winData[0].round}회 당첨번호` : "";
    });
  }

  $("winMore").addEventListener("click", () => { winShown = winData.length; renderWinning(); });
  $("generate").addEventListener("click", markHits);

  renderPicker();
  renderHistory();
  loadWinning().then((d) => { winData = d; renderWinning(); });
})();
