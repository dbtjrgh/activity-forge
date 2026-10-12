// 액티비티 하나가 **어느 모듈을 쓰는가** — `Activity.ts` 의 import 줄에서 읽습니다.
//
// **왜 소스를 읽나.** 빌드 산출물에는 모듈 이름이 남지 않고(한 덩어리로 묶입니다)
// `activityInfoList` 에도 없습니다. 소스가 유일한 자리입니다.
//
// ⭐ **여기가 정본입니다.** `deploy/server/src/util/activityModules.ts` 에 같은
// 파일이 사본으로 있습니다. 고치는 것은 여기서만 하고, `yarn check:spec` 을 돌린
// 뒤 그쪽으로 내려보내세요.
//
// **왜 한 벌이어야 하나 (2026-09-01).** 같은 파서가 두 벌 있었습니다 —
// 자동 검증(`deploy` 의 `service/verifyTarget.ts`)과 양산(그때는 같은 repo 의
// `service/gen/survey.ts`). 각자 상대가 못 하는 것을 하나씩 하고 있었습니다.
//
//   자동 검증  `type X` 를 걸러냄            홑따옴표 import 를 못 봄
//   양산       홑·쌍따옴표 다 봄 · 과목까지   `type X` 를 모듈로 셈
//
// 그래서 자동 검증은 **홑따옴표로 적은 액티비티 271개를 통째로 못 보고**
// 있었습니다. 둘을 한 벌로 합쳐서 고쳐졌습니다.
//
// **2026-09-10 에 양산이 이 repo 로 나왔습니다.** repo 가 갈렸어도 **글자는 한 벌**
// 이라는 규칙은 그대로입니다. 파서를 고칠 일이 생기는 쪽이 양산이라 정본을 여기 둡니다.
//
// **읽는 자리는 부르는 쪽이 정합니다.** 자동 검증은 서버의 `_source` 사본을,
// 양산은 내 PC 의 형제 repo 를 봅니다. 여기는 글자만 받습니다.

// 학습코드 쪽 글자(MA·KO·EN)와 폴더 이름(MA·KR·EN)이 국어에서 어긋납니다.
const DIR_SUBJECT: Record<string, string> = { MA: "MA", KR: "KO", EN: "EN" };

export interface ModuleRef {
  // 학습코드 쪽 글자. MA · KO · EN. sparkLib 모듈은 빈 문자열입니다.
  subject: string;
  // 모듈 폴더 이름. M27 · K14 · GameMap · InterBook
  module: string;
  // activity  과목 모듈           @_common/module/MA/M29/…
  // sparkLib  프레임워크 모듈      @_common/sparkLib/module/InterBook/…
  // common    과목을 안 가리는 것  @_common/module/dori_common/Com_Content
  // local     아직 액티비티 안에 있는 파생 모듈   ./M27_2/M27_2
  kind: "activity" | "sparkLib" | "common" | "local";
}

// `import { A, B as C, type D } from '…'` 한 줄. **따옴표 두 가지를 다 봅니다.**
const IMPORT_LINE = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;

// 과목 모듈의 두 가지 꼴. 둘 다 실물에서 확인했습니다.
//   @_common/module/MA/M29/M29   경로에 모듈 이름이 있음
//   @_common/module/MA           묶음(배럴)에서 꺼내 씀
const ACTIVITY_MODULE = /\/module\/(MA|KR|EN)(?:\/([A-Za-z0-9_]+))?/;
// @_common/sparkLib/module/InterBook/InterBookActivity → InterBook
const SPARKLIB_MODULE = /\/sparkLib\/module\/([A-Za-z0-9_]+)/;
// 과목을 안 가리는 공용 모듈. 협력사가 쓰는 자리라 이름이 그렇습니다.
//   @_common/module/dori_common/Com_Content   ·   @dori_common/Com_Content
const COMMON_MODULE = /(?:\/module\/dori_common|^@dori_common)\/([A-Za-z0-9_]+)/;
// **아직 액티비티 폴더 안에 있는 파생 모듈.**
//   import { M27_2 } from "./M27_2/M27_2"
// 파생 모듈은 액티비티 안에서 만들고, 검수가 끝나면 공통으로 옮깁니다. 그동안
// 이것을 모듈로 안 세면 `gen draft` 도 `check:repro` 도 그 모듈을 못 봅니다 —
// 정작 스펙이 제일 필요한 때입니다 (2026-09-08, MAL1M07W1S2 의 M27_2).
//
// **폴더 이름과 파일 이름이 같은 것만** 봅니다. `./component/ArrowBtn` 처럼
// 부품을 담아 두는 폴더와 갈라야 합니다.
const LOCAL_MODULE = /^\.\/([A-Za-z0-9_]+)\/([A-Za-z0-9_]+)(?:\.ts)?$/;

// 가져온 이름들. `X as Y` 는 앞의 X 가 실제 모듈이고, `type X` 는 모듈이 아닙니다.
function importedNames(inside: string): string[] {
  return inside
    .split(",")
    .map((v) => v.trim())
    .filter((v) => !/^type\s/.test(v))
    .map((v) => (v.split(/\s+as\s+/)[0] ?? "").trim())
    .filter((v) => v !== "");
}

export function modulesInSource(src: string): ModuleRef[] {
  const out: ModuleRef[] = [];
  const seen = new Set<string>();
  const add = (r: ModuleRef): void => {
    const key = `${r.kind}/${r.subject}/${r.module}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(r);
  };

  IMPORT_LINE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMPORT_LINE.exec(src)) !== null) {
    const from = m[2] ?? "";

    // 액티비티 안엣것 먼저 봅니다. 상대경로라 아래 규칙에는 어차피 안
    // 걸리지만, 여기서 갈라 두면 무엇을 보고 있는지가 드러납니다.
    const loc = LOCAL_MODULE.exec(from);
    if (loc?.[1] && loc[1] === loc[2]) {
      add({ subject: "", module: loc[1], kind: "local" });
      continue;
    }

    // sparkLib 먼저 봅니다. 그 경로에도 `/module/` 이 들어 있어서, 순서가
    // 뒤집히면 `sparkLib/module/InterBook` 을 과목 모듈로 잘못 읽습니다.
    const lib = SPARKLIB_MODULE.exec(from);
    if (lib?.[1]) {
      add({ subject: "", module: lib[1], kind: "sparkLib" });
      continue;
    }

    // 과목 글자(MA·KR·EN)가 아닌 공용 모듈. 이것도 자동 검증의 대상입니다 —
    // 고치면 이것을 쓰는 액티비티가 다 바뀌니까요.
    const com = COMMON_MODULE.exec(from);
    if (com?.[1]) {
      add({ subject: "", module: com[1], kind: "common" });
      continue;
    }

    const act = ACTIVITY_MODULE.exec(from);
    if (!act) continue;
    const subject = DIR_SUBJECT[act[1] ?? ""] ?? "";

    // **이름이 아니라 자리로 가릅니다.** `GameMap` 은 `EN/E28` 과 `KR/K32` 두
    // 곳에 있어서 이름만 보면 다른 모듈 둘이 한 줄로 합쳐집니다. 경로에 폴더가
    // 있으면 경로를 믿습니다 — `M03` 과 `M03_1` 도 그래서 갈립니다.
    const folder = act[2];
    if (folder) {
      add({ subject, module: folder, kind: "activity" });
      continue;
    }
    // 배럴로 들여온 것만 이름을 씁니다. 그때는 이름이 곧 폴더입니다.
    for (const name of importedNames(m[1] ?? "")) {
      add({ subject, module: name, kind: "activity" });
    }
  }
  return out;
}

// 폴더 이름만 필요한 쪽(자동 검증)을 위한 얇은 껍데기.
export function moduleNamesInSource(src: string): string[] {
  return modulesInSource(src).map((r) => r.module);
}
