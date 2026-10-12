// 레시피의 gameData 를 스펙에 맞춰 걸러 내고(검증), 렌더링용 트리로 바꿉니다.
//
// 한 번에 세 가지를 합니다.
//   1. 스펙에 적힌 타입·필수·기본값을 맞춥니다
//   2. figma 좌표를 캔버스 좌표로 바꿉니다
//   3. 어긴 것을 issues 로 모읍니다 (에러가 하나라도 있으면 파일을 쓰지 않습니다)
//
// **본문은 조각으로 나눴습니다** (2026-09-30, 960줄이라 — 동작 변화 없음). 여기는 입구와 트리 타입만.
//
//   resolvealias      쓸 수 있는 별칭 · fixedAlias · 번호로 짝인 무리
//   resolvefield      객체 한 겹 · 점 이름 묶기 · 필드 하나
//   resolvevalue      값 하나 (타입 맞추기 · figma 좌표)
//   resolvevariant    배리언트 검사
//   resolverules      이름 붙은 규칙 · 돌리기   ← resolveslotrules  자리 · 표 · 부품 쪽 규칙
//   resolvefigma      figma 좌표 풀기
//   resolveissue      err · warn · 겹친 이슈 거르기 · 값 꼴 보기

import type { AssetKind, Issue, Recipe, Spec, SpecField } from "./types";
import { runRelations } from "./relation";
import { checkAliasFollows, checkFixedAliases, collectAliases } from "./resolvealias";
import { resolveObject } from "./resolvefield";
import { resolveValue } from "./resolvevalue";
import { runRules } from "./resolverules";
import { dedupe } from "./resolveissue";

// 렌더러가 읽는 트리. 스펙 순서를 그대로 들고 있습니다.
export type Node =
  | { kind: "raw"; js: string; desc?: string }
  | { kind: "object"; entries: Entry[]; desc?: string }
  | { kind: "array"; items: Node[]; desc?: string };

export type Entry = { key: string; node: Node; desc?: string; warn?: string };

export type Ctx = {
  spec: Spec;
  recipe: Recipe;
  issues: Issue[];
  // 이 액티비티가 쓸 수 있는 모든 alias.
  //
  // **한 이름이 여러 갈래일 수 있습니다.** AssetManager(그림)와 AudioManager
  // (소리)가 서로 다른 목록이라, `hands` 를 이미지로도 소리로도 등록해 둔
  // 회차가 많습니다 (ENL1M01W1S3 의 낱말들이 그렇습니다). 갈래를 하나만
  // 담아 두면 나중에 등록한 쪽이 앞을 덮어 「image 자리인데 sound 로
  // 등록돼 있다」는 헛말이 납니다 (2026-09-03).
  aliases: Map<string, Set<AssetKind>>;
  root: Record<string, unknown>;
};

export function resolveGameData(
  spec: Spec,
  recipe: Recipe,
): { node: Node; issues: Issue[] } {
  const ctx: Ctx = {
    spec,
    recipe,
    issues: [],
    aliases: collectAliases(spec, recipe),
    // 뿌리가 배열이면 `root` 로 걸어 들어갈 것이 없습니다 — 규칙들이
    // `ctx.root.어떤키` 로 보는 자리라 빈 객체를 둡니다. 값은 아래에서
    // `recipe.gameData` 를 그대로 씁니다.
    root: (Array.isArray(recipe.gameData) ? {} : (recipe.gameData ?? {})) as Record<string, unknown>,
  };

  checkFixedAliases(ctx);
  checkAliasFollows(ctx);

  // 넣을 값이 없는 모듈(애니메이션 같은)은 GameData 를 걷지 않습니다.
  if (spec.gameData.kind === "unused") {
    return { node: { kind: "array", items: [] }, issues: ctx.issues };
  }

  // **뿌리가 통째로 배열인 모듈.** 감싸는 객체가 없어서 걸어 들어갈 이름도
  // 없습니다. 배열 칸을 하나 지어 그 값 풀이를 그대로 씁니다 — 자리 경로도
  // `quizData[0].wheel` 처럼 실제 파일과 같은 꼴로 나옵니다.
  if (spec.gameData.kind === "array") {
    const rootField: SpecField = {
      key: "",
      type: "array",
      ...(spec.gameData.of ? { of: spec.gameData.of } : {}),
      ...(spec.gameData.minLength !== undefined ? { minLength: spec.gameData.minLength } : {}),
      ...(spec.gameData.minLengthWhy ? { minLengthWhy: spec.gameData.minLengthWhy } : {}),
    };
    const arr = resolveValue(rootField, recipe.gameData ?? [], spec.gameData.root, ctx);
    runRules(spec, ctx);
    ctx.issues.push(...runRelations(spec.relations, recipe.gameData ?? [], spec.gameData.root, ctx.aliases));
    return { node: arr, issues: dedupe(ctx.issues) };
  }

  const node = resolveObject(spec.gameData.fields, ctx.root, spec.gameData.root, ctx);
  runRules(spec, ctx);
  // **레시피가 적은 값을 그대로 봅니다** — 렌더 트리가 아니라.
  // 트리는 값이 이미 JS 글자로 굳어 있어 수로 견줄 수가 없습니다.
  // 지금 두 갈래(차례·목록)는 수와 개수만 보므로 figma 변환·default 가 끼어들
  // 자리가 없습니다. **좌표를 보는 관계를 새로 만들 때는 이 자리부터 다시
  // 봐야 합니다** — 그때는 변환 전 값을 보게 됩니다.
  ctx.issues.push(...runRelations(spec.relations, ctx.root, spec.gameData.root, ctx.aliases));

  return { node, issues: dedupe(ctx.issues) };
}
