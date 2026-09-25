import assert from "node:assert";

// Implementation under test (mirrored or tested directly)
function normalizeForDice(text) {
  if (!text) return "";
  return text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function extractBigrams(str) {
  const clean = normalizeForDice(str);
  const set = new Set();
  if (clean.length === 0) return set;
  if (clean.length === 1) {
    set.add(clean);
    return set;
  }
  for (let i = 0; i < clean.length - 1; i++) {
    set.add(clean.slice(i, i + 2));
  }
  return set;
}

function diceCoefficient(a, b) {
  const na = normalizeForDice(a);
  const nb = normalizeForDice(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    if (ratio >= 0.7) {
      return Math.max(0.7, ratio);
    }
  }

  const setA = extractBigrams(na);
  const setB = extractBigrams(nb);
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const bg of setA) {
    if (setB.has(bg)) intersection++;
  }

  return (2 * intersection) / (setA.size + setB.size);
}

function isSimilarMark(event, mark) {
  if (!event || !mark) return false;

  // 1. 同 filmId
  if (event.filmId && mark.filmId && event.filmId === mark.filmId) {
    return true;
  }

  const eventTitle = event.headline || event.filmTitle || "";
  const markTitle = mark.headline || "";
  const titleDice = diceCoefficient(eventTitle, markTitle);

  // 2. 同 type 且标题/headline Dice(bigram) ≥ 0.45
  if (event.type === mark.type && titleDice >= 0.45) {
    return true;
  }

  // 3. 或 headline/summary Dice ≥ 0.55
  if (titleDice >= 0.55) {
    return true;
  }

  const eventSummary = event.summary || "";
  const markSummary = mark.summary || "";
  if (eventSummary && markSummary) {
    if (diceCoefficient(eventSummary, markSummary) >= 0.55) {
      return true;
    }
    if (
      diceCoefficient(eventTitle, markSummary) >= 0.55 ||
      diceCoefficient(eventSummary, markTitle) >= 0.55
    ) {
      return true;
    }
  }

  return false;
}

function isBlockedOrSimilar(event, store) {
  if (!store || !store.blocked) return false;
  if (store.blocked[event.id]) return true;

  for (const mark of Object.values(store.blocked)) {
    if (isSimilarMark(event, mark)) {
      return true;
    }
  }
  return false;
}

// Tests
console.log("Running dismiss logic tests...");

// Test 1: Direct ID block
const event1 = {
  id: "ev-1",
  type: "auteur",
  filmId: "film-a",
  filmTitle: "电影A",
  headline: "电影A 定档明年",
  summary: "这是电影A的定档消息",
};

const store = {
  blocked: {
    "ev-1": {
      at: 1000,
      type: "auteur",
      filmId: "film-a",
      headline: "电影A 定档明年",
      summary: "这是电影A的定档消息",
    },
  },
};

assert.strictEqual(isBlockedOrSimilar(event1, store), true, "Direct block should match");

// Test 2: Same filmId hides all timeline events for that film
const event2SameFilm = {
  id: "ev-2",
  type: "win",
  filmId: "film-a",
  filmTitle: "电影A",
  headline: "电影A 斩获最佳影片",
  summary: "电影A 在威尼斯斩获大奖",
};
assert.strictEqual(isBlockedOrSimilar(event2SameFilm, store), true, "Same filmId should be hidden");

// Test 3: Different filmId, different title -> should not hide
const event3Different = {
  id: "ev-3",
  type: "win",
  filmId: "film-b",
  filmTitle: "电影B",
  headline: "电影B 荣获金狮奖",
  summary: "完全不同的电影和导演",
};
assert.strictEqual(isBlockedOrSimilar(event3Different, store), false, "Different film should not be hidden");

// Test 4: Honor/jury without filmId, same type and similar title Dice >= 0.45
const juryEventA = {
  id: "jury-1",
  type: "auteur",
  filmTitle: "戛纳电影节评审团主席公布",
  headline: "戛纳电影节公布主竞赛评审团主席：格蕾塔·葛韦格出任",
  summary: "格蕾塔·葛韦格将担任第77届戛纳电影节主竞赛单元评审团主席",
};

const juryMarkA = {
  at: 2000,
  type: "auteur",
  headline: "戛纳电影节公布主竞赛评审团主席：格蕾塔·葛韦格出任",
  summary: "格蕾塔·葛韦格出任戛纳评审团主席",
};

const juryEventB = {
  id: "jury-2",
  type: "auteur",
  filmTitle: "戛纳主竞赛评审团",
  headline: "第77届戛纳电影节主竞赛评审团主席葛韦格",
  summary: "格蕾塔·葛韦格出任主竞赛主席",
};

assert.strictEqual(
  isSimilarMark(juryEventB, juryMarkA),
  true,
  "Honor/jury without filmId with similar title should match"
);

// Test 5: Summary Dice >= 0.55
const newsEvent = {
  id: "news-1",
  type: "nomination",
  filmId: "film-c",
  filmTitle: "独立片C",
  headline: "一部全新独立电影获得提名",
  summary: "由青年导演执导的首部长片作品入围洛迦诺电影节当代电影人单元",
};

const newsMark = {
  at: 3000,
  type: "win",
  filmId: "film-d", // different filmId
  headline: "洛迦诺喜讯",
  summary: "由青年导演执导的首部长片作品入围洛迦诺电影节当代电影人单元", // identical summary
};

assert.strictEqual(
  isSimilarMark(newsEvent, newsMark),
  true,
  "Headline/summary Dice >= 0.55 should match even with different type/filmId"
);

console.log("All dismiss logic tests PASSED!");
