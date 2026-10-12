// 양산 화면 서버의 주소 표 — 주소를 `api.ts` 의 함수에 잇기만 합니다.
//
// `server.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 서버를 띄우고 끄는 일은 거기 남습니다.

import http from "http";
import fs from "fs";
import path from "path";
import type { Recipe } from "./types";
import type { DevUser } from "./user";
import { GEN_DIR, genPath } from "./paths";
import * as api from "./api";

type Json = Record<string, unknown> | unknown[];

/** 서버가 띄울 때 정해 두는 넷 — 요청마다 같은 값을 봅니다. */
export type ServerAt = { port: number; uiFile: string; boardFile: string; startedAt: number };

export async function handle(req: http.IncomingMessage, res: http.ServerResponse, at: ServerAt): Promise<void> {
  const { port, uiFile, boardFile, startedAt } = at;
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  try {
    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, "text/html; charset=utf-8", fs.readFileSync(uiFile));
    }
    // 화면 조각. **데스크톱 앱도 이 파일들을 그대로 씁니다** — 화면을 두 벌로
    // 두지 않으려고 `index.html` 을 css·마크업·js 로 나눴습니다 (2026-09-11).
    // 앱 쪽은 CSP 가 inline script 를 막기도 해서 어차피 나눠야 했습니다.
    //
    // **이름은 둘만 받습니다.** 경로를 받아 파일을 읽는 자리라서요.
    if (req.method === "GET" && (url.pathname === "/screen.css" || url.pathname === "/screen.js")) {
      const name = url.pathname.slice(1);
      const type = name.endsWith(".css") ? "text/css" : "text/javascript";
      return send(res, 200, `${type}; charset=utf-8`, fs.readFileSync(genPath("ui", name)));
    }
    // 진행판. **따로 띄워 두는 창입니다** — 양산 화면 옆에 놓고 봅니다.
    // 리소스를 옮기는 동안 상태가 저절로 바뀌는 것이 이 창의 쓸모입니다.
    if (req.method === "GET" && url.pathname === "/board") {
      return send(res, 200, "text/html; charset=utf-8", fs.readFileSync(boardFile));
    }
    if (req.method === "GET" && url.pathname === "/api/board") {
      return json(res, 200, api.board(
        url.searchParams.get("subject") ?? "EN",
        url.searchParams.get("issue") ?? "07",
      ));
    }
    // 이 서버가 옛 코드로 돌고 있지 않은지. 소스가 프로세스보다 새것이면 stale 입니다.
    if (req.method === "GET" && url.pathname === "/api/version") {
      // 작업 폴더를 **늘 함께 내줍니다.** 화면 맨 위에 띄워 두면 「왜 내
      // 액티비티가 안 보이지」가 한눈에 풀립니다.
      // stale 은 여기만의 걱정입니다 — 앱은 번들이라 볼 소스가 없습니다.
      return json(res, 200, {
        startedAt,
        stale: sourceIsNewerThan(startedAt),
        ...api.workspace(),
      });
    }
    if (req.method === "GET" && url.pathname === "/api/specs") {
      return json(res, 200, api.specs());
    }
    if (req.method === "GET" && url.pathname === "/api/spec") {
      const subject = url.searchParams.get("subject") ?? "MA";
      const module = url.searchParams.get("module") ?? "";
      return json(res, 200, api.spec(subject, module) as unknown as Json);
    }
    // ── 모듈 스펙 만들기 ────────────────────────────────────────────
    // 스펙이 119종 중 3개뿐이라 여기가 병목입니다. 화면에서 만들게 합니다.
    if (req.method === "GET" && url.pathname === "/api/modules") {
      return json(res, 200, api.modules());
    }
    // 표본을 견줘 초안을 냅니다. 파일로는 쓰지 않습니다 — 사람이 보고 고친 뒤
    // /api/spec 으로 되돌려 보내야 그때 남습니다.
    if (req.method === "POST" && url.pathname === "/api/draft") {
      const p = (await body(req)) as { subject?: string; module?: string };
      return json(res, 200, api.draft(p.subject ?? "", p.module ?? "") as unknown as Json);
    }
    // 사람이 채운 스펙을 spec/{과목}/{모듈}.json 으로 남깁니다.
    if (req.method === "POST" && url.pathname === "/api/spec") {
      const p = (await body(req)) as { subject?: string; module?: string; spec?: unknown; force?: boolean };
      return json(res, 200, api.writeSpec(p.subject ?? "", p.module ?? "", p.spec, p.force === true));
    }

    if (req.method === "GET" && url.pathname === "/api/user") {
      return json(res, 200, api.user());
    }
    if (req.method === "POST" && url.pathname === "/api/user") {
      const u = (await body(req)) as Partial<DevUser>;
      return json(res, 200, api.setUser(u));
    }
    // 전에 만든 액티비티의 리소스·소스 폴더를 탐색기로 엽니다.
    // 여는 것뿐이고 고치지는 않습니다 — 참고하려고 보는 자리입니다.
    if (req.method === "POST" && url.pathname === "/api/open") {
      // 뿌리는 묻지 않습니다 — 작업 폴더가 곧 호 repo 들이 있는 자리입니다.
      // 만드는 자리와 같은 기준이라 둘이 어긋날 일도 없습니다.
      const p = (await body(req)) as { code?: string };
      return json(res, 200, api.openRef(p.code ?? "") as unknown as Json);
    }
    // 리소스 폴더에 실제로 놓인 파일 목록. 화면이 파일명을 「고르게」 해 줍니다.
    if (req.method === "GET" && url.pathname === "/api/files") {
      return json(res, 200, api.files(url.searchParams.get("code") ?? "") as unknown as Json);
    }
    // 리소스를 부어 넣을 빈 폴더를 먼저 만들고 탐색기로 엽니다.
    if (req.method === "POST" && url.pathname === "/api/rsc") {
      const p = (await body(req)) as { code?: string };
      return json(res, 200, api.resourceDir(p.code ?? ""));
    }
    // 모듈 배치표 — **학습코드 하나로 「어느 모듈 · 어느 원본」**을 돌려줍니다.
    //
    // 화면에서 학습코드를 다 적으면 이걸 부릅니다. 그러면 모듈 고르는 칸과
    // 원본 칸이 저절로 채워집니다 — 사람이 「이 차시는 뭘 쓰지」를 찾아
    // 헤맬 까닭이 없습니다. CLI 의 `gen clone <새코드>` 와 같은 함수입니다.
    //
    // **못 고르면 까닭을 그대로 내보냅니다.** 「갈림」인 차시는 사람이
    // 정해야 하는데, 화면이 조용히 아무거나 고르면 안 됩니다.
    if (req.method === "GET" && url.pathname === "/api/layout") {
      return json(res, 200, api.layoutFor(url.searchParams.get("code") ?? "") as unknown as Json);
    }
    // 이미 있는 회차를 통째로 떠 옵니다 — CLI 의 `gen clone` 과 같은 함수입니다.
    //
    // **화면이 빈 폼부터 시작하는 것을 없애려고 붙였습니다.** 자리가 800개쯤
    // 되는 모듈에서 처음부터 채우는 것은 못 할 짓입니다. 원본 값을 그대로
    // 돌려주므로, 화면은 그것을 깔아 두고 **달라진 데만** 고치게 합니다.
    //
    // 파일은 안 건드립니다. 값만 내줍니다.
    if (req.method === "GET" && url.pathname === "/api/clone") {
      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? undefined;
      return json(res, 200, api.clone(from, to || undefined) as unknown as Json);
    }
    if (req.method === "POST" && url.pathname === "/api/check") {
      const recipe = (await body(req)) as Recipe;
      return json(res, 200, api.check(recipe) as unknown as Json);
    }
    if (req.method === "POST" && url.pathname === "/api/generate") {
      const payload = (await body(req)) as { recipe: Recipe; force?: boolean; save?: boolean };
      return json(res, 200, api.generate(
        payload.recipe, payload.force === true, payload.save !== false,
      ) as unknown as Json);
    }
    send(res, 404, "text/plain; charset=utf-8", "없는 주소입니다.");
  } catch (e) {
    json(res, 200, { ok: false, issues: [], error: (e as Error).message });
  }
}

// 소스가 프로세스보다 나중에 고쳐졌으면, 이 서버는 옛 코드로 돌고 있습니다.
//
// **화면(ui/index.html)은 부를 때마다 새로 읽지만 코드는 뜰 때 한 번만 읽습니다.**
// 그래서 고친 것이 화면에는 보이는데 동작은 그대로인, 제일 헷갈리는 꼴이
// 됩니다. 그 상태를 화면 위에 빨간 띠로 알립니다.
//
// 전에는 `bin/gen` 의 빌드 산출물을 봤습니다. 이 repo 는 ts-node 로 바로
// 돌아서 산출물이 없습니다 — 소스를 그대로 봅니다 (2026-09-01).
function sourceIsNewerThan(startedAt: number): boolean {
  try {
    return fs.readdirSync(GEN_DIR)
      .filter((f) => f.endsWith(".ts"))
      .some((f) => fs.statSync(path.join(GEN_DIR, f)).mtimeMs > startedAt);
  } catch {
    return false; // 못 보면 아무 말도 하지 않습니다. 없는 걱정을 만들지 않게.
  }
}

// 스펙 목록 · 생성 · 스펙 저장 · 레시피 남기기는 **`api.ts` 로 옮겼습니다** —
// 데스크톱 앱이 같은 일을 IPC 로 부르는데, 여기 두면 두 벌이 됩니다.

function body(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function send(res: http.ServerResponse, code: number, type: string, data: Buffer | string): void {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(data);
}

function json(res: http.ServerResponse, code: number, data: Json): void {
  send(res, code, "application/json; charset=utf-8", JSON.stringify(data));
}
