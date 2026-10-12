// 맞추기 규칙 ①~⑥ — 원본 자리마다 폴더의 파일을 위에서부터 한 규칙씩 짝짓는다. **차례가 곧 규칙이다.**
//
// 2026-09-30 에 `swap.ts` 에서 옮김 — 477줄이라. **동작 변화 없음.** 까닭 · 잰 값은 `swap.ts` 머리말.

import path from "path";
import { DEFAULT_BASE } from "./render";
import type { AssetKind, AssetBase, Recipe, RecipeAsset } from "./types";
import type { SwapHit, SwapRule } from "./swap";
import { boneOf, countBy, digitsOf, norm, NUM_LEAST, NUM_MOST, stem, tailOf } from "./swapnames";

const KINDS: AssetKind[] = ["font", "image", "sound", "lottie"];

// base → 액티비티 리소스 폴더 안의 자리.
// **font 는 null 입니다** — 폰트는 `/sparklab/font` 로 액티비티 폴더 밖에 있어
// 회차마다 갈리지 않습니다. 갈아끼울 것이 아닙니다.
const BASE_DIR: Record<AssetBase, string | null> = {
  root: "",
  images: "images",
  sounds: "sounds",
  animations: "animations",
  font: null,
};

/** 짝을 지을 후보 한 자리 */
export type Slot = { kind: AssetKind; asset: RecipeAsset; rel: string; sub: string };

/** 원본 자리마다 폴더 파일을 ①~⑥ 차례로 짝짓는다 — 짝(`hits`) · 아무도 안 가져간 파일(`free`) · 못 맞춘 자리(`left`). `take` 가 레시피의 파일 이름을 바로 고친다 */
export function pairSlots(recipe: Recipe, files: string[], originNorm: string, newNorm: string): { free: Set<string>; hits: SwapHit[]; left: Set<Slot> } {
  // 아직 아무도 안 가져간 파일. 규칙을 위에서부터 돌리며 하나씩 뺍니다.
  const free = new Set(files);
  const hits: SwapHit[] = [];

  // 짝을 지을 후보를 한 줄로 펴 둡니다 — 규칙마다 전부 훑어야 하니까요.
  const slots: Slot[] = [];
  for (const kind of KINDS) {
    for (const asset of recipe.assets?.[kind] ?? []) {
      const sub = BASE_DIR[asset.base ?? DEFAULT_BASE[kind]];
      if (sub === null) continue; // 폰트 — 갈아끼울 것이 아닙니다
      slots.push({ kind, asset, rel: sub === "" ? asset.file : `${sub}/${asset.file}`, sub });
    }
  }

  const left = new Set(slots);
  const take = (s: Slot, to: string, rule: SwapRule): void => {
    free.delete(to);
    left.delete(s);
    hits.push({ kind: s.kind, alias: s.asset.alias, from: s.rel, to, rule });
    // **갈래 폴더만 뗍니다.** 전에는 마지막 `/` 까지 다 떼서 `bgm/x.mp3` 가
    // `x.mp3` 가 됐습니다 — 한 겹 더 들어간 폴더는 **이름의 일부**라,
    // 떼어 버리면 레시피에 없는 경로가 들어가 브라우저에서 404 입니다.
    // 여태 안 드러난 것은 위 `readFolder` 가 두 겹 파일을 아예 안 줬기 때문입니다.
    s.asset.file = s.sub && to.startsWith(`${s.sub}/`) ? to.slice(s.sub.length + 1) : to;
  };

  // ① 그대로
  for (const s of [...left]) {
    const f = [...free].find((x) => x.toLowerCase() === s.rel.toLowerCase());
    if (f) take(s, f, "same");
  }

  // ② 학습코드만 다릅니다 (밑줄·대소문자 무시)
  if (originNorm !== newNorm) {
    const byNorm = new Map<string, string>();
    for (const f of free) byNorm.set(norm(f), f);
    for (const s of [...left]) {
      const n = norm(s.rel);
      if (!n.includes(originNorm)) continue;
      const f = byNorm.get(n.split(originNorm).join(newNorm));
      if (f && free.has(f)) take(s, f, "code");
    }
  }

  // ③ 확장자만 다릅니다
  {
    const byStem = countBy([...free], (f) => norm(stem(f)));
    const pick = new Map<string, string>();
    for (const f of free) pick.set(norm(stem(f)), f);
    for (const s of [...left]) {
      const raw = norm(stem(s.rel));
      const key = raw.includes(originNorm) ? raw.split(originNorm).join(newNorm) : raw;
      if (byStem.get(key) !== 1) continue;
      const f = pick.get(key);
      if (f && free.has(f)) take(s, f, "ext");
    }
  }

  // ④ 마디 하나가 숫자만 다릅니다 — **무리째로 볼 때만** (빗장 ㉠~㉣ 은 머리말)
  {
    const byBone = new Map<string, Slot[]>();
    for (const s of left) byBone.set(boneOf(s.rel), [...(byBone.get(boneOf(s.rel)) ?? []), s]);
    const freeBone = new Map<string, string[]>();
    for (const f of free) freeBone.set(boneOf(f), [...(freeBone.get(boneOf(f)) ?? []), f]);

    for (const [bone, mine] of byBone) {
      const theirs = freeBone.get(bone) ?? [];
      if (!theirs.length || theirs.length > NUM_MOST) continue; // ㉣
      const ours = mine.map((s) => ({ s, n: digitsOf(s.rel) }));
      const yours = theirs.map((f) => ({ f, n: digitsOf(f) }));
      const width = ours[0].n.length;
      if (!width || yours.some((y) => y.n.length !== width)) continue;

      // ㉠㉡ 무리 전체에서 같은 값으로 갈린 마디가 **딱 하나**인가
      const at: number[] = [];
      for (let i = 0; i < width; i += 1) {
        const vo = ours[0].n[i];
        const vf = yours[0].n[i];
        if (ours.some((o) => o.n[i] !== vo) || yours.some((y) => y.n[i] !== vf)) continue;
        if (vo === vf || vo.length !== vf.length) continue;
        if (vo.length < NUM_LEAST || vo[0] !== vf[0]) continue;
        at.push(i);
      }
      if (at.length !== 1) continue;

      // 갈린 마디를 뺀 나머지 번호가 **자리표**입니다. 원본 쪽에서 겹치면 접습니다.
      const rest = (n: string[]): string => n.filter((_, i) => i !== at[0]).join("|");
      const seat = new Map<string, Slot>();
      let twice = false;
      for (const o of ours) {
        if (seat.has(rest(o.n))) {
          twice = true;
          break;
        }
        seat.set(rest(o.n), o.s);
      }
      if (twice) continue;
      // ㉢ 폴더에 원본이 안 쓰던 번호가 하나라도 있으면 번호를 다시 매긴 것입니다.
      if (yours.some((y) => !seat.has(rest(y.n)))) continue;
      for (const y of yours) take(seat.get(rest(y.n)) as Slot, y.f, "num");
    }
  }

  // ⑤ 꼬리가 같고, 원본에도 새 폴더에도 그런 것이 하나뿐일 때만
  {
    const key = (rel: string): string => `${rel.includes("/") ? rel.split("/")[0] : ""}|${tailOf(rel)}`;
    const hasTail = (rel: string): boolean => tailOf(rel) !== "";
    const inFolder = countBy([...free], key);
    const inOrigin = countBy([...left], (s) => key(s.rel));
    const pick = new Map<string, string>();
    for (const f of free) pick.set(key(f), f);
    for (const s of [...left]) {
      if (!hasTail(s.rel)) continue;
      const k = key(s.rel);
      if (inFolder.get(k) !== 1 || inOrigin.get(k) !== 1) continue;
      const f = pick.get(k);
      if (f && free.has(f)) take(s, f, "tail");
    }
  }

  // ⑥ 하나뿐 — **영상(`.mp4`)은 원본에도 새 폴더에도 하나씩이면 짝입니다** (2026-09-23).
  // 영상은 회차마다 이름이 제각각으로 옵니다(`video.mp4` → `MAL1M07W3S1_ani_v1.1.mp4`).
  // 영상 모듈은 한 회차에 영상이 하나라 이름을 몰라도 짝이 정해집니다. 그림·소리에는
  // 안 씁니다 — 하나 남은 png 가 그 자리 것이라는 보장이 없습니다.
  {
    const ONE_PER = [".mp4"];
    const ext = (rel: string): string => path.extname(rel).toLowerCase();
    for (const e of ONE_PER) {
      const mine = [...left].filter((s) => ext(s.rel) === e);
      const theirs = [...free].filter((f) => ext(f) === e);
      // 짝만 짓습니다. **파일 이름은 앱이 원본 이름(`video.mp4`)으로 바꿉니다**
      // (`electron_app/.../rscname.ts`) — AssetTable 이 제멋대로 온 이름을 가리키게
      // 두지 않습니다(2026-09-23 사용자 결정 — 사람은 파일 이름을 바꿔 넣는다).
      if (mine.length === 1 && theirs.length === 1) take(mine[0] as Slot, theirs[0] as string, "only");
    }
  }

  return { free, hits, left };
}
