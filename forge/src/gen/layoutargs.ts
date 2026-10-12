// 명령이 인자를 풀 때 — 만든 회차인가 · `clone` · `swap` 의 [원본, 새코드].
//
// 2026-09-30 에 `layout.ts` 에서 옮김 — 1007줄이라. **동작 변화 없음.** 까닭 · 전체 그림은 `layout.ts` 머리말이 정본이고, 바깥은 여태처럼 `layout.ts` 에서 가져다 쓴다.

import fs from "fs";
import path from "path";
import { modulesOf } from "./survey";
import { parseStudyCode } from "./spec";
import { workPath } from "./paths";
import { chalk } from "./color";
import { originFor, type OriginPick } from "./layoutorigin";

// ─── 명령이 인자를 풀 때 ─────────────────────────────────────────────────

// 액티비티 폴더가 있고 **모듈까지 들어 있나.** 껍데기만 만들어 둔 회차가
// 있어서 폴더가 있다는 것만으로는 못 가릅니다 — 영어 8호 36차시가 딱 그 꼴입니다.
// 만든 것이면 **언제 만들었는지**(Activity.ts 를 마지막으로 쓴 때), 아니면 null.
// 참·거짓만 돌려주던 것을 넓혔습니다 — 진행판이 「오늘 몇 개」를 세려면 때가
// 필요한데, 그 때를 아는 자리가 여기뿐입니다.
export function builtAt(code: string): number | null {
  const s = parseStudyCode(code);
  if (!s) return null;
  const dir = workPath("sparkon_m" + String(s.month).padStart(2, "0"), "src", "activity", s.code);
  const file = path.join(dir, "Activity.ts");
  if (!fs.existsSync(file)) return null;
  if (modulesOf(dir).length === 0) return null;
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0; // 만든 것은 맞는데 때를 못 읽은 것. 0 은 「오늘이 아님」으로 셉니다.
  }
}

function isBuilt(code: string): boolean {
  return builtAt(code) !== null;
}

// `clone`·`swap` 이 받은 인자를 `[원본, 새코드]` 로 풉니다.
//
//   둘 다 적음              그대로 씁니다
//   하나인데 다 만든 회차   원본으로 봅니다 — 값만 떠 보던 옛 쓰임입니다
//   하나인데 빈 칸          **만들 코드로 보고 배치표에서 원본을 찾습니다**
//
// 못 고르면 까닭을 뿌리고 null. 부르는 쪽은 그대로 실패하면 됩니다.
export function resolvePair(a: string, b?: string): [string, string | undefined] | null {
  if (b) return [a, b];
  if (isBuilt(a)) return [a, undefined];

  let pick: OriginPick;
  try {
    pick = originFor(a);
  } catch (e) {
    console.log(chalk.red((e as Error).message));
    return null;
  }
  console.log();
  console.log(
    chalk.bold("모듈 배치표") +
      chalk.gray(` — ${pick.slot} 칸은 `) +
      chalk.green(pick.module) +
      chalk.gray(` (${pick.verdict} — ${pick.why})`),
  );
  console.log(
    `  원본으로 ${chalk.bold(pick.origin)} 을 씁니다 ` +
      chalk.gray("— 같은 모듈을 쓴 제일 가까운 호"),
  );
  return [pick.origin, pick.target];
}
