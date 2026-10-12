// **이 alias 이름을 바꿔도 되나** — 자리를 새 파일로 세울 때 (2026-09-23).
//
// `restock.ts` 는 자리를 세울 때 **이름을 새 파일 이름으로 바꿉니다**(「사람이
// 그렇게 지어 왔다」). 낱말 자리(`paper_skirt` → `paper_crayon`)에서는 맞습니다.
// 그런데 **모듈이 그 이름을 코드에 박아 두고 찾는 자리**가 있습니다 —
// M05 는 `'particle'` 과 `'ending_anim_char_'` 를 코드에서 찾습니다(`M05_Button.ts`·
// `M05_Ending.ts`). 2026-09-23 에 값 고치기 AI 가 뒤바뀐 엔딩 애니를 바로잡으려고
// `#slot|lottie|ending_anim_char_0 = …bmon_talk.json` 을 답했고, 도구가 이름을
// `mal2m07w2s1_bmon_talk` 로 바꾸어 **엔딩이 통째로 안 뜨는 액티비티**가 됐습니다.
// GameData 는 표의 **열쇠**로 그 이름을 부르고 있어 값만 고치는 `recast` 로는
// 닿지도 않았습니다. 그날 넣은 관계 `image-key-is-alias` 가 그것을 잡았습니다.
//
// **가름 — 둘 다 「낱말」이라 할 때만 바꿉니다.**
//
//   ① 이름이 원본 파일 이름과 같다 (`paper_skirt` ← `paper_skirt.png`)
//   ② 같은 모듈의 **다른 완성본에는** 그 이름이 없다 (그 회차에만 있는 이름)
//
// 7호 완성본 전부로 잰 것 (`tool/renamerule.ts`) — 원본 → 완성본에서 사람이
// 이름을 바꿨나/뒀나를 가름이 맞히는지:
//
//   | 가름 | 「바꾼다」 맞음 · 틀림(모듈을 깰 수 있는 것) |
//   |---|---|
//   | ① 만 | 1,356 · **27** (`bgm`·`correct`·`button_0_correct`…) |
//   | ② 만 | 1,564 · **58** |
//   | **① 과 ②** | **902 · 3** (셋 다 측정 스크립트가 갈래를 뭉갠 것 — 실제 0) |
//
// **박힌 이름에서 박힌 이름으로는 바꿉니다** (같은 날 재생에서). MAL2M07W2S1 의
// `character_0_idle` → `character_0_body_idle` 는 둘 다 다른 M05 완성본에 있는 이름이라
// ② 가 「둔다」고 했지만 완성본은 바꿨습니다 — 몸·팔로 나눠 쓰는 캐릭터의 이름입니다.
// 그래서 **새 이름도 다른 완성본에 있으면** 바꿉니다. 단 새 이름이 이미 표에 있거나
// 같은 파일로 가는 자리가 둘 이상이면(`text_box_2`·`text_box_3` → `text_box_1.png`) 둡니다
// — 이름이 부딪칩니다. 이 줄을 더해도 7호에서 「사람은 뒀는데 바꾸는」 것은 **0** 입니다
// (그 두 빗장 없이는 36).
//
// 틀리는 쪽을 골랐습니다. **잘못 바꾸면 모듈이 조용히 깨지고, 잘못 두면
// 이름만 완성본과 다릅니다.** 두는 자리는 파일만 갈리므로 그림·소리는 새 것이
// 제대로 나옵니다 — 2026-09-17 근거 사례(ENL1M07W3S2)에서 36자리 중 30은 여전히
// 바꾸고, 여섯(`skirt_sound` 따위)은 이름을 둔 채 새 소리를 틉니다.

import { aliasOf } from "./restock";
import { assetAliases, findUsers } from "./survey";

/** 모듈마다 한 번만 센다 — 완성본을 다 읽는 일이라 무겁다. */
const cache = new Map<string, Map<string, Set<string>>>();

function namesOf(subject: string, module: string): Map<string, Set<string>> {
  const key = `${subject}/${module}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out = new Map<string, Set<string>>();
  for (const s of findUsers(subject, module)) {
    for (const a of assetAliases(s.dir).keys()) out.set(a, (out.get(a) ?? new Set()).add(s.code));
  }
  cache.set(key, out);
  return out;
}

/**
 * 그 모듈을 쓰는 완성본 가운데 `except`(원본 · 지금 만드는 회차) 말고 **다른 곳에도**
 * 나오는 alias 이름들. **만드는 회차를 꼭 빼야 한다** — 완성본을 다시 만들어 보는
 * 시험에서는 그 회차의 답지가 여기 끼어 가름이 답을 훔쳐 본다.
 */
export function namesInUse(subject: string, module: string, except: string[]): Set<string> {
  const skip = new Set(except);
  const out = new Set<string>();
  for (const [name, codes] of namesOf(subject, module)) {
    if ([...codes].some((c) => !skip.has(c))) out.add(name);
  }
  return out;
}

/**
 * 이름을 두고 파일만 갈아야 하나. `true` 면 **바꾸지 않는다.**
 * `move` — 바꾼다면 갈 이름과, 그 이름이 부딪치나(표에 이미 있거나 같은 파일로 가는 자리가 또 있다).
 */
export function keepsName(alias: string, originFile: string, inUse: Set<string>, move?: { to: string; clash: boolean }): boolean {
  if (move && move.to !== alias && !move.clash && inUse.has(move.to)) return false;
  const fromFile = originFile !== "" && alias === aliasOf(originFile);
  return !fromFile || inUse.has(alias);
}
