// 올해 로또 6/45 당첨번호를 동행복권에서 가져오는 Vercel 서버리스 함수
// GET /api/lotto  ->  [{ round, date, numbers, bonus, firstWinners, firstPrize }, ...] (최신 회차가 먼저)

const UPSTREAM = "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=";
const BASE_ROUND = 1205; // 2026-01-03 추첨
const BASE_DRAW = Date.UTC(2026, 0, 3, 12, 0); // 21:00 KST (추첨 직후 여유 포함)
const WEEK = 7 * 24 * 60 * 60 * 1000;

function roundAt(time) {
  return BASE_ROUND + Math.floor((time - BASE_DRAW) / WEEK);
}

async function fetchRound(n) {
  const r = await fetch(UPSTREAM + n, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  const x = (await r.json())?.data?.list?.[0];
  if (!x || x.ltEpsd !== n) return null;
  const d = String(x.ltRflYmd);
  return {
    round: n,
    date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
    numbers: [1, 2, 3, 4, 5, 6].map((i) => x[`tm${i}WnNo`]).sort((a, b) => a - b),
    bonus: x.bnsWnNo,
    firstWinners: x.rnk1WnNope,
    firstPrize: x.rnk1WnAmt,
  };
}

module.exports = async (req, res) => {
  try {
    const now = Date.now();
    const kstYear = new Date(now + 9 * 3600 * 1000).getUTCFullYear();
    const latest = roundAt(now);
    const first = Math.max(1, roundAt(Date.UTC(kstYear, 0, 1)) - 1);

    const rounds = [];
    for (let n = latest; n >= first; n--) rounds.push(n);
    const results = await Promise.all(rounds.map((n) => fetchRound(n).catch(() => null)));
    const list = results.filter((r) => r && r.date.startsWith(String(kstYear)));
    if (list.length === 0) throw new Error("no data");

    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json(list);
  } catch (e) {
    res.status(502).json({ error: "당첨번호를 가져오지 못했어요." });
  }
};
