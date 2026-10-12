// **낱말 자리를 새 파일로 다시 세웁니다.** `reslot.ts` 가 가린 「낱말」 갈래를 받아
// 레시피를 고칩니다.
//
// `swap` 은 **파일을 갈아끼웁니다** — 자리(별칭)는 그대로 두고 그 자리가 가리키는
// 파일만 바꿉니다. 그런데 회차마다 낱말이 통째로 바뀌는 모듈에서는 **자리 자체가
// 갈립니다.** 6호는 `skirt`·`tshirt`·`pants` 이고 8호는 `crayon`·`fork`·`scissors`
// 입니다. `skirt` 자리에 넣을 파일을 찾는 것은 **답이 없는 물음**이고, 실제로 AI 가
// 「맞출 짝이 하나도 없습니다」라고 답했습니다 (2026-09-15).
//
// **새 별칭은 파일 이름입니다.** 8호 완성본이 그렇게 되어 있습니다 —
// `crayon.png` → `crayon`, `SL_en_word_fork.mp3` → `SL_en_word_fork`. 사람이 그렇게
// 지어 왔으니 도구도 그렇게 짓습니다.
//
// **두 곳을 같이 고칩니다.** `assets` 의 별칭만 바꾸면 `gameData` 가 없어진 이름을
// 가리켜 `alias-exists-in-assettable` 로 막힙니다. 레시피 한 장 안에서 둘이 맞아야
// 합니다.
//
// **바꾼 자리를 다 돌려줍니다.** 이름을 바꾸는 것은 되돌리기 어려운 일이라,
// 쓰기 전에 무엇이 어떻게 바뀌는지 사람이 볼 수 있어야 합니다 (저장소 규칙 7번).

import { aliasKeyPaths } from "./relpath";
import type { AssetKind, Recipe, RecipeAsset, SpecRelation } from "./types";

/** 한 자리를 무엇으로 바꾸나. */
export type Recast = {
  /** 원본이 쓰던 별칭. 이 회차에는 없어질 이름입니다 */
  from: string;
  /** 새 별칭. 확장자 없는 파일 이름입니다 */
  to: string;
  /** 새 파일 이름 (확장자까지) */
  file: string;
  kind: AssetKind;
};

export type RecastResult = {
  recipe: Recipe;
  /** `assets` 에서 바꾼 자리 수 */
  assets: number;
  /** `gameData` 에서 바꾼 자리와 그 경로 */
  data: string[];
  /** 레시피에 없어서 못 바꾼 것 — 숨기지 않습니다 */
  missed: { from: string; why: string }[];
  /**
   * `gameData` 에서 **갈래를 못 가려 그대로 둔 자리.** 같은 이름이 그림에도
   * 소리에도 있을 때다 — 짐작해서 바꾸면 조용히 틀린 액티비티가 나온다.
   */
  unsure: { at: string; name: string; to: string[] }[];
};
/**
 * 레시피의 낱말 자리를 새 파일로 바꿉니다. **원본은 건드리지 않고 새 레시피를
 * 돌려줍니다** — 부르는 쪽이 견줘 보고 쓸지 정합니다.
 */
export type RecastHow = {
  /**
   * 그 자리가 어느 갈래의 별칭인가. **스펙을 아는 쪽이 알려 줍니다** —
   * `quizData[0].answercard.sound` 가 `asset:sound` 인지는 스펙 나무를 걸어야
   * 알 수 있고, 그 셈은 앱의 `field.ts` 하나에 모여 있습니다. forge 가 그것을
   * 다시 짜면 두 벌이 됩니다. 안 주면 갈래가 갈리는 자리를 그대로 둡니다.
   */
  kindAt?: (path: string) => AssetKind | null;
  /**
   * gameData 의 뿌리 이름(`quizData` 따위). **스펙이 정하는 값입니다** —
   * 여기에 박아 두면 뿌리가 다른 모듈에서 `kindAt` 이 자리를 못 찾아
   * 멀쩡한 자리가 죄다 「모름」으로 떨어집니다.
   */
  root?: string;
  /**
   * 스펙의 관계. **열쇠가 alias 인 표**(`isAlias` · `of: "keys"`)를 여기서 읽어
   * 그 표의 열쇠도 바꿉니다. 2026-09-23 MAL2M07W2S1 — `character_0_idle` 을
   * `character_0_body_idle` 로 세웠는데 `M05_Table.image` 가 **열쇠로** 옛 이름을
   * 부르고 있어 값만 바꾸는 걸음으로는 안 닿았습니다(완성본은 열쇠를 바꿨다).
   * 어느 표가 그런지는 스펙이 압니다 — 열쇠를 아무 데서나 바꾸면 `correct` 처럼
   * 뜻이 다른 열쇠까지 건드립니다.
   */
  relations?: SpecRelation[];
};

export function recast(recipe: Recipe, casts: Recast[], how: RecastHow = {}): RecastResult {
  const { kindAt, root = "quizData" } = how;
  const out: RecastResult = {
    recipe: JSON.parse(JSON.stringify(recipe)) as Recipe,
    assets: 0,
    data: [],
    missed: [],
    unsure: [],
  };
  if (casts.length === 0) return out;

  // **한 이름이 갈래마다 따로 있습니다.** `skirt` 가 그림에도 소리에도 있습니다 —
  // 그림은 `fork` 로, 소리는 `SL_en_word_fork` 로 갑니다. 그래서 자리를 셀 때
  // 갈래까지 같이 봅니다. 처음에 별칭만 키로 썼다가 열두 자리가 여섯으로
  // 뭉개졌습니다 (2026-09-15).
  const key = (alias: string, kind: AssetKind): string => `${kind}:${alias}`;
  const seen = new Set<string>();
  const use: Recast[] = [];
  for (const c of casts) {
    if (seen.has(key(c.to, c.kind))) {
      out.missed.push({ from: c.from, why: `${c.kind} 자리의 ${c.to} 을 이미 다른 자리가 가져갔습니다.` });
      continue;
    }
    seen.add(key(c.to, c.kind));
    use.push(c);
  }

  const by = new Map(use.map((c) => [key(c.from, c.kind), c]));

  // ─ ① assets ─
  for (const kind of Object.keys(out.recipe.assets ?? {}) as AssetKind[]) {
    const list = out.recipe.assets?.[kind];
    if (!Array.isArray(list)) continue;
    for (const item of list as RecipeAsset[]) {
      const c = by.get(key(item.alias, kind));
      if (!c) continue;
      item.alias = c.to;
      item.file = c.file;
      out.assets += 1;
    }
  }

  // 레시피에 아예 없던 자리는 알려 줍니다. 조용히 넘어가면 「바꿨다는데
  // 그대로다」가 됩니다.
  const had = new Set<string>();
  for (const kind of Object.keys(recipe.assets ?? {}) as AssetKind[]) {
    for (const item of (recipe.assets?.[kind] ?? []) as RecipeAsset[]) had.add(key(item.alias, kind));
  }
  for (const c of use) {
    if (!had.has(key(c.from, c.kind))) {
      out.missed.push({ from: c.from, why: `레시피의 assets(${c.kind}) 에 없는 별칭입니다.` });
    }
  }

  // ─ ② gameData ─
  //
  // **글자가 그대로 같은 값만** 바꿉니다. 별칭은 값 안에 통째로 들어 있지
  // 조각으로 섞여 있지 않습니다 — 조각까지 바꾸면 `SL_en_word_skirt` 안의
  // `skirt` 같은 것을 건드려 엉뚱한 글자가 됩니다.
  //
  // **별칭이 아닌 자리도 같이 바뀝니다.** `word: "skirt"` 처럼 화면에 보일
  // 낱말이 별칭과 같은 글자인 자리가 있습니다. 8호 완성본도 `word: "fork"` 라
  // **그것이 맞는 결과**입니다. 다만 무엇을 바꿨는지 경로를 다 돌려주므로
  // 사람이 훑어볼 수 있습니다.
  // **갈래가 갈리면 바꾸지 않습니다.** `gameData` 에는 글자만 있어서 그 자리가
  // 그림인지 소리인지 알 수 없습니다 — `skirt` 가 둘 다면 `fork` 인지
  // `SL_en_word_fork` 인지 고를 근거가 없습니다. 짐작해서 바꾸면 **조용히 틀린**
  // 액티비티가 나오므로, 그대로 두고 `unsure` 로 내놓아 사람이 정하게 합니다.
  // (스펙의 `asset:image`·`asset:sound` 를 따라가면 정확히 가릴 수 있습니다 —
  //  그것은 다음에 합니다.)
  const byName = new Map<string, Recast[]>();
  for (const c of use) byName.set(c.from, [...(byName.get(c.from) ?? []), c]);

  const walk = (v: unknown, at: string): unknown => {
    if (typeof v === "string") {
      const cands = byName.get(v);
      if (!cands) return v;
      if (cands.length > 1) {
        // 스펙이 갈래를 말해 주면 그것으로 고릅니다.
        const kind = kindAt?.(at) ?? null;
        const one = kind ? cands.find((c) => c.kind === kind) : undefined;
        if (!one) {
          out.unsure.push({ at, name: v, to: cands.map((c) => `${c.kind}→${c.to}`) });
          return v;
        }
        out.data.push(at);
        return one.to;
      }
      out.data.push(at);
      return (cands[0] as Recast).to;
    }
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${at}[${i}]`));
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      const keyKind = keyPaths.get(at)?.kind;
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        const c = keyKind ? use.find((u) => u.from === k && u.kind === keyKind) : undefined;
        if (c) out.data.push(`${at}{${k}}`);
        // 값은 옛 열쇠의 길로 걸어도 된다 — 그 안에는 alias 가 없다(자리·크기 따위)
        o[c ? c.to : k] = walk(x, at ? `${at}.${k}` : k);
      }
      return o;
    }
    return v;
  };

  const keyPaths = aliasKeyPaths(how.relations ?? [], out.recipe.gameData, root);
  if (out.recipe.gameData !== undefined) {
    out.recipe.gameData = walk(out.recipe.gameData, root) as Recipe["gameData"];
  }

  return out;
}

//
// **바꿀 것 짜기는 떼어 냈습니다** (2026-09-30, 224줄이라 — 동작 변화 없음). 바깥은 여태처럼 이 파일에서 가져다 씁니다.
//
//   restockcasts   바꿀 것 짜기 — 파일 이름 → 별칭 · 「낱말」 자리와 차례로 짝

export { aliasOf, castsFrom } from "./restockcasts";
