// 「전에 만든 것」을 열어 봅니다.
//
// 양산은 앞선 액티비티를 보고 따라 만드는 일입니다. 그런데 실제로 시간이 제일
// 많이 드는 자리가 리소스 폴더와 소스 폴더를 손으로 찾아 들어가는 것입니다.
// 학습코드 하나면 둘 다 열립니다.
//
// 한 창에 탭 두 개로 모으는 것은 해 봤지만 접었습니다 (2026-08-31).
// 윈도우는 「탐색기 탭을 열어라」는 명령을 내주지 않습니다 — 창을 여는 스위치만
// 있습니다. 남는 길은 사람이 누르는 것과 같은 키(Ctrl+T → Ctrl+L → 붙여넣기)를
// 밀어 넣는 것뿐인데, 초점을 잡아도 탭이 생기지 않았고, 도는 동안 다른 창을
// 클릭하면 Ctrl+V 가 그쪽으로 들어가는 위험까지 있었습니다.

import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { parseStudyCode } from "./spec";
import { workRoot } from "./paths";

export type RefFolder = { label: string; dir: string; exists: boolean };

// 뿌리 경로. 만드는 자리와 같은 기준입니다 — 호 repo 들이 나란히 있는 폴더.
// 어디서 띄우든 같은 곳을 봅니다 (paths.ts 참고).
export function defaultRoot(): string {
  return workRoot();
}

// 학습코드의 호 번호가 곧 폴더 이름입니다 — M06 → sparkon_m06.
// 「8호」처럼 사람이 부르는 번호가 아니라 코드에 적힌 번호를 씁니다.
export function refFolders(code: string, root: string): RefFolder[] {
  const study = parseStudyCode(code);
  if (!study) return [];
  const repo = path.join(root, `sparkon_m${String(study.month).padStart(2, "0")}`);
  return [
    { label: "리소스", dir: path.join(repo, "public", "sparklab", study.code) },
    { label: "소스", dir: path.join(repo, "src", "activity", study.code) },
  ].map((d) => ({ ...d, exists: fs.existsSync(d.dir) }));
}

// 있는 것만 엽니다. 없는 폴더를 열면 탐색기가 「찾을 수 없다」 창을 띄우는데,
// 그것보다 화면에 「아직 없습니다」라고 적어 주는 편이 낫습니다.
export function openFolders(folders: RefFolder[]): RefFolder[] {
  for (const f of folders) {
    // explorer 는 성공해도 종료 코드 1 을 냅니다 — 에러로 보면 안 됩니다.
    if (f.exists) execFile("explorer.exe", [f.dir], () => {});
  }
  return folders;
}
