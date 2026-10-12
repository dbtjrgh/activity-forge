// 스펙 검사 — ✓ · ✗ 한 줄과 어긋난 수.
//
// `checkSpec.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음).

import { chalk } from "@/gen/color";

let fail = 0;
export function ok(cond: boolean, msg: string): void {
  if (cond) console.log(chalk.green("  ✓ ") + msg);
  else {
    console.log(chalk.red("  ✗ ") + msg);
    fail += 1;
  }
}

/** 지금까지 ✗ 가 몇 번이었나 — 넷을 다 돈 뒤 `checkSpec.ts` 가 읽는다 */
export function failed(): number {
  return fail;
}
