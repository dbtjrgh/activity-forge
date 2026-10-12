// 재현 검사.   yarn check:repro
//
// **왜 이것이 있어야 하나.** `check:spec` 은 「에러 없이 뽑히나」까지만 봅니다.
// **뽑힌 글자가 맞는 글자인지는 아무도 안 봤습니다.** 스펙 115장·생성기
// 4,500줄로 만든 액티비티를 브라우저에서 돌려 본 적이 없습니다.
//
// 브라우저로 보려면 진짜 리소스가 있어야 하는데, **없이 하는 방법이 있습니다.**
// **이미 잘 도는 액티비티**를 그 액티비티 자신의 값으로 다시 뽑아, 사람이 손으로
// 쓴 원본과 견주는 것입니다. 같으면 「생성기가 사람과 같은 것을 쓴다」가
// 증명됩니다. 리소스도 브라우저도 필요 없고 114개 전부에 돌릴 수 있습니다.
//
//   원본 소스 ──읽기──▶ 값 ──레시피──▶ 생성기 ──▶ 글자 ──견주기──▶ 원본 소스
//
// **파일마다 견주는 법이 다릅니다.** 글자로 견줄 수 있는 것과 없는 것이
// 갈립니다.
//
//   GameData.ts     값으로   원본의 60% 에 주석이 있어 글자로는 못 견줍니다
//   Activity.ts     글자로   스펙이 hooks 를 제대로 담았는지가 여기서 드러납니다
//   AssetTable.ts   별칭으로 파일 이름은 이 검사가 지어낸 것이라 볼 것이 없습니다
//   index.html 외 3 글자로   호 repo 의 `_default` 와 어긋났는지
//   activityInfo    안 봅니다 사람 이름과 날짜가 들어갑니다
//
// **이것이 통과해도 「돌아간다」는 아닙니다.** 원본과 같다는 것까지입니다.
// 다만 원본은 돌아가는 것이 확인된 것들이라, 여기까지 오면 남은 위험이
// 리소스와 새 스펙 쪽으로 좁혀집니다.
//
// **본문은 조각으로 나눴습니다** (2026-09-30, 655줄이라 — 동작 변화 없음). 여기는 모으는 흐름(`main`)만.
//
//   reprovalue     값 견주기 · 레시피에 얹을 별칭
//   reprotext      글 견주기(주석 · 따옴표 · import 줄 고르기)
//   reproone       한 액티비티를 자기 값으로 다시 뽑아 견준다
//   reproactivity  Activity.ts 견주기 · 훅 줄 · 별칭
//   reproreport    다 돌린 뒤 결과 뿌리기

import { chalk } from "@/gen/color";
import { generateRecipe } from "@/gen";
import { listModules, findUsers } from "@/gen/survey";
import type { Recipe } from "@/gen/types";
import { assetsOf } from "./reprovalue";
import { checkOne } from "./reproone";
import { printReport } from "./reproreport";

// ─── 전체 ────────────────────────────────────────────────────────────────

function main(): void {
  const only = process.argv.slice(2).find((a) => !a.startsWith("-"));

  console.log(
    chalk.bold("재현 검사 — 이미 도는 액티비티를 다시 뽑아 원본과 견줍니다\n"),
  );

  // 파일 이름 → [통과, 틀림, 알림]
  const tally = new Map<string, [number, number, number]>();
  const bad: string[] = [];
  const notes: string[] = [];
  const filledIn: string[] = [];
  let filled = 0;
  let ran = 0;
  let skipped = 0;

  for (const row of listModules().filter((m) => m.hasSpec)) {
    if (only && `${row.subject}/${row.module}` !== only) continue;
    const users = findUsers(row.subject, row.module).filter((s) => !s.note);
    if (!users.length) {
      skipped += 1;
      continue;
    }
    // **기본은 모듈마다 표본 하나입니다.** 스펙이 통째로 어긋난 것은 한 편만
    // 돌려도 잡히고, 그래야 11초에 끝납니다.
    //
    // `--every` 는 그 모듈을 쓰는 회차를 **다** 돌립니다. 「첫 회차는 되는데
    // 스무 번째 회차에서 칸이 하나 빈다」를 잡는 자리입니다 — 첫 표본만 보면
    // 스펙이 그 회차 하나에만 맞춰져 있어도 초록으로 지나갑니다 (2026-09-08).
    const picks = process.argv.includes("--every") ? users : users.slice(0, 1);
    for (const sample of picks) {
      const recipe: Recipe = {
        recipeVersion: 1,
        code: sample.code,
        module: row.module,
        subject: row.subject,
        info: { developer: "check:repro", devTeam: "my-team" },
        assets: assetsOf(sample.dir),
        gameData: sample.data as Record<string, unknown>,
      };

      let gen: Record<string, string> | undefined;
      try {
        // 리소스가 정말 있는지는 **안 봅니다.** 위 assetsOf 가 파일 이름을
        // 지어내니까요 — 여기서 보는 것은 별칭과 렌더 결과입니다.
        const r = generateRecipe(recipe, { dry: true, checkAssets: false });
        gen = r.preview;
      } catch (e) {
        bad.push(
          `${row.subject}/${row.module} (${sample.code}) — 생성기가 터졌습니다: ${(e as Error).message}`,
        );
        ran += 1;
        continue;
      }
      if (!gen) {
        // 에러가 있어 렌더까지 못 간 것입니다. `check:spec` 이 볼 몫입니다.
        skipped += 1;
        continue;
      }

      ran += 1;
      for (const v of checkOne(sample.dir, gen, sample.data)) {
        const t = tally.get(v.file) ?? [0, 0, 0];
        const where = `${row.subject}/${row.module} (${sample.code}) ${v.file}`;
        if (v.level === "ok") t[0] += 1;
        else if (v.level === "fail") {
          t[1] += 1;
          bad.push(`${where} — ${v.why}`);
        } else {
          t[2] += 1;
          notes.push(`${where} — ${v.why}`);
        }
        tally.set(v.file, t);
        if (v.added) {
          filled += v.added;
          filledIn.push(`${where} — ${v.added}자리`);
        }
      }
    }
  }

  printReport({ only, tally, bad, notes, filledIn, filled, ran, skipped });
}

main();
