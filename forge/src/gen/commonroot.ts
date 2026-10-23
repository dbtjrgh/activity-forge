// **공용 모듈 저장소(`sparkon_common`) 자리** (2026-10-21 사용자 말 — 「공용폴더도 비슷한 경로로 있긴한데
// 경로 정할 수 있게 해놔」). 대개 호 저장소 옆(`<작업 폴더>/sparkon_common`)이지만 다른 자리에 받아 둔
// 사람도 있습니다. `.user.json` 의 `commonRoot` 가 있으면 그 자리, 비면 작업 폴더 안입니다.
//
// `paths.ts` 에서 떼어 냈습니다 (2026-10-23, 동작 변화 없음) — 그 파일이 200줄을 넘었습니다.
// 작업 폴더 · 설정 읽기는 `paths.ts` 를 부르고, `paths.ts` 는 이 파일을 부르지 않습니다(서로 물지 않게).
//
// **이 자리를 셈하는 곳은 여기 하나입니다** — 모듈 폴더(`surveyfind.ts` `moduleDir`) · 스펙이 낡았나(`specdrift.ts`) ·
// 앱의 회귀 검사 · main 올리기 · 미리보기 점검이 다 이것을 부릅니다. 기본 자리가 `workRoot()` 를 거치므로
// `SPARKON_WORK_ROOT` 덮어쓰기도 그대로 따라갑니다(적어 둔 `commonRoot` 는 덮어쓰기와 상관없이 그 자리입니다).
//
// sparkon CLI(`sparkon link`)는 이 설정을 모릅니다 — 늘 **작업 폴더 안** `sparkon_common` 에 정션을 겁니다.
// 그래서 `beside` 로 그 자리가 쓰는 자리로 이어지는지 알려 화면이 한 줄 경고합니다. 그 자리가 비었으면(`free`) 앱의 「연결」이
// 거기에 쓰는 자리로 가는 정션을 먼저 걸고 CLI 를 부릅니다(2026-10-23, 앱 `services/forge/commonlink.ts`) — 그 뒤로는 `beside` 입니다.

import fs from "fs";
import path from "path";
import { samePlace, savedSetting, workRoot } from "./paths";

export const COMMON_NAME = "sparkon_common";

export function commonRoot(): string {
  const set = savedSetting("commonRoot");
  return set ? path.resolve(set) : path.join(workRoot(), COMMON_NAME);
}

export type CommonPick = {
  /** 쓰는 자리 — `commonRoot()` 와 같다 */
  dir: string;
  /** `.user.json` 에 적힌 값. 비면 기본 자리를 본다 */
  saved: string;
  /** 기본 자리 — `<작업 폴더>/sparkon_common` */
  home: string;
  /** 기본 자리가 쓰는 자리로 이어지나 — 같은 자리이거나 기본 자리가 쓰는 자리로 가는 정션입니다. sparkon CLI 는 기본 자리만 봅니다 */
  beside: boolean;
  /** 기본 자리에 아무것도 없나(끊어진 정션도 「있음」) — 그러면 앱의 「연결」이 거기에 쓰는 자리로 가는 정션을 겁니다 */
  free: boolean;
};

export function commonPick(): CommonPick {
  const home = path.join(workRoot(), COMMON_NAME);
  const dir = commonRoot();
  // `samePlace` 는 글자만 봅니다(`setCommonRoot` 가 그 꼴을 씁니다) — 이어졌나는 정션까지 따라가 봅니다. 못 따라가면(없음 · 끊김) 아닙니다
  const real = (p: string): string => {
    try {
      return fs.realpathSync(p);
    } catch {
      return "";
    }
  };
  const [rd, rh] = [real(dir), real(home)];
  const beside = samePlace(dir, home) || (rd !== "" && rh !== "" && samePlace(rd, rh));
  // 그 자리에 아무것도 없나 — 끊어진 정션도 있는 것입니다(`existsSync` 는 끊어진 정션을 「없음」으로 봅니다)
  let free = false;
  try {
    fs.lstatSync(home);
  } catch (error) {
    free = (error as NodeJS.ErrnoException).code === "ENOENT";
  }
  return { dir, saved: savedSetting("commonRoot") ?? "", home, beside, free };
}
