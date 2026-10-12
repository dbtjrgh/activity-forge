// 액티비티 양산 — 로컬 명령 진입점.
//
// **왜 서버가 아니라 명령인가.** 이 도구는 사용자 PC 의 호 repo
// (`sparkon_mNN/src/activity/…`)에 파일을 씁니다. 개발서버에서 도는 DevOps
// 서버는 남의 디스크에 못 씁니다. **그래서 2026-09-10 에 `deploy` 에서 아예
// 갈라내 이 repo 로 왔습니다** — 배포와 양산은 도는 자리가 다릅니다.
//
// 로그인도 DB 도 쓰지 않고 파일만 봅니다. 바깥에서 끌어 쓰는 것은
// `typescript` 하나뿐이라, 나중에 그대로 exe 로 뽑을 수 있습니다.
//
// **명령 목록은 아래 `HELP` 한 곳입니다** (2026-09-30). 여기에도 적어 두었더니 `check` 가 빠진 채 낡았습니다.

import fs from "fs";
import path from "path";
import { chalk } from "@/gen/color";
import { generate, printResult } from "@/gen";
import { startUi } from "@/gen/server";
import { printSurvey, printModule } from "@/gen/survey";
import { runDraft, runDraftAll } from "@/gen/draft";
import { runClone } from "@/gen/clone";
import { runSwap } from "@/gen/swap";
import { printLayout, resolvePair } from "@/gen/layout";
import { repoPath } from "@/gen/paths";

const HELP = `
액티비티 양산

  yarn forge ui [포트]        양산 화면을 브라우저로 엽니다 (기본 5300)
                                         --no-open 을 붙이면 브라우저를 안 엽니다
  yarn forge make <레시피>    레시피로 액티비티 폴더를 만듭니다
                                         --dry 검사만 · --force 있는 폴더도 덮어씀
  yarn forge check <레시피>   검사만 하고 결과를 JSON 한 줄로 냅니다 (에러가 있으면 exit 1)
  yarn forge clone <새코드>   배치표에서 원본을 골라 값을 레시피로 떠 옵니다
                                         원본을 직접 고르려면 — clone <원본코드> <새코드>
                                         --write 를 붙여야 _recipe/ 에 남습니다
  yarn forge swap <새코드>    거기에 리소스까지 새 회차 폴더 것으로 갈아끼웁니다
                                         이름으로 못 맞춘 것은 무리로 묶어 보여 줍니다
  yarn forge layout EN 07     진행판 — 그 호의 차시마다 어디까지 왔나
                                         --order 만드는 차례 · --why 왜 그 모듈인가
  yarn forge survey           모듈별로 쓰는 액티비티가 몇 개인지 셉니다
  yarn forge survey MA/M27    그 모듈을 쓰는 액티비티를 견줍니다 (--all 로 전부)
  yarn forge draft MA/M29     표본을 견줘 스펙 초안을 만듭니다
                                         --write 를 붙여야 파일로 남습니다
  yarn forge draft --all      스펙이 없는 모듈을 전부 훑어 초안만 남깁니다

스펙은 _spec/, 레시피는 _recipe/ 에 있습니다.
`;

// `MA/M27` 을 갈라 줍니다. 꼴이 아니면 무엇이 잘못인지 말하고 null.
function splitTarget(arg: string | undefined, example: string): [string, string] | null {
  const [subject, module] = (arg ?? "").split("/");
  if (!subject || !module) {
    console.log(chalk.red(`과목/모듈 꼴로 적어 주세요. ex) ${example}`));
    return null;
  }
  return [subject.toUpperCase(), module];
}

function main(): void {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === "help" || cmd === "--help") {
    console.log(HELP);
    return;
  }

  if (cmd === "ui") {
    const port = Number(argv.find((a) => /^\d+$/.test(a)) ?? 5300);
    startUi(port, !argv.includes("--no-open"));
    return; // 서버가 계속 떠 있습니다.
  }

  if (cmd === "make") {
    const file = argv[1];
    if (!file) {
      console.log(chalk.red("레시피 파일이 필요합니다. ex) yarn forge make _recipe/MAL1M07W3S2.json"));
      process.exit(1);
    }
    // 레시피는 대개 `_recipe/` 에 있습니다. 그 안의 이름만 적어도 찾아 줍니다.
    const found = fs.existsSync(file)
      ? file
      : repoPath("_recipe", file);
    if (!fs.existsSync(found)) {
      console.log(chalk.red(`레시피를 못 찾았습니다: ${file}`));
      process.exit(1);
    }
    const opts = { dry: argv.includes("--dry"), force: argv.includes("--force") };
    const result = generate(found, opts);
    printResult(result, opts);
    if (!result.ok) process.exit(1);
    return;
  }

  // 검산만 — 사람 말 대신 JSON 한 줄. 에이전트가 이것만 보고 고칩니다(`_document/양산판.md` M1).
  // throw 도 잡아 같은 꼴로 냅니다 — 깨진 레시피가 스택 추적으로 오면 읽는 쪽이 못 고칩니다.
  if (cmd === "check") {
    const file = argv[1];
    let out: object;
    try {
      if (!file || !fs.existsSync(file)) throw new Error(`레시피를 못 찾았습니다: ${file ?? "(없음)"}`);
      const r = generate(path.resolve(file), { dry: true });
      const pick = (lv: string) => r.issues.filter((i) => i.level === lv).map((i) => ({ rule: i.rule, path: i.path, message: i.message }));
      out = { ok: r.ok, errors: pick("error"), warns: pick("warn") };
      // `--out <폴더>` — 만들려던 파일을 그 폴더에 둡니다(에러가 있어도). 측정 스크립트가 완성본과 견줄 때 씁니다.
      const at = argv.indexOf("--out");
      if (at > 0 && argv[at + 1]) {
        fs.mkdirSync(argv[at + 1], { recursive: true });
        for (const [name, text] of Object.entries(r.preview ?? r.draft ?? {})) {
          fs.writeFileSync(path.join(argv[at + 1], path.basename(name)), text, "utf8");
        }
      }
    } catch (e) {
      out = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    process.stdout.write(JSON.stringify(out) + "\n");
    if (!(out as { ok: boolean }).ok) process.exitCode = 1;
    return;
  }

  if (cmd === "clone") {
    const args = argv.slice(1).filter((a) => !a.startsWith("--"));
    if (!args[0]) {
      console.log(chalk.red("학습코드가 필요합니다. ex) yarn forge clone ENL1M07W2S1"));
      process.exit(1);
    }
    // 하나만 적으면 **만들 코드**로 봅니다 — 원본은 모듈 배치표가 고릅니다.
    const pair = resolvePair(args[0], args[1]);
    if (!pair) process.exit(1);
    else if (!runClone(pair[0], pair[1], argv.includes("--write"))) process.exit(1);
    return;
  }

  if (cmd === "swap") {
    const args = argv.slice(1).filter((a) => !a.startsWith("--"));
    if (!args[0]) {
      console.log(chalk.red("학습코드가 필요합니다. ex) yarn forge swap ENL1M07W2S1"));
      process.exit(1);
    }
    // 갈아끼우기는 **새 코드가 반드시 있어야** 합니다 — 리소스 폴더가 거기
    // 달려 있습니다. 하나만 적었는데 그것이 이미 다 만든 회차면 원본만 있는
    // 꼴이라, 무엇을 만들 것인지 되묻습니다.
    const pair = resolvePair(args[0], args[1]);
    if (!pair) process.exit(1);
    else if (!pair[1]) {
      console.log(chalk.red(`${args[0]} 은 이미 만들어진 회차입니다. 만들 학습코드를 적어 주세요.`));
      console.log(chalk.gray(`  ex) yarn forge swap ${args[0]} ENL1M07W2S1`));
      process.exit(1);
    } else if (!runSwap(pair[0], pair[1], argv.includes("--write"))) process.exit(1);
    return;
  }

  if (cmd === "layout") {
    const subject = (argv[1] ?? "").toUpperCase();
    const issue = (argv[2] ?? "").padStart(2, "0");
    if (!/^(MA|KO|EN)$/.test(subject) || !/^\d\d$/.test(issue)) {
      console.log(chalk.red("과목과 호가 필요합니다. ex) yarn forge layout EN 07"));
      process.exit(1);
    }
    const view = argv.includes("--why") ? "왜" : argv.includes("--order") ? "순서" : "진행판";
    if (!printLayout(subject, issue, view)) process.exit(1);
    return;
  }

  if (cmd === "survey") {
    const target = argv[1];
    if (!target || target.startsWith("--")) {
      printSurvey();
      return;
    }
    const parts = splitTarget(target, "yarn forge survey MA/M27");
    if (!parts) process.exit(1);
    else if (!printModule(parts[0], parts[1], argv.includes("--all"))) process.exit(1);
    return;
  }

  if (cmd === "draft") {
    if (argv.includes("--all")) {
      if (!runDraftAll(argv.includes("--force"))) process.exit(1);
      return;
    }
    const parts = splitTarget(argv[1], "yarn forge draft MA/M29");
    if (!parts) process.exit(1);
    else if (!runDraft(parts[0], parts[1], argv.includes("--write"), argv.includes("--force"))) {
      process.exit(1);
    }
    return;
  }

  console.log(chalk.red(`모르는 명령입니다: ${cmd}`));
  console.log(HELP);
  process.exit(1);
}

main();
