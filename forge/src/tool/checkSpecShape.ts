// 스펙 검사 ① 형식 · ③ 파서.
//
// `checkSpec.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음).

import fs from "fs";
import path from "path";
import { chalk } from "@/gen/color";
import { validateSpec } from "@/gen/specCheck";
import { repoPath } from "@/gen/paths";
import { modulesInSource } from "@/util/activityModules";
import { ok } from "./checkSpecCount";

// ─── ① 형식 ──────────────────────────────────────────────────────────────

export function checkShape(): void {
  console.log(chalk.bold("\n① 형식 — 스펙이 스펙의 꼴인가"));
  const root = repoPath("_spec");
  let n = 0;
  const bad: string[] = [];

  for (const dir of fs.readdirSync(root)) {
    const d = path.join(root, dir);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith(".json"))) {
      n += 1;
      let parsed: unknown;
      try {
        parsed = JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
      } catch (e) {
        bad.push(`${dir}/${f} — JSON 이 깨졌습니다: ${(e as Error).message}`);
        continue;
      }
      const r = validateSpec(parsed);
      if (!r.ok)
        bad.push(
          `${dir}/${f} — ${r.errors[0]}` +
            (r.errors.length > 1 ? ` (외 ${r.errors.length - 1}건)` : ""),
        );
    }
  }

  ok(n > 0, `스펙을 ${n}장 찾았습니다`);
  ok(bad.length === 0, `형식에 어긋난 것 ${bad.length}장`);
  for (const b of bad.slice(0, 10)) console.log(chalk.gray("      " + b));
  if (bad.length > 10)
    console.log(chalk.gray(`      …외 ${bad.length - 10}장`));
}


// ─── ③ 파서 ──────────────────────────────────────────────────────────────

// 자동 검증과 양산이 같이 쓰는 파서입니다. 여기가 틀리면 **양쪽이 같이**
// 틀립니다. 실물에서 본 꼴을 그대로 넣어 둡니다 — 홑따옴표를 못 보던 잘못이
// 실제로 액티비티 271개를 가렸습니다 (2026-09-01).
export function checkParser(): void {
  console.log(chalk.bold("\n③ 파서 — import 줄에서 모듈을 읽어 내나"));
  const one = (src: string): string =>
    modulesInSource(src)
      .map((r) => `${r.kind}:${r.subject}/${r.module}`)
      .join(" ");

  ok(
    one(`import { M29 } from '@_common/module/MA/M29/M29'`) ===
      "activity:MA/M29",
    "홑따옴표 · 경로에 모듈 이름",
  );
  ok(
    one(`import { M27 } from "@_common/module/MA"`) === "activity:MA/M27",
    "쌍따옴표 · 배럴에서 이름",
  );
  ok(
    one(`import {E07} from '@_common/module/EN'`) === "activity:EN/E07",
    "빈칸 없는 중괄호",
  );
  ok(
    one(`import { K14 } from "@_common/module/KR/K14/K14"`) ===
      "activity:KO/K14",
    "국어는 폴더가 KR 이고 학습코드는 KO",
  );
  ok(
    one(
      `import { InterBookActivity } from "@_common/sparkLib/module/InterBook/InterBookActivity"`,
    ) === "sparkLib:/InterBook",
    "sparkLib 은 경로의 폴더 이름 (과목은 부르는 쪽이 채웁니다)",
  );
  ok(
    one(`import { Com_Content } from '@dori_common/Com_Content'`) ===
      "common:/Com_Content",
    "과목을 안 가리는 공용 모듈",
  );
  ok(
    one(`import { type M27Data } from "@_common/module/MA"`) === "",
    "`type` 만 들여온 것은 모듈이 아닙니다",
  );
  ok(
    one(`import { M27 as Quiz } from "@_common/module/MA"`) ===
      "activity:MA/M27",
    "`as` 로 이름을 바꿔도 앞의 것이 모듈",
  );
  ok(
    one(`import { GameMap } from "@_common/module/EN/E28/GameMap"`) ===
      "activity:EN/E28",
    "이름이 아니라 자리로 — GameMap 은 EN/E28 과 KR/K32 둘 다 있습니다",
  );
}
