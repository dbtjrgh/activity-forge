// 스펙 검사 ② 왕복 — 이미 도는 액티비티의 값을 통과시키나.
//
// `checkSpec.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음).

import { chalk } from "@/gen/color";
import { generateRecipe } from "@/gen";
import { listModules, findUsers, assetAliases } from "@/gen/survey";
import type { AssetKind, Recipe, RecipeAsset } from "@/gen/types";
import { ok } from "./checkSpecCount";

// ─── ② 왕복 ──────────────────────────────────────────────────────────────

const EXT: Record<AssetKind, string> = {
  image: ".png",
  sound: ".mp3",
  lottie: ".json",
  font: ".woff",
};

// 그 액티비티가 실제로 쓰는 별칭을 그대로 얹습니다. 파일 이름은 아무거나
// 됩니다 — 검사가 보는 것은 「스펙이 요구한 별칭이 있는가」이지 파일이 아닙니다.
function assetsOf(dir: string): Partial<Record<AssetKind, RecipeAsset[]>> {
  const out: Partial<Record<AssetKind, RecipeAsset[]>> = {};
  // 한 이름이 그림이면서 소리일 수 있습니다 — 갈래마다 한 줄씩 넣습니다.
  for (const [alias, kinds] of assetAliases(dir)) {
    for (const kind of kinds)
      (out[kind] ??= []).push({ alias, file: alias + EXT[kind] });
  }
  return out;
}

// **아는 결함.** 스펙 잘못이 아니라 **액티비티 쪽 잘못**입니다 — GameData 가
// 가리키는 별칭이 그 액티비티의 AssetTable 에 없습니다. 리소스를 못 찾아도
// Pixi 가 빈 텍스처로 넘어가서 에러 없이 안 보일 뿐이라 지금까지 남아 있었습니다.
// 남의 repo 라 고치지 않았습니다.
//
// **늘 빨간 불이 켜지는 검사는 아무도 안 봅니다.** 그래서 여기 적어 두고 셈에서
// 뺍니다. 대신 **고쳐졌는데 줄이 남아 있으면 그것도 알려 줍니다** — 지운 자리를
// 비워 두지 않는 것과 같은 뜻입니다.
// 여기 적는 것은 **이 검사가 실제로 걸어 내는 것**뿐입니다.
// `ENL3M01W2S3` 의 `quiz04_answer01` 도 같은 결함이지만 여기 없습니다 — 그
// 자리는 스펙이 `string` 으로 잡고 있어 별칭을 아예 안 봅니다(모르는 값이
// 섞이면 리소스 자리로 안 보는 규칙 때문입니다). **없는 예외를 적어 두면
// 아래 「낡았습니다」가 잘못 뜹니다.** 그 결함은 계획서에 적어 뒀습니다.
const KNOWN: Array<{ code: string; path: string; why: string }> = [
  {
    code: "MAL1M01W4S3",
    path: "quizData.narration.MA.answer1",
    why: "AssetTable 에 주석으로만 있습니다",
  },
];

function isKnown(code: string, issuePath: string): boolean {
  return KNOWN.some((k) => k.code === code && issuePath.startsWith(k.path));
}

export function checkRoundTrip(): void {
  console.log(
    chalk.bold("\n② 왕복 — 이미 돌아가는 액티비티의 값을 통과시키나"),
  );
  let pass = 0;
  let none = 0;
  let excused = 0;
  const seenCodes = new Set<string>();
  const hitKnown = new Set<string>();
  const bad: string[] = [];

  for (const row of listModules().filter((m) => m.hasSpec)) {
    // `note` 가 붙은 표본은 GameData 를 못 읽은 것입니다. 검사 재료가 못 됩니다.
    const sample = findUsers(row.subject, row.module).filter((s) => !s.note)[0];
    if (!sample) {
      none += 1;
      continue;
    }
    const recipe: Recipe = {
      recipeVersion: 1,
      code: sample.code,
      module: row.module,
      subject: row.subject,
      info: { developer: "check:spec", devTeam: "my-team" },
      assets: assetsOf(sample.dir),
      gameData: sample.data as Record<string, unknown>,
    };

    seenCodes.add(sample.code);
    let errs: string[];
    try {
      // 리소스가 정말 있는지는 **안 봅니다.** 위 assetsOf 가 파일 이름을
      // 「별칭 + 확장자」로 지어내니까요 — 여기서 보는 것은 값의 왕복입니다.
      const r = generateRecipe(recipe, { dry: true, checkAssets: false });
      errs = r.issues
        .filter((i) => i.level === "error")
        .filter((i) => {
          if (!isKnown(sample.code, i.path)) return true;
          hitKnown.add(sample.code + " " + i.path);
          return false;
        })
        .map((i) => `${i.path} — ${i.message}`);
    } catch (e) {
      errs = [`생성기가 터졌습니다: ${(e as Error).message}`];
    }
    if (errs.length === 0) pass += 1;
    else
      bad.push(
        `${row.subject}/${row.module} (${sample.code}) — ${errs[0]}` +
          (errs.length > 1 ? ` (외 ${errs.length - 1}건)` : ""),
      );
  }
  excused = hitKnown.size;

  ok(
    bad.length === 0,
    `통과 ${pass} · 걸림 ${bad.length}` +
      (excused ? ` · 아는 결함 ${excused}` : "") +
      (none ? ` · 표본없음 ${none}` : ""),
  );
  for (const b of bad) console.log(chalk.gray("      " + b));

  for (const k of KNOWN) {
    if (hitKnown.has(k.code + " " + k.path)) {
      console.log(
        chalk.yellow(`      · ${k.code} ${k.path} — ${k.why} (액티비티 쪽)`),
      );
    } else if (seenCodes.has(k.code)) {
      // 표본으로 돌렸는데 안 걸렸으면 고쳐진 것입니다. 줄이 남아 있으면
      // 다음 사람이 「아직 깨져 있구나」로 읽습니다.
      ok(
        false,
        `아는 결함 줄이 낡았습니다 — ${k.code} ${k.path} 는 이제 통과합니다. KNOWN 에서 지우세요`,
      );
    }
    // 표본에 안 뽑힌 것은 아무 말도 하지 않습니다. 고쳐졌는지 알 수 없습니다.
  }
}
