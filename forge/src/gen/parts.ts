// 몸·팔로 나눠 쓰는 캐릭터의 **부품 자리**.
//
// 어떤 회차는 캐릭터가 통그림 하나이고, 어떤 회차는 **몸과 팔이 갈라져** 있습니다.
// 갈라져 있으면 여섯 자리가 다 있어야 합니다 —
//
//   character_0_body_idle · body_correct · body_wrong
//   character_0_arm_idle  · arm_correct  · arm_wrong
//
// 하나라도 빠지면 **에러 없이 팔만 안 보입니다.** 띄워 보기 전에는 모릅니다.
//
// **여기 한 곳에 둡니다.** 이 셈을 두 곳이 하면 한쪽만 고쳐집니다(저장소 규칙 3) —
// 짚는 쪽(`resolveslotrules.ts` 의 `character-parts-consistent`)과 채우는 쪽(앱의
// `partfill.ts`)이 **같은 자리를 같은 이름으로** 불러야 합니다.

import type { Issue } from "./types";

/** 부품 별칭의 꼴. 갈래는 그림뿐입니다. */
export const PART_ALIAS = /^character_(\d+)_(body|arm)_(idle|correct|wrong)$/;

const PARTS = ["body", "arm"] as const;
const STATES = ["idle", "correct", "wrong"] as const;

/**
 * 빠진 부품 별칭을 캐릭터 번호 차례로.
 *
 * **몸·팔 자리가 하나라도 있는 캐릭터만 봅니다.** 통그림 캐릭터
 * (`character_0` 하나)를 쓰는 회차에 여섯 자리를 요구하면 없는 자리를 만들라는
 * 말이 됩니다 — 그런 회차가 훨씬 많습니다.
 *
 * @param aliases 이 회차가 들고 있는 **그림** 별칭 전부
 */
export function missingParts(aliases: Iterable<string>): string[] {
  const have = new Set<string>();
  const who = new Set<string>();
  for (const alias of aliases) {
    const m = PART_ALIAS.exec(alias);
    if (!m) continue;
    who.add(m[1]);
    have.add(`${m[1]}|${m[2]}|${m[3]}`);
  }
  const out: string[] = [];
  for (const n of [...who].sort((a, b) => Number(a) - Number(b))) {
    for (const part of PARTS) {
      for (const state of STATES) {
        if (!have.has(`${n}|${part}|${state}`)) out.push(`character_${n}_${part}_${state}`);
      }
    }
  }
  return out;
}

/**
 * **몸·팔 파일을 통그림 이름으로 가리키는 자리** (2026-09-29, M3).
 *
 * MAL2M07W2S1 에서 도구가 `character_0_idle ← character_0_body_idle.png` 로 이름을 둔 채 파일만
 * 갈았습니다. 그림은 나오지만 몸·팔 여섯 자리 셈(`missingParts`)이 그 캐릭터를 못 보고, 완성본과
 * 18줄이 다릅니다. **모든 호 완성본 AssetTable 1,586개에서 몸·팔 파일 468줄 가운데 이런 줄은 0** 이라
 * 막는 검사로 둡니다(`_document/양산판.md` M3 (나)).
 */
export function partNameIssues(images: { alias: string; file: string }[]): Issue[] {
  const part = /_(body|arm)_/;
  const stem = (f: string): string => f.replace(/\.[a-z0-9]+$/i, "");
  return images
    .filter((a) => part.test(stem(a.file)) && !part.test(a.alias))
    .map((a) => ({
      level: "error" as const,
      rule: "part-file-whole-alias",
      path: `assets.image.${a.alias}`,
      message: `${a.alias} — 몸·팔로 나눈 그림(${a.file})을 통그림 이름으로 가리킵니다.`,
      why: `별칭을 파일 이름대로 ${stem(a.file)} 로 두세요. 완성본은 모두 그렇게 씁니다.`,
    }));
}

/** 그 별칭이 어느 캐릭터의 것인가. 짚을 때 자리 이름으로 씁니다. */
export function whoOf(alias: string): string {
  return PART_ALIAS.exec(alias)?.[1] ?? "";
}
