// 스펙 self-check.   yarn check:spec
//
// **왜 이것이 있어야 하나.** 스펙 115장은 기계가 뽑았습니다. 뽑는 규칙을 한 줄
// 고치면 115장이 다 바뀝니다 — 그때 「전부 아직 쓸 만한가」를 손으로 볼 수는
// 없습니다. 실제로 초안을 처음 뽑았을 때 98장만 멀쩡했고, 걸린 것을 따라가
// 규칙 여섯 군데를 고쳐 113장까지 올렸습니다. **그 숫자를 다시 낼 수 있어야**
// 다음에 규칙을 건드릴 수 있습니다.
//
// 서버에 단위테스트 틀이 없어 `checkPermission`·`checkModuleGen` 과 같은
// self-check 꼴로 둡니다.
//
// 다섯 가지를 봅니다.
//
//   ① 형식   스펙 한 장이 스펙의 꼴을 갖췄나            (`validateSpec`)
//   ② 왕복   **이미 돌아가는 액티비티**의 값을 통과시키나
//   ③ 파서   import 줄에서 모듈을 제대로 읽어 내나
//   ④ import 훅이 부르는 것을 스펙이 다 들여왔나
//   ⑤ 담기   완성본 GameData 에 값이 있는데 스펙이 비었나 (2026-10-02, K36 이 「항목 0개」로 다 통과했다)
//
// ②가 이 검사의 심장입니다. 형식만 보면 「빈 스펙」도 통과합니다. 실물을
// 넣어 봐야 「필수라고 적었는데 원본조차 그 값을 안 채웠다」 같은 것이 잡힙니다.
//
// **조각으로 나눴습니다** (2026-09-30, 450줄이라 — 동작 변화 없음). 여기는 차례만.
//
//   checkSpecCount    ✓ · ✗ 한 줄과 어긋난 수
//   checkSpecShape    ① 형식 · ③ 파서
//   checkSpecRound    ② 왕복
//   checkSpecImports  ④ import
//   checkSpecFill     ⑤ 담기

import { chalk } from "@/gen/color";
import { failed } from "./checkSpecCount";
import { checkShape, checkParser } from "./checkSpecShape";
import { checkRoundTrip } from "./checkSpecRound";
import { checkImports } from "./checkSpecImports";
import { checkFill } from "./checkSpecFill";

// ─────────────────────────────────────────────────────────────────────────

checkShape();
checkRoundTrip();
checkParser();
checkImports();
checkFill();

console.log();
const fail = failed();
if (fail > 0) {
  console.log(chalk.red(`${fail}건 어긋났습니다.`));
  process.exitCode = 1;
} else {
  console.log(chalk.green("어긋난 것 없습니다."));
}
