// 모듈 하나를 내놓기 (`forge draft MA/M29`).
//
// `draft.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `draft.ts` 에서 가져다 씁니다.

import fs from "fs";
import path from "path";
import { chalk } from "./color";
import type { Spec } from "./types";
import { specPath } from "./spec";
import { type Sample } from "./survey";
import { draftSpec } from "./draftspec";
import { countFields, mergeHuman } from "./draftmerge";

// 스펙 파일을 어느 폴더에 둘지.
//
// 모듈은 import 경로로 과목이 정해지지만(`@_common/module/MA/M10`), 생성기는
// **학습코드**의 과목으로 스펙을 찾습니다. MA/M10 을 KOL1… 액티비티가 쓰고
// 있어서 `spec/KO/M10.json` 을 찾다 없다고 멈췄습니다. 쓰는 과목이 여럿이면
// 두 과목이 함께 보는 `_common` 에 둡니다 (2026-09-01).
function specFolder(subject: string, samples: Sample[]): string {
  const used = new Set(samples.map((s) => s.code.slice(0, 2).toUpperCase()));
  if (used.size > 1) return "_common";
  const only = [...used][0];
  return only || subject;
}

export function targetFile(
  subject: string,
  module: string,
  samples: Sample[],
): string {
  const folder = specFolder(subject, samples);
  return folder === subject
    ? specPath(subject, module)
    : specPath(folder, module);
}


// ─── 내놓기 ──────────────────────────────────────────────────────────────

export function runDraft(
  subject: string,
  module: string,
  write: boolean,
  force: boolean,
): boolean {
  let spec: Spec;
  let samples: Sample[];
  let arrayRoot: boolean;
  try {
    ({ spec, samples, arrayRoot } = draftSpec(subject, module));
  } catch (e) {
    console.log();
    console.log(chalk.red((e as Error).message));
    console.log(
      chalk.gray("모듈 이름을 확인하세요: yarn forge survey"),
    );
    console.log();
    return false;
  }

  const draftText = JSON.stringify(spec, null, 2) + "\n";
  const spots = countFields(spec.gameData.fields);
  // **자리 0개는 의심한다** (2026-10-02) — K36 은 완성본이 빈 `activityData` 를 먼저 두어 0개로 떴고, 그대로 9호를 만들면 quizData 가 통째로 빠졌다
  if (spots === 0 && spec.gameData.kind !== "unused" && !arrayRoot) {
    console.log(
      chalk.yellow(
        `자리가 0개입니다. 완성본 GameData 에 값이 있다면 export 이름(${spec.codegen.gameDataExport})부터 확인하세요 — yarn check:spec ⑤ 가 잡습니다.`,
      ),
    );
  }

  if (arrayRoot) {
    console.log();
    console.log(
      chalk.red(`${subject}/${module} 은 GameData 뿌리가 배열입니다.`),
    );
    console.log(
      chalk.gray(
        "생성기는 아직 객체 뿌리만 다룹니다. 아래 자리 목록은 배열 한 칸의 속입니다 —",
      ),
    );
    console.log(
      chalk.gray(
        "읽을 거리로는 쓸모가 있지만 그대로는 못 씁니다. 그래서 파일로 남기지 않습니다.",
      ),
    );
    console.log();
    console.log(draftText);
    return false;
  }

  if (!write) {
    console.log(draftText);
    console.log(chalk.gray(`표본 ${samples.length}개 · 자리 ${spots}개`));
    console.log(chalk.gray(`파일로 남기려면 --write`));
    return true;
  }

  const file = targetFile(subject, module, samples);
  if (fs.existsSync(file) && !force) {
    console.log();
    console.log(chalk.red(`이미 있습니다: ${file}`));
    console.log(
      chalk.gray(
        "손으로 다듬어 둔 것을 덮어쓰지 않으려는 것입니다. 덮으려면 --force",
      ),
    );
    console.log();
    return false;
  }

  // 이미 있으면 **사람이 쓴 글을 걷어 새로 뽑은 것에 얹습니다.**
  // 제목을 채웠다고 생성 규칙 개선이 막히면 안 됩니다 — 아래 `mergeHuman`.
  const merged = mergeInto(spec, file);
  const text = JSON.stringify(merged.spec, null, 2) + "\n";

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");

  console.log();
  console.log(chalk.green(`초안을 썼습니다 — ${file}`));
  console.log(
    chalk.gray(
      `표본 ${samples.length}개: ${samples
        .slice(0, 5)
        .map((s) => s.code)
        .join(" ")}`,
    ),
  );
  if (merged.kept) {
    console.log(
      chalk.gray(
        `자리 ${spots}개 · 사람이 쓴 글 ${merged.kept}자리를 그대로 얹었습니다.`,
      ),
    );
  } else {
    console.log(
      chalk.gray(`자리 ${spots}개 · 제목과 자리별 설명은 비어 있습니다.`),
    );
  }
  for (const l of merged.lost) {
    console.log(chalk.yellow(`  얹을 자리가 없어졌습니다 — ${l}`));
  }
  console.log();
  return true;
}

// 파일에 있던 스펙에서 사람 글만 걷어 새로 뽑은 것에 얹습니다.
// 파일이 없거나 깨졌으면 새로 뽑은 것 그대로.
export function mergeInto(
  fresh: Spec,
  file: string,
): { spec: Spec; kept: number; lost: string[] } {
  if (!fs.existsSync(file)) return { spec: fresh, kept: 0, lost: [] };
  try {
    return mergeHuman(fresh, JSON.parse(fs.readFileSync(file, "utf8")) as Spec);
  } catch {
    return { spec: fresh, kept: 0, lost: [] };
  }
}
