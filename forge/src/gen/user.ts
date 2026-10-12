// 만든 사람이 누구인지. `activityInfo.json` 의 developer 칸에 들어갑니다.
//
// 한 번 적어 두면 그 PC 에서 계속 씁니다 — 액티비티마다 다시 묻지 않습니다.
// 파일은 `sparkon_forge/.user.json` 이고 git 에 올라가지 않습니다(사람마다 다름).

import fs from "fs";
import { execFileSync } from "child_process";
import { repoPath } from "./paths";

// **호 repo 들이 있는 자리도 여기 적습니다** (2026-09-02). 처음에는 「sparkon_forge 의
// 형제」로 못박고 「사람이 정해 줄 것이 없다」고 적어 뒀는데, 그건 만든 사람
// PC 의 생김새였습니다. 다른 자리에 받아 둔 사람에게는 조용히 엉뚱한 폴더를
// 보게 됩니다 — 찾는 차례는 `paths.ts` 의 `pickRoot()`.
//
// **비워 두면 여태처럼 알아서 찾습니다.** 적는 것은 못 찾을 때뿐입니다.
// **리소스를 놓는 자리도 여기 적습니다** (2026-09-16). 원래는 호 저장소 안
// `sparkon_mNN/public/sparklab/<코드>` 한 자리뿐이었는데, 그 폴더는 **이미 만든
// 액티비티가 들어 있는 남의 저장소**입니다. 시험 삼아 넣고 빼는 일을 거기서 하면
// 멀쩡한 회차를 건드리게 됩니다. 비워 두면 여태처럼 호 저장소 안을 봅니다.
export type DevUser = {
  developer: string;
  devTeam: string;
  workRoot: string;
  /** 리소스를 놓는 자리. 비면 호 저장소 안 `public/sparklab` */
  rscRoot: string;
  /**
   * **스펙 주인인가** (2026-09-29 사용자 결정 — 스펙은 한 사람만 만들고 고친다). 참이면 앱이 스펙 화면과
   * 「새 모듈」 알림을 연다. 이 파일은 PC 마다 따로라(.gitignore) 주인 PC 에만 적는다. 없으면 거짓
   */
  specOwner: boolean;
};

const FILE = () => repoPath(".user.json");

// 기존 activityInfo.json 들이 쓰는 꼴입니다 — `seokho.yu(유석호)`.
// 아이디만 알면 괄호 없이 아이디만 넣습니다.
export function loadUser(): DevUser {
  const file = FILE();
  if (fs.existsSync(file)) {
    try {
      const j = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<DevUser>;
      return {
        developer: j.developer ?? gitUserName(),
        devTeam: j.devTeam ?? "my-team",
        workRoot: typeof j.workRoot === "string" ? j.workRoot : "",
        rscRoot: typeof j.rscRoot === "string" ? j.rscRoot : "",
        specOwner: j.specOwner === true,
      };
    } catch {
      // 깨졌으면 없는 셈 치고 아래로 내려갑니다.
    }
  }
  return { developer: gitUserName(), devTeam: "my-team", workRoot: "", rscRoot: "", specOwner: false };
}

export function saveUser(user: Partial<DevUser>): DevUser {
  const merged = { ...loadUser(), ...user };
  fs.writeFileSync(FILE(), JSON.stringify(merged, null, 2) + "\n", "utf8");
  return merged;
}

function gitUserName(): string {
  try {
    return execFileSync("git", ["config", "user.name"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

// 만든 날. `2026-09-14` 처럼 **하이픈으로** 끊습니다.
//
// **점이 아니라 하이픈인 까닭 — 세어 봤습니다 (2026-09-14).** 호 저장소 열한 개의
// `activityInfo.json` 1,190장 가운데 하이픈이 860장(72%), 점이 279장(23%)입니다.
// 아직 안 만든 m08~m11 은 자리표가 **전부 하이픈**이고, 점이 몰려 있는 곳은
// m07(76/108) — **양산기가 만든 8호**입니다. 즉 점은 이 함수가 퍼뜨린 것이고
// 저장소의 정본은 하이픈이었습니다.
//
// 이미 나간 8호를 소급해 고치지는 않습니다. 읽는 코드가 없어(쓰기만 합니다)
// 당장 깨지는 것은 없고, 원본 파일을 건드리는 일이라 사람이 정할 몫입니다.
export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
