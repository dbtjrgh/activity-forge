// 어디서 띄우든 같은 자리를 보게 하는 곳입니다.
//
// 전에는 전부 `path.resolve("sparkon_cli", …)` 였습니다 — 「지금 서 있는 폴더
// 아래에 sparkon_cli 가 있다」는 가정입니다. 그래서 `sparkon_cli` 안에서
// 화면을 띄우면 `sparkon_cli/sparkon_cli/spec` 을 뒤지고, 스펙 목록이
// 통째로 비어 나왔습니다 (2026-09-01).
//
// **자리를 두 번 옮겼습니다.** 2026-09-01 `sparkon_cli` → `deploy`,
// 2026-09-10 `deploy` → **이 repo(`sparkon_forge`)**. 양산은 사람 PC 의
// 디스크에 쓰는 일이라 배포 서버가 할 수 있는 일이 아니어서 아예 갈라냈습니다.
// 자리가 셋으로 갈립니다.
//
//   GEN_DIR   — 이 도구 자신의 파일들 (ui·template)
//   REPO_ROOT — sparkon_forge repo. 스펙(`_spec`)과 레시피(`_recipe`)가 여기 있습니다
//   workRoot  — 호 repo(sparkon_mNN)들이 나란히 있는 자리
//
// **스펙을 도구 옆이 아니라 repo 뿌리에 둡니다.** 사람이 열어 보고 고치는
// 자료이지 코드가 아닙니다.

import fs from "fs";
import path from "path";

// 이 파일은 `<repo>/src/gen/paths.ts` 입니다.
// ts-node 로 바로 돌아서 빌드 산출물이 없습니다 — 소스 자리가 곧 실행 자리입니다.
//
// **다른 자리에서 불러 쓸 때는 `FORGE_REPO_ROOT` 로 알려 줍니다** (2026-09-11).
// Electron 앱이 이 코드를 번들해서 부르면 `__dirname` 이 앱의 `out/main` 이 되어
// `REPO_ROOT` 가 앱 폴더를 가리킵니다 — `_spec`·`_recipe`·`.user.json` 을 없는
// 자리에서 찾고, 스펙 목록이 통째로 비어 나옵니다. 2026-09-01 에 `sparkon_cli`
// 안에서 화면을 띄웠을 때와 같은 종류의 조용한 실패입니다.
//
// 비워 두면 여태처럼 소스 자리를 씁니다 — **CLI 동작은 그대로입니다.**
const ROOT_OVERRIDE = process.env["FORGE_REPO_ROOT"]?.trim();

export const REPO_ROOT = ROOT_OVERRIDE
  ? path.resolve(ROOT_OVERRIDE)
  : path.resolve(__dirname, "..", "..");

// 번들된 코드에는 `ui`·`template` 파일이 들어 있지 않습니다. 알려 준 repo 뿌리
// 아래의 소스 자리를 가리켜 그 파일들을 원본에서 읽게 합니다.
export const GEN_DIR = ROOT_OVERRIDE ? path.join(REPO_ROOT, "src", "gen") : __dirname;

// ui·template 처럼 코드에 딸린 파일.
export function genPath(...parts: string[]): string {
  return path.join(GEN_DIR, ...parts);
}

// _spec·_recipe 처럼 repo 에 딸린 자료.
export function repoPath(...parts: string[]): string {
  return path.join(REPO_ROOT, ...parts);
}

// 호 repo(`sparkon_mNN`) 들이 있는 자리. **사람마다 다릅니다.**
//
// 처음에는 「이 repo 의 형제」로 못박아 뒀는데, 그건 **내 PC 의 생김새**였습니다
// (2026-09-02). 다른 자리에 받아 둔 사람에게는 조용히 엉뚱한 폴더를 보고
// 「리소스 폴더가 없습니다」만 뜹니다 — 무엇이 잘못인지 알 길이 없습니다.
//
// 그래서 찾는 차례를 넷으로 둡니다.
//
//   ⓪ `SPARKON_WORK_ROOT` 환경변수   **그 프로세스에만** — 리허설용 (아래)
//   ① `.user.json` 의 `workRoot`     사람이 정해 둔 자리 (화면에서 고칩니다)
//   ② 지금 서 있는 폴더               거기 호가 보이면
//   ③ 이 repo 의 부모                 여태 쓰던 기본값
//
// **①이 틀렸으면 조용히 넘어가지 않습니다** — `workRootWhy()` 가 무엇을 보고
// 골랐는지 말해 주고, 화면이 그것을 띄웁니다.
//
// **⓪은 저장하지 않습니다 (2026-09-15).** 정본은 그대로 `.user.json` 하나입니다 —
// 두 곳에 저장하면 「화면에서는 바꿨는데 명령은 옛 폴더를 본다」가 됩니다.
// 이것은 저장이 아니라 **한 프로세스 안에서만 사는 덮어쓰기**라서, 배치를 돌리는
// 동안에도 앱은 사람이 정한 자리를 그대로 봅니다. 리허설은 두 시간 넘게 도는데
// 그동안 앱이 멈춰 있을 이유가 없습니다.
//
// **덮어썼으면 반드시 말합니다.** 말없이 두면 화면에서 자리를 바꿔도 안 먹는
// 까닭을 알 길이 없습니다 — 위 ①이 막으려던 것과 같은 실패입니다.
export function workRoot(): string {
  return pickRoot().dir;
}

export function workPath(...parts: string[]): string {
  return path.join(workRoot(), ...parts);
}

export type RootPick = {
  dir: string;
  from: "덮어씀" | "설정" | "지금 폴더" | "기본";
  repos: number; // 그 자리에서 찾은 호 개수
  // 설정해 둔 자리에 호가 없을 때. 화면이 이걸 그대로 띄웁니다.
  warn?: string;
};

export function pickRoot(): RootPick {
  const forced = process.env["SPARKON_WORK_ROOT"]?.trim();
  if (forced) {
    const dir = path.resolve(forced);
    const n = countRepos(dir);
    return {
      dir,
      from: "덮어씀",
      repos: n,
      warn:
        `SPARKON_WORK_ROOT 로 작업 폴더를 덮어썼습니다 — ${dir}` +
        (n === 0 ? " (여기에 sparkon_mNN 폴더가 없습니다)" : "") +
        ". 설정한 자리는 그대로이고, 이 프로세스만 다른 데를 봅니다.",
    };
  }
  const set = savedRoot();
  if (set) {
    const n = countRepos(set);
    if (n > 0) return { dir: set, from: "설정", repos: n };
    // 적어 뒀는데 호가 없습니다. **적은 자리를 그대로 씁니다** — 말없이
    // 다른 데로 옮겨 가면 「왜 내 설정이 안 먹지」가 됩니다.
    return { dir: set, from: "설정", repos: 0, warn: `지정한 경로에 sparkon_mNN 폴더가 없습니다 — ${set}` };
  }
  const cwd = process.cwd();
  if (countRepos(cwd) > 0) return { dir: cwd, from: "지금 폴더", repos: countRepos(cwd) };
  const up = path.resolve(REPO_ROOT, "..");
  const n = countRepos(up);
  return {
    dir: up,
    from: "기본",
    repos: n,
    ...(n === 0
      ? { warn: `호 저장소를 찾지 못했습니다 — ${up} 에 sparkon_mNN 폴더가 없습니다. 위 「바꾸기」에서 경로를 지정해 주세요.` }
      : {}),
  };
}

// `.user.json` 을 여기서 직접 읽습니다. `user.ts` 를 부르면 서로 물고
// 돌아갑니다(user.ts 가 repoPath 를 씁니다).
function savedRoot(): string | null {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, ".user.json"), "utf8")) as {
      workRoot?: unknown;
    };
    const v = typeof j.workRoot === "string" ? j.workRoot.trim() : "";
    return v === "" ? null : v;
  } catch {
    return null;
  }
}

function countRepos(dir: string): number {
  try {
    return fs.readdirSync(dir).filter((f) => /^sparkon_m\d\d$/.test(f)).length;
  } catch {
    return 0;
  }
}
