// 명령줄 출력 — 이슈 · 결과.
//
// `index.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `index.ts` 에서 가져다 씁니다.

import { chalk } from "./color";
import type { GenResult, Issue } from "./types";
import type { GenOptions } from "./index";

// ─── 출력 ────────────────────────────────────────────────────────────────

export function printIssues(issues: Issue[]): void {
  if (issues.length === 0) {
    console.log(chalk.green("검증 통과 — 걸린 것이 없습니다."));
    return;
  }
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");

  for (const i of errors) {
    console.log(`${chalk.red("에러")} ${chalk.gray(i.path)}`);
    console.log(`     ${i.message}  ${chalk.gray(`[${i.rule}]`)}`);
    if (i.why) console.log(`     ${chalk.gray(i.why)}`);
  }
  for (const i of warns) {
    console.log(`${chalk.yellow("주의")} ${chalk.gray(i.path)}`);
    console.log(`     ${i.message}  ${chalk.gray(`[${i.rule}]`)}`);
    if (i.why) console.log(`     ${chalk.gray(i.why)}`);
  }
  console.log();
  console.log(
    `${errors.length ? chalk.red(`에러 ${errors.length}`) : chalk.green("에러 0")}` +
      `  ${warns.length ? chalk.yellow(`주의 ${warns.length}`) : "주의 0"}`,
  );
}

export function printResult(result: GenResult, opts: GenOptions): void {
  printIssues(result.issues);
  console.log();

  if (!result.ok) {
    console.log(chalk.red("에러가 있어 파일을 쓰지 않았습니다."));
    return;
  }
  if (opts.dry) {
    for (const [name, text] of Object.entries(result.preview ?? {})) {
      console.log(chalk.cyan(`\n───── ${name} ─────`));
      console.log(text);
    }
    console.log(chalk.gray("\n--dry 라 아무것도 쓰지 않았습니다."));
    return;
  }
  for (const d of result.dirs) console.log(`${chalk.gray("폴더")} ${d}`);
  for (const f of result.files) console.log(`${chalk.green("생성")} ${f.path}  ${chalk.gray(`${f.bytes}B`)}`);
  console.log();
  console.log(chalk.green(`액티비티 ${result.files.length}개 파일을 만들었습니다.`));
  console.log(chalk.gray("리소스 파일은 public/sparklab/<코드>/ 아래에 직접 넣어 주세요."));
}
