// `yarn gen:ui` — 레시피를 손으로 쓰지 않게 해 주는 로컬 화면.
//
// 화면은 스펙에서 만들어집니다. 스펙에 필드를 더하면 칸이 저절로 생깁니다.
// 파일을 쓰는 일은 CLI 의 generate() 가 그대로 합니다 — 화면은 값만 만듭니다.
// 나중에 웹으로 옮길 때도 이 API 모양 그대로 서버에 붙이면 됩니다.

import http from "http";
import fs from "fs";
import { chalk } from "./color";
import { exec } from "child_process";
import type { Spec } from "./types";
import { genPath, pickRoot } from "./paths";
// **일은 여기서 하지 않습니다.** 라우트(`serverroutes.ts`)는 주소를 함수에 잇기만 합니다.
// 같은 함수를 데스크톱 앱이 IPC 로 부릅니다 (`api.ts` 머리말).
import { handle } from "./serverroutes";

export function startUi(port: number, open: boolean): void {
  const uiFile = genPath("ui", "index.html");
  const boardFile = genPath("ui", "board.html");
  // 화면 파일은 요청마다 다시 읽지만 이 서버 코드는 띄울 때 한 번만 읽힙니다.
  // 그래서 소스를 고치고도 서버를 안 내리면 「화면은 새것, 서버는 옛것」이
  // 됩니다 — 그 꼴이면 멀쩡한 값에 엉뚱한 에러가 납니다. 화면에 알려 줍니다.
  const startedAt = Date.now();
  if (!fs.existsSync(uiFile)) {
    console.log(chalk.red(`화면 파일이 없습니다: ${uiFile}`));
    process.exit(1);
  }

  const server = http.createServer((req, res) => handle(req, res, { port, uiFile, boardFile, startedAt }));

  // **이미 하나 떠 있으면 그렇다고 말합니다.**
  //
  // 앞서 띄운 것이 살아 있으면 여기서 EADDRINUSE 로 죽습니다. 날것 그대로는
  // 스택만 열 줄 쏟아져서 「왜 안 되지」가 됩니다. 게다가 제일 흔한 경우가
  // **내 터미널이 아닌 곳에서 띄운 것** 입니다 — 그러면 Ctrl+C 가 안 닿아서,
  // 껐다고 생각하고 다시 띄우는데 계속 같은 자리에서 막힙니다.
  //
  // 그래서 끄는 법을 그 자리에 적어 줍니다. 굳이 안 꺼도 되는 경우가 더
  // 많으니(화면은 부를 때마다 새로 읽습니다) 그 이야기를 먼저 합니다.
  server.on("error", (e: NodeJS.ErrnoException) => {
    if (e.code !== "EADDRINUSE") throw e;
    const addr = `http://localhost:${port}`;
    console.log();
    console.log(chalk.red(`${port} 번을 이미 누가 쓰고 있습니다 — 양산 화면이 하나 더 떠 있는 것입니다.`));
    console.log(`  화면만 고쳤다면 그것을 그냥 쓰면 됩니다 — ${chalk.cyan(addr)} 에서 새로고침.`);
    console.log("  **서버 코드를 고쳤다면 꼭 꺼야 합니다.** 코드는 뜰 때 한 번만 읽습니다.");
    console.log(chalk.gray("  Ctrl+C 가 안 먹으면 그 창이 띄운 것이 아니라서입니다. PowerShell 에서:"));
    console.log(chalk.cyan(
      `    Get-NetTCPConnection -State Listen -LocalPort ${port} | ` +
      "ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"));
    console.log();
    process.exit(1);
  });

  // **127.0.0.1 에만 답합니다.** 호스트를 안 적으면 0.0.0.0 — 사내망의 다른 PC 가
  // `/api/generate` 로 이 PC 디스크에 파일을 쓸 수 있습니다. 이 서버는 로컬 도구입니다.
  server.listen(port, "127.0.0.1", () => {
    const addr = `http://localhost:${port}`;
    console.log();
    console.log(chalk.green(`양산 화면이 열렸습니다 — ${addr}`));
    // **어디를 보고 있는지 먼저 말합니다.** 사람마다 다른 자리라서요.
    const root = pickRoot();
    console.log(chalk.gray(`작업 폴더 — ${root.dir}  (호 ${root.repos}개 · ${root.from})`));
    if (root.warn) console.log(chalk.yellow(`  ${root.warn}`));
    console.log(chalk.gray("끄려면 Ctrl+C."));
    if (open) exec(`start "" "${addr}"`, { shell: "cmd.exe" });
  });
}

// **주소 표는 `serverroutes.ts` 로 떼어 냈습니다** (2026-09-30, 243줄이라 — 동작 변화 없음).

export type { Spec };
