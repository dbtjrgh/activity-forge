/**
 * **figma 화면 PNG 에서 좌표를 찾아 GameData 의 자리 칸에 넣을 값을 낸다** (2026-09-28).
 *
 * 좌표는 원본(앞 회차) 값을 그대로 두면 MAL2M07W2S1 에서 50자리 중 38자리가 완성본과 100px 넘게
 * 떨어졌다(보기 그림 291~491px). 화면 한 장(1920×1080, figma 에서 PNG 1x 로 내보낸 것)에서
 * 리소스 그림을 픽셀로 찾으면 단추가 1.3px 안, 보기가 0~81px 이다(`tool/imgfind.ts`).
 *
 * **사람은 한 장만 준다**(사용자 결정). 그래서 넷으로 가른다 —
 *   found  그 화면에서 찾았다(겹쳐 맞는 비율 90% 이상) — 그 자리 그대로
 *   slot   이닝 표에서 화면에 없는 이닝 — **자리 번호가 같은 칸의 가운데**에 그 이닝 그림을 놓는다.
 *          자리 번호는 `fileTables.shows`(M05 는 `M05_View.answer`)가 준다. 짐작이라 부르는 쪽이 알린다
 *   state  `_correct`·`_wrong`·`_effect` — 기본 그림(`_basic`·`_idle`)에서 **앞 회차만큼 비껴** 놓는다
 *   carry  못 찾은 칸 — 같은 표 · 같은 번호의 찾은 칸이 움직인 만큼 같이 옮긴다(캐릭터 k 는 단추 k 를 따라)
 *   (없음) 그래도 못 정한 것은 안 낸다 — 앞 회차 값이 그대로 남는다
 * 크기(width·height)는 리소스 그림의 크기다.
 *
 * AI 를 안 부른다. 파일을 안 쓴다 — 낸 목록을 앱(`shotcoords.ts`)이 레시피에 얹는다.
 */

import fs from "node:fs";
import path from "node:path";
import { findImage, type Placed } from "./imgfind";
import { readPng, type Bitmap } from "./png";
export { pngSize } from "./png";

import { get, isBox, plainBoxes, tableCells, type Box } from "./placespots";
import { type PlaceHit, SURE_AT, TABLE_AT, STATE, SKIP, centered, type PlaceInput, type Places } from "./placeinput";
export { boxSpots, isBox, type Box } from "./placespots";
export function findPlaces(inp: PlaceInput): Places {
  const SURE = inp.sure ?? SURE_AT;
  const SURE_TB = inp.sureTable ?? TABLE_AT;
  const notes: string[] = [];
  const screens = inp.screens
    .map((f) => ({ f, s: readPng(f) }))
    .filter((x): x is { f: string; s: Bitmap } => {
      if (x.s && x.s.w === 1920 && x.s.h === 1080) return true;
      notes.push(`${path.basename(x.f)} 는 ${x.s ? `${x.s.w}×${x.s.h}` : "못 읽는 그림"}이라 안 봤습니다 — figma 에서 프레임을 PNG 1x(1920×1080)로 내보내 붙여 주세요`);
      return false;
    });
  if (!screens.length) return { hits: [], notes, screens: inp.screens.map(() => null) };

  const bmp = new Map<string, Bitmap | null>();
  const img = (file: string | null): Bitmap | null => {
    if (!file || !fs.existsSync(file)) return null;
    if (!bmp.has(file)) bmp.set(file, readPng(file));
    return bmp.get(file) ?? null;
  };
  const best = (t: Bitmap, base: Placed[][] = []): { x: number; y: number; ratio: number } | null => {
    let out: { x: number; y: number; ratio: number } | null = null;
    screens.forEach(({ s }, i) => {
      const f = findImage(s, t, base[i] ?? []);
      if (f && (!out || f.ratio > out.ratio)) out = { x: f.x, y: f.y, ratio: f.ratio };
    });
    return out;
  };

  const hits: PlaceHit[] = [];
  const head = inp.root ? `${inp.root}.` : "";
  /** 화면마다 몇 이닝인가 — 비교 캔버스가 「이 이닝 화면 없음」을 가린다. 이닝 표가 없거나 못 정했으면 null */
  const screenInning: (number | null)[] = inp.screens.map(() => null);

  // ① 이닝과 상관없는 자리 — 키가 곧 별칭이다
  const plain = plainBoxes(inp.gameData, inp.tables);
  const foundBox = new Map<string, Box>();
  for (const p of plain) {
    if (STATE.test(p.key) || SKIP.test(p.key)) continue;
    const t = img(inp.imageOf(p.key));
    const f = t ? best(t) : null;
    if (!t || !f || f.ratio < SURE) continue;
    const box = { x: f.x, y: f.y, width: t.w, height: t.h };
    foundBox.set(p.at, box);
    hits.push({ path: head + p.at, box, how: "found", ratio: f.ratio });
  }

  // ② 이닝 표 — 화면에 있는 이닝은 찾고, 없는 이닝은 자리 번호로 놓는다
  for (const tb of inp.tables) {
    const cells = tableCells(inp.gameData, inp.rscDir, tb).map((c) => ({ ...c, t: img(c.file) }));
    // **화면마다 몇 이닝인지 먼저 정한다** — 이닝끼리 같은 그림(같은 동물)을 쓰면 3이닝 칸이
    // 1이닝 화면에서 「찾아진다」. 찾은 칸이 제일 많은 이닝이 그 화면의 이닝이고, 그 이닝 칸만 받는다.
    const tries = cells.map((c) =>
      screens.map(({ s }) => (c.t ? findImage(s, c.t) : null)).map((f) => (f && f.ratio >= SURE_TB ? f : null)),
    );
    const inningOf = screens.map((_, k) => {
      const count = new Map<number, number>();
      cells.forEach((c, ci) => tries[ci]?.[k] && count.set(c.i, (count.get(c.i) ?? 0) + 1));
      return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
    });
    // 표가 여럿이면 먼저 정한 표를 따른다 — 한 화면은 한 이닝이다
    screens.forEach(({ f }, k) => {
      const at = inp.screens.indexOf(f);
      if (at >= 0 && screenInning[at] === null && (inningOf[k] ?? -1) >= 0) screenInning[at] = inningOf[k] as number;
    });
    // 찾은 칸 · 자리 번호(n)마다 가운데
    const center = new Map<number, { cx: number; cy: number }>();
    const done = new Set<string>();
    for (const [ci, c] of cells.entries()) {
      if (!c.t) continue;
      const k = screens.findIndex((_, sk) => inningOf[sk] === c.i && tries[ci]?.[sk]);
      const f = k >= 0 ? tries[ci]?.[k] : null;
      if (!f) continue;
      const box = { x: f.x, y: f.y, width: c.t.w, height: c.t.h };
      hits.push({ path: head + c.at, box, how: "found", ratio: f.ratio });
      done.add(c.at);
      if (!center.has(c.n)) center.set(c.n, { cx: f.x + c.t.w / 2, cy: f.y + c.t.h / 2 });
    }
    let guessed = 0;
    for (const c of cells) {
      if (done.has(c.at) || !c.t) continue;
      const at = center.get(c.n);
      if (!at) continue;
      hits.push({ path: head + c.at, box: centered(at, c.t), how: "slot" });
      guessed += 1;
    }
    if (guessed) {
      notes.push(`${tb.table} 의 ${guessed}칸은 화면에 없는 이닝이라 같은 자리 번호의 가운데에 놓았습니다 — 정확히 하려면 그 이닝 화면을 더 붙여 주세요`);
    }
  }

  // ③ 상태 그림 — 기본 그림에서 앞 회차만큼 비껴
  for (const p of plain) {
    if (!STATE.test(p.key)) continue;
    const t = img(inp.imageOf(p.key));
    if (!t) continue;
    const baseAt = [p.at.replace(STATE, "_basic"), p.at.replace(STATE, "_idle")].find((a) => foundBox.has(a));
    const base = baseAt ? foundBox.get(baseAt) : undefined;
    const was = get(inp.gameData, p.at), wasBase = baseAt ? get(inp.gameData, baseAt) : undefined;
    if (!base || !isBox(was) || !isBox(wasBase)) continue;
    // 앞 회차에서 기본 그림보다 비껴 있던 만큼을 지킨다 — M05 완성본 앞뒤 호 225쌍 중 196쌍이 15px 안
    // (가운데를 같게 하면 191쌍 — 활동마다 12px 쯤 일부러 비껴 둔 것이 있다)
    const dx = was.x + was.width / 2 - (wasBase.x + wasBase.width / 2);
    const dy = was.y + was.height / 2 - (wasBase.y + wasBase.height / 2);
    hits.push({ path: head + p.at, box: centered({ cx: base.x + base.width / 2 + dx, cy: base.y + base.height / 2 + dy }, t), how: "state" });
  }

  // ④ 못 찾은 칸 — **같은 표 · 같은 번호의 찾은 칸이 움직인 만큼 같이 옮긴다.** figma 는 캐릭터를
  // 리소스보다 작게 그려 캐릭터를 못 찾는데, 캐릭터 k 는 제 단추 k 위에 선다. M05 완성본 앞뒤 호 186쌍 중
  // 166쌍이 40px 안(15px 안 129) — 제자리에 두면 100~460px 이다(MAL2M07W2S1).
  const placed = new Set(hits.map((h) => h.path.slice(head.length)));
  const moved = new Map<string, { dx: number; dy: number }>();
  for (const [at, box] of foundBox) {
    const was = get(inp.gameData, at);
    const num = at.split(".").pop()?.match(/\d+/)?.[0];
    if (!isBox(was) || num === undefined) continue;
    const key = `${at.slice(0, at.lastIndexOf("."))}#${num}`;
    if (!moved.has(key)) {
      moved.set(key, { dx: box.x + box.width / 2 - (was.x + was.width / 2), dy: box.y + box.height / 2 - (was.y + was.height / 2) });
    }
  }
  let carried = 0;
  for (const p of plain) {
    if (placed.has(p.at) || SKIP.test(p.key)) continue;
    const num = p.key.match(/\d+/)?.[0];
    const d = num === undefined ? undefined : moved.get(`${p.at.slice(0, p.at.lastIndexOf("."))}#${num}`);
    const was = get(inp.gameData, p.at);
    if (!d || !isBox(was) || was.width <= 1) continue;
    const t = img(inp.imageOf(p.key));
    const w = t?.w ?? was.width, h = t?.h ?? was.height;
    const cx = was.x + was.width / 2 + d.dx, cy = was.y + was.height / 2 + d.dy;
    hits.push({ path: head + p.at, box: { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), width: w, height: h }, how: "carry" });
    carried += 1;
  }
  if (carried) notes.push(`${carried}칸은 화면에서 못 찾아 같은 번호의 찾은 칸이 움직인 만큼 옮겼습니다`);
  return { hits, notes, screens: screenInning };
}

//
// **입력 · 결과 모양과 문턱값은 떼어 냈습니다** (2026-09-30, 203줄이라 — 동작 변화 없음). 바깥은 여태처럼 이 파일에서 가져다 씁니다.
//
//   placeinput     좌표 찾기의 입력 · 결과 모양과 문턱값

export { type PlaceHit, STATE, SKIP, type PlaceInput, type Places } from "./placeinput";
