/**
 * **figma 화면에 원본의 장면 그림이 있나** (2026-10-02, 사용자 요청 — 「figma에 ai까지 붙여줬는데 이걸 구분 못하는거면 문제가 있는거아닌가」).
 *
 * 9호 KOL1M08W4S2(K36)는 원본이 7호(박사 · 책상)로 정해진 채 만들어졌다. figma 화면에는 2호의 탐험가가 있었다.
 * 원본은 AI 보다 먼저 정해지고 그 뒤로는 아무도 「이 원본이 맞나」를 묻지 않았다 — figma 는 좌표와 짝짓기에만 쓰였다.
 * 그 화면에서 2호 탐험가는 0.65 · 2호 테두리는 1.00, 7호 박사는 0.04 · 7호 테두리는 0.00 으로 맞았다(AI 없이 한 장 0.2초).
 *
 * - **장면 그림**은 후보 완성본의 그림 가운데 **GameData 가 이름을 안 부르는 것**이다 — 이닝마다 바뀌는 사진 · 낱말은
 *   GameData 가 부르고, 인물 · 테두리 · 소품처럼 모듈 화면에 늘 있는 것은 AssetTable 에만 있다(대사 자리 가르기와 같은 셈, 앱 `voice.ts`)
 * - **모든 후보가 바이트까지 같은 그림은 뺀다** — 어느 후보에도 똑같이 맞아 가르는 힘이 없고 시간만 든다
 * - 후보마다 넓은 것부터 `PER` 장. 자리는 절반 크기에서 찾고(네 배 빠르다) 맞음은 원래 크기에서 잰다 · 2배로 내보낸 그림은 절반으로 한 번 더
 * - 후보는 같은 칸부터 `MAX_CANDS` 곳까지
 * - 찾기 · 검산은 `imgfind.ts` 그대로 — 그림의 불투명 픽셀이 그 자리에 몇 % 맞나(`ratio`). `HIT` 이상이면 「있다」
 *
 * 가르는 것은 부르는 쪽이다(앱 `scene.ts` · `tool/scenegate.ts`). 여기는 그림을 고르고 재기만 한다.
 */

import path from "node:path";
import { fileOf, printOf, rscOfDone } from "./common";
import { findImage, findNear } from "./imgfind";
import { pngSize, readPng, type Bitmap } from "./png";
import { findUsers } from "./survey";

/** 이만큼 맞으면 화면에 그 그림이 있다 — 쌍안경에 반쯤 가린 2호 탐험가가 0.65 였다 */
export const HIT = 0.6;
/** 후보 하나에서 재는 그림 수 — 넓은 것부터 */
export const PER = 6;
/** 이보다 작은 그림은 안 본다 — 단추 · 점 같은 것은 어디에나 비슷한 것이 있다 */
const MIN_SIDE = 40;
const SCREEN = { w: 1920, h: 1080 };

/** 가로 세로 절반 — 2x2 픽셀의 평균. 알파가 낮은 픽셀은 색에 덜 섞는다 */
export function halfOf(b: Bitmap): Bitmap {
  const w = Math.floor(b.w / 2), h = Math.floor(b.h / 2);
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let r = 0, g = 0, bl = 0, a = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const o = ((y * 2 + dy) * b.w + x * 2 + dx) * 4;
        const al = b.data[o + 3] as number;
        r += (b.data[o] as number) * al;
        g += (b.data[o + 1] as number) * al;
        bl += (b.data[o + 2] as number) * al;
        a += al;
      }
      const o = (y * w + x) * 4;
      if (a) {
        data[o] = Math.round(r / a);
        data[o + 1] = Math.round(g / a);
        data[o + 2] = Math.round(bl / a);
      }
      data[o + 3] = Math.round(a / 4);
    }
  }
  return { w, h, data };
}

/** GameData 안의 글자 값 전부 — 그 이름의 그림은 이닝마다 바뀌는 것이다 */
function namesIn(v: unknown, out = new Set<string>()): Set<string> {
  if (typeof v === "string") out.add(v);
  else if (Array.isArray(v)) for (const x of v) namesIn(x, out);
  else if (v && typeof v === "object") for (const x of Object.values(v)) namesIn(x, out);
  return out;
}

export type SceneFile = { file: string; rel: string; w: number; h: number };

/**
 * 후보마다 잴 장면 그림. `module` 의 완성본 GameData 를 읽어 이름을 부르는 그림을 뺀다.
 * 후보 폴더를 못 읽으면 빈 목록이다 — 부르는 쪽이 「잴 그림 없음」으로 센다
 */
export function sceneFiles(subject: string, module: string, cands: string[]): Map<string, SceneFile[]> {
  const data = new Map(findUsers(subject, module).map((u) => [u.code, u.data]));
  const all = new Map<string, SceneFile[]>();
  for (const code of cands) {
    const called = namesIn(data.get(code));
    const dir = rscOfDone(code);
    const list: SceneFile[] = [];
    for (const [key, rel] of fileOf(code)) {
      if (!key.startsWith("image|") || !/\.png$/i.test(rel)) continue;
      if (called.has(key.slice("image|".length))) continue;
      const file = path.join(dir, rel);
      const s = pngSize(file);
      if (!s || Math.min(s.w, s.h) < MIN_SIDE) continue;
      // 화면 두 배보다 크면 절반으로 줄여도 화면에 안 들어간다
      if (s.w > SCREEN.w * 2 || s.h > SCREEN.h * 2) continue;
      if (!list.some((x) => x.rel === rel)) list.push({ file, rel, w: s.w, h: s.h });
    }
    all.set(code, list);
  }
  // 모든 후보가 바이트까지 같은 그림은 가르는 힘이 없다
  const printsOf = (l: SceneFile[]): Set<string> => new Set(l.map((f) => printOf(f.file) ?? f.file));
  const sets = [...all.values()].map(printsOf);
  const everywhere = (p: string): boolean => sets.length > 1 && sets.every((s) => s.has(p));
  const out = new Map<string, SceneFile[]>();
  for (const [code, list] of all) {
    out.set(
      code,
      list
        .filter((f) => !everywhere(printOf(f.file) ?? f.file))
        .sort((a, b) => b.w * b.h - a.w * a.h)
        .slice(0, PER),
    );
  }
  return out;
}

/**
 * 견줄 화면 — **1x 이닝 화면(1920×1080)만** 쓴다. 2026-09-21 에 붙인 영어 화면은 8320×11370 통째 캡처라
 * 그림 한 장에 30~50초가 걸렸고, 크기가 달라 맞아도 뜻이 없다(그림이 1x 가 아니다)
 */
export const isSceneShot = (b: Bitmap): boolean => b.w === SCREEN.w && b.h === SCREEN.h;

/** 견줄 화면 한 장 — 원래 크기와 절반 */
export type SceneShot = { full: Bitmap; half: Bitmap };

/**
 * **자리는 절반 크기에서 찾고, 맞음은 원래 크기에서 잰다.** 절반에서는 자리가 넷에 하나라 네 배쯤 빠르다.
 * 그런데 절반에서 잰 비율은 믿지 못한다 — 9호 figma 에서 7호 글상자(`record_text_box`)가 원래 크기 0.11 인데 절반에서 0.91 이었다
 * (흐려진 흰 상자가 아무 흰 상자에나 맞는다). 그러면 틀린 원본에도 맞은 그림이 생겨 카드가 안 나온다.
 * 1x 가 아닌 화면은 뺀다(`isSceneShot`)
 */
export function sceneShots(raw: Bitmap[]): SceneShot[] {
  return raw.filter(isSceneShot).map((full) => ({ full, half: halfOf(full) }));
}

/** 이보다 많은 후보는 안 잰다 — 수학 M05 는 후보가 스물두 곳이고 다 재면 2분이 넘었다 */
export const MAX_CANDS = 8;

/** 잴 후보 — 같은 칸(레벨 · 주 · 순서)을 먼저, 나머지는 추천 차례로 `MAX_CANDS` 까지. 지금 원본은 늘 넣는다 */
export function sceneCands(choices: { code: string; sameSlot: boolean }[], self: string, now: string): string[] {
  const list = choices.filter((c) => c.code !== self);
  const ordered = [...list.filter((c) => c.sameSlot), ...list.filter((c) => !c.sameSlot)].map((c) => c.code);
  const out = ordered.slice(0, MAX_CANDS);
  if (now && !out.includes(now) && ordered.includes(now)) out[out.length - 1] = now;
  return out;
}

/** 그림 한 장이 화면들 가운데 어디에 제일 잘 맞나 — 0~1. 2x 로 내보낸 그림은 절반으로 줄여 한 번 더 */
export function sceneRatio(shots: SceneShot[], f: SceneFile, memo?: Map<string, number>): number {
  // 후보 여럿이 바이트까지 같은 그림을 쓴다(M05 배경은 스무 곳) — 한 번만 잰다
  const key = printOf(f.file) ?? f.file;
  const hit = memo?.get(key);
  if (hit !== undefined) return hit;
  const r = ratioOf(shots, f);
  memo?.set(key, r);
  return r;
}

function ratioOf(shots: SceneShot[], f: SceneFile): number {
  const t = readPng(f.file);
  if (!t) return 0;
  // 1x 그림 그대로 한 번, 2x 로 내보낸 그림은 절반으로 한 번. 찾기는 그 절반(`look`)으로, 재기는 그 크기(`img`)로
  const half = halfOf(t);
  const tries: { img: Bitmap; look: Bitmap }[] = [];
  if (t.w <= SCREEN.w && t.h <= SCREEN.h) tries.push({ img: t, look: half });
  if (half.w >= MIN_SIDE && half.h >= MIN_SIDE) tries.push({ img: half, look: halfOf(half) });
  let best = 0;
  for (const { img, look } of tries) {
    for (const s of shots) {
      const at = findImage(s.half, look);
      if (!at) continue;
      const got = findNear(s.full, img, at.x * 2, at.y * 2, 3);
      best = Math.max(best, got?.ratio ?? 0);
    }
    if (best >= HIT) break;
  }
  return best;
}

export type SceneScore = { code: string; hits: number; tried: number; seen: { rel: string; ratio: number }[] };

/** 이보다 낮으면 화면에 「없다」 — 7호 박사가 9호 화면에서 0.17, 테두리가 0.00 이었다 */
export const MISS = 0.2;

/**
 * 받은 점수로 「원본이 틀린 것 같다」를 가른다. 셋이 다 맞을 때만 —
 * ① 지금 원본의 장면 그림 **둘 이상이 화면에 없고**(`MISS` 밑) ② 다른 후보가 **둘 이상** 맞고 ③ 지금 원본보다 많이 맞는다.
 * 「하나도 안 맞아야」로 두면 못 잡는다 — 7호 흰 글상자가 9호 화면의 흰 상자에 0.90 으로 맞았다(박사 · 테두리는 없었다).
 * 다 안 맞으면 말하지 않는다 — 장면을 새로 그린 회차다. 맞는 후보가 지금 원본이면 null.
 * `tool/scenegate.ts` 로 잰 값(2026-10-02): 9호 국어 넷 · 수학 8호 하나에서 원본이 맞은 셋은 조용하고, 7호를 원본으로 두면 2호를 권한다
 */
export function sceneVerdict(scores: SceneScore[], now: string): SceneScore | null {
  const mine = scores.find((s) => s.code === now);
  if (!mine || mine.tried === 0) return null;
  if (mine.seen.filter((s) => s.ratio < MISS).length < 2) return null;
  const best = [...scores].sort((a, b) => b.hits - a.hits)[0];
  if (!best || best.code === now || best.hits < 2 || best.hits <= mine.hits) return null;
  return best;
}
