"use strict";

// ─── 상태 ────────────────────────────────────────────────────────────────
// recipe 하나가 이 화면의 전부입니다. 폼은 이것을 고치기만 합니다.
const S = {
  specs: [],
  spec: null,
  recipe: { recipeVersion: 1, code: "", module: "", assets: {}, gameData: {} },
  preview: null,
  tab: null,
  // 리소스 폴더를 읽은 결과. 파일명을 손으로 적는 대신 여기서 고릅니다.
  rsc: { dir: "", exists: false, files: [] },
  mainTab: "assets", // 리소스 / GameData
  gdTab: null,       // GameData 안의 탭 (스펙 필드 이름, 또는 "기본")
  // 접어 둔 배열 칸. 열쇠는 자리 경로(`quizData.inningData[2]`)입니다 —
  // renderGameData() 가 통째로 다시 그리므로 DOM 이 아니라 여기 둡니다.
  folded: new Set(),
  foldSeen: new Set(), // 처음 그려 본 배열. 자동 접기를 한 번만 하려고
  issues: [],          // 마지막 검사 결과. 접힌 칸에 에러 수를 달아 줍니다
  // 떠 온 원본. **값을 견주는 데만 씁니다** — 아직 안 고친 자리를 흐리게
  // 보여 주려고 들고 있습니다. 생성에는 안 들어갑니다.
  origin: null,        // { code, gameData }
  // 모듈 스펙 만들기 쪽. 액티비티 만들기와 아무것도 나눠 쓰지 않습니다.
  md: { rows: [], subject: "", module: "", spec: null, force: false },
};

const KINDS = ["image", "sound", "lottie", "font"];
let groupSeq = 0;
const KIND_LABEL = { image: "이미지", sound: "사운드", lottie: "로티", font: "폰트" };
const $ = (id) => document.getElementById(id);

// ─── 스펙 불러오기 ───────────────────────────────────────────────────────

async function boot() {
  measureHeader();
  await loadDeveloper();
  setupRef();
  setupClone();
  setupBoard();
  setupGuide();
  setupRoot();
  S.specs = await getJson("/api/specs");
  // 빈 목록은 조용히 넘어가면 안 됩니다 — 「고르세요」 하나만 남아서
  // 칸이 사라진 것처럼 보입니다. 어디를 뒤졌는지 화면에 적습니다.
  if (!Array.isArray(S.specs) || !S.specs.length) {
    S.specs = [];
    const v = await getJson("/api/version").catch(() => ({}));
    $("specNote").innerHTML =
      '<span class="none">스펙을 하나도 못 읽었습니다 — ' +
      `<code>${esc((v.cwd || "?") + "\\sparkon_forge\\_spec")}</code> 를 뒤졌습니다. ` +
      "양산기를 호 폴더들이 나란히 있는 자리에서 띄우세요.</span>";
  }
  const sel = $("module");
  sel.innerHTML = '<option value="">— 고르세요 —</option>' +
    S.specs.map((s) => `<option value="${s.subject}/${s.module}">${specLabel(s)}</option>`).join("");
  sel.onchange = onPickModule;
  $("code").oninput = () => { S.recipe.code = normCode($("code")); syncSubject(); check(); };
  // 코드를 다 적고 칸을 벗어나면 그때 한 번 읽습니다. 글자마다 읽으면 헛일입니다.
  $("code").onchange = () => { scanRsc(); void applyLayout(); };
  $("rscScan").onclick = scanRsc;
  $("rscOpen").onclick = () => void openRsc();
  $("devFinished").onchange = () => { S.recipe.info.devFinished = $("devFinished").checked; check(); };
  $("gen").onclick = doGenerate;
  setupTabs();
  setupModes();
  checkStale();
  // 되살리다 탈이 나도 화면은 떠야 합니다. 못 되살리면 버리고 빈 화면으로 갑니다.
  try {
    await restoreDraft();
  } catch (e) {
    dropDraft();
    console.warn("적어 둔 것을 되살리지 못해 버렸습니다.", e);
  }
}

// 오른쪽 칸이 머리에 가리지 않게, 머리 높이를 재서 그만큼 띄웁니다.
function measureHeader() {
  const set = () => {
    const css = document.documentElement.style;
    css.setProperty("--headerH", $("hdr").offsetHeight + "px");
    // GameData 안의 탭이 위 탭 바로 밑에 붙어 서려면 위 탭이 몇 픽셀인지
    // 알아야 합니다. 눈대중으로 박아 두면 글꼴이 바뀔 때 틈이 벌어집니다.
    css.setProperty("--tabsH", $("mainTabs").offsetHeight + "px");
  };
  set();
  addEventListener("resize", set);

  // **머리 높이는 값이 채워질 때마다 바뀝니다.** 모듈을 고르면 설명이 들어와
  // 툴바가 한 줄 더 감기고, 학습코드를 적으면 알림 줄이 늘어납니다. 창 크기는
  // 그대로라 resize 가 안 옵니다.
  //
  // 그동안 main 은 `100vh - 처음 잰 머리` 로 남아 있어서, 늘어난 만큼 화면보다
  // 커집니다. 그러면 **페이지째 스크롤이 생기고** 왼쪽 칸에 붙여 둔 탭이
  // 통째로 위로 밀려 올라가 안 보입니다 — 「바깥에서 스크롤을 내리면 리소스·
  // GameData 가 사라진다」가 이것이었습니다 (2026-09-03).
  //
  // 머리가 커지는 것을 지켜보고 그때마다 다시 잽니다.
  if (window.ResizeObserver) new ResizeObserver(set).observe($("hdr"));
}

// 개발자 이름. 적어 두면 `sparkon_forge/.user.json` 에 남아 다음에도 그대로 씁니다.
// 처음 열면 git 의 user.name 이 들어와 있습니다.
async function loadDeveloper() {
  const u = await getJson("/api/user");
  const inp = $("developer");
  inp.value = u.developer || "";
  // 「개발 완료」는 켠 채로 시작합니다. 여기서 만든 것은 만든 그 자리에서
  // 다 된 것이라, 끄고 시작하면 매번 손으로 켜야 했습니다.
  S.recipe.info = { developer: u.developer || "", devTeam: u.devTeam || "my-team", devFinished: true };

  let t = null;
  inp.oninput = () => {
    S.recipe.info.developer = inp.value.trim();
    clearTimeout(t);
    t = setTimeout(() => post("/api/user", { developer: inp.value.trim() }), 600);
    check();
  };
}

// ─── 전에 만든 것 열기 ───────────────────────────────────────────────────
// 학습코드의 호 번호가 폴더 이름입니다 — MAL1M06W1S1 이면 sparkon_m06.
// 리소스(public/sparklab)와 소스(src/activity) 두 곳을 함께 엽니다.

// 어디서 찾을지는 묻지 않습니다 — CLI 를 띄운 폴더가 곧 호 repo 들이 있는
// 자리이고, 새로 만드는 자리도 같은 기준입니다. 정할 것이 없으니 칸도 없습니다.
function setupRef() {
  $("refOpen").onclick = openRef;
  $("refCode").oninput = () => normCode($("refCode"));
  $("refCode").onkeydown = (e) => { if (e.key === "Enter") openRef(); };
}

// 사람은 `KO-L1-M06-W3-S1` 처럼 끊어서 적습니다. WBS 를 그대로 복사해 붙이면
// 그 꼴로 들어옵니다. 글자와 숫자만 남기고 사이에 낀 것은 버립니다.
//
// 지운 것이 있을 때만 칸을 다시 씁니다. 아무 때나 다시 쓰면 글자 사이를
// 고치는 중에 커서가 끝으로 튑니다.
function normCode(el) {
  const clean = el.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (el.value !== clean) el.value = clean;
  return clean;
}

// ─── 모듈 배치표 ─────────────────────────────────────────────────────────
//
// 학습코드를 다 적으면 **모듈 칸과 원본 칸이 저절로 채워집니다.**
//
// `EN-L1-M07-W1-S1` 에서 호(`M07`)만 빼면 `L1W1S1` 이 남고, 이것은 호가 달라도
// 같은 차시입니다. 그 차시를 앞선 호가 이미 만들어 두었으니 거기 쓰인 모듈이
// 이 칸에 들어갈 것입니다 — 서버의 `layout.ts`, CLI 의 `gen layout` 과 같은
// 함수입니다.
//
// **학습코드를 바꾸면 모듈과 원본을 배치표 것으로 다시 맞춥니다.** 골라 둔
// 것이 있어도 그렇습니다 — 앞 회차 값이 남아 있는 채로 「배치표는 E05 라는데
// 칸에는 M03」 이 되면, 무엇이 맞는지 알 길이 없습니다. 바꾸고 싶으면 그 뒤에
// 고르면 되고, 학습코드를 안 건드리는 한 그대로 있습니다.
//
// **못 고르면 채우지 않고 까닭을 적습니다.** 앞선 호마다 모듈이 다른 차시가
// 셋 있는데(영어 8호), 거기서 조용히 아무거나 고르면 **다른 모듈로 액티비티가
// 만들어집니다.**
async function applyLayout() {
  const box = $("moduleMsg");
  const code = S.recipe.code || "";
  if (!/^(MA|KO|EN)L\dM\d\dW\dS\d$/.test(code)) { box.textContent = ""; return; }

  const r = await getJson("/api/layout?code=" + encodeURIComponent(code));
  if (!r || !r.ok) {
    // 「갈림」이면 후보와 호별 내력이 여기 그대로 들어옵니다. 줄바꿈을 살립니다.
    box.innerHTML = `<span class="none pre">${esc((r && r.error) || "배치표를 못 읽었습니다.")}</span>`;
    return;
  }

  // 스펙이 아직 없는 모듈은 목록에 없습니다. 그때는 채우지 못하고 이름만 알립니다.
  const opt = [...$("module").options].find((o) => o.value.endsWith("/" + r.module));
  if (opt && $("module").value !== opt.value) {
    $("module").value = opt.value;
    await onPickModule();
  }

  $("cloneFrom").value = r.origin;
  // **자리가 어긋난 원본은 그렇다고 말합니다.** 같은 모듈이라 값의 짜임은
  // 맞지만 차시가 다르면 문구도 리소스 이름도 남의 차시 것이라, 그대로 두면
  // 안 됩니다. 다음 후보는 마우스를 올리면 보입니다.
  $("cloneMsg").className = r.sameSlot ? "" : "warn";
  $("cloneMsg").innerHTML =
    r.sameSlot
      ? `배치표가 고른 원본입니다 <span class="dim2">— 같은 차시를 만든 제일 가까운 호</span>`
      : `<b>다른 차시</b>에서 떠 옵니다 <span class="dim2">— 이 차시를 만든 앞선 호가 없습니다</span>`;
  $("cloneMsg").title =
    r.why + (r.alt && r.alt.length ? `\n다음 후보 — ${r.alt.join(" · ")}` : "");

  // **짧게 적습니다.** 까닭(why)이 길면 이 줄이 툴바 폭을 다 먹고 오른쪽 칸을
  // 밀어냅니다. 긴 까닭은 마우스를 올리면 보이게 title 로 넘깁니다.
  box.innerHTML =
    `배치표 — <b>${esc(r.slot)}</b> 차시는 <b>${esc(r.module)}</b> ` +
    `<span class="dim2">(${esc(r.verdict)})</span>` +
    (opt ? "" : ` <span class="none">· 스펙이 아직 없습니다</span>`);
  box.title = `${r.verdict} — ${r.why}`;
}

async function openRef() {
  const code = normCode($("refCode"));
  const box = $("refMsg");
  const r = await post("/api/open", { code });
  if (!r.ok) {
    box.innerHTML = `<span class="none">${esc(r.error || "열지 못했습니다.")}</span>`;
    return;
  }
  // 없는 폴더는 열지 않습니다. 대신 어디를 찾았는지 그대로 보여 줍니다 —
  // 경로가 틀린 것인지 아직 안 만든 것인지 바로 가려집니다.
  box.innerHTML = r.folders.map((f) =>
    `<div><span class="${f.exists ? "yes" : "none"}">${f.exists ? "열림" : "없음"}</span> ` +
    `${esc(f.label)} · ${esc(f.dir)}</div>`).join("");
}

// 학습코드를 적으면 과목이 정해집니다. 그 과목 스펙만 남깁니다.
function syncSubject() {
  const opts = [...$("module").options].filter((o) => o.value);
  const m = /^(MA|KO|EN)/.exec(S.recipe.code || "");
  // **학습코드를 지우면 다시 다 보입니다.** 안 그러면 앞서 적었던 과목의 것만
  // 남아, 목록이 왜 짧아졌는지 알 길이 없습니다 (2026-09-03).
  if (!m) {
    for (const o of opts) o.hidden = false;
    return;
  }
  const subject = m[1];
  const mine = (o) => o.value.startsWith(subject + "/");
  // 그 과목 스펙이 하나도 없으면 가리지 않습니다. 빈 목록을 내주느니
  // 전부 보여 주고 사람이 고르게 하는 편이 낫습니다.
  const any = opts.some(mine);
  for (const o of opts) o.hidden = any && !mine(o);
}

async function onPickModule() {
  const v = $("module").value;
  if (!v) { S.spec = null; render(); return; }
  const [subject, module] = v.split("/");
  S.spec = await getJson(`/api/spec?subject=${subject}&module=${module}`);
  S.recipe.module = module;
  // 스펙이 들고 있는 기본 리소스를 미리 채워 둡니다.
  S.recipe.assets = {};
  for (const kind of KINDS) {
    const d = (S.spec.assets.defaults || {})[kind];
    if (d) S.recipe.assets[kind] = d.map((a) => ({ ...a }));
  }
  // 스펙이 「꼭 필요하다」고 적은 자원은 빈 줄로 자리를 잡아 둡니다.
  for (const req of S.spec.assets.required || []) {
    const list = (S.recipe.assets[req.kind] = S.recipe.assets[req.kind] || []);
    if (!list.some((a) => a.alias === req.alias)) list.push({ alias: req.alias, file: "" });
  }
  // 뿌리가 배열인 모듈은 감쌀 객체가 없습니다 — 배열째로 뼈대를 잡습니다.
  S.recipe.gameData =
    S.spec.gameData.kind === "array"
      ? Array.from({ length: S.spec.gameData.minLength || 1 }, () =>
          S.spec.gameData.of ? seedValue(S.spec.gameData.of) : "")
      : seed(S.spec.gameData.fields);
  // 모듈이 바뀌면 자리도 통째로 바뀝니다. 접어 둔 것을 들고 가면 엉뚱한 칸이
  // 접힌 채로 뜹니다.
  S.folded.clear(); S.foldSeen.clear();
  render();
}

// 스펙의 기본값으로 GameData 뼈대를 만듭니다.
function seed(fields) {
  const out = {};
  for (const f of fields || []) {
    // 「안 쓰면 키째로 뺀다」는 칸은 미리 만들지 않습니다.
    // 빈 껍데기를 만들어 두면 생성기가 「쓰는 것」으로 보고 그 안의 필수 칸이
    // 비었다고 잡습니다 — 안 쓰겠다는데 에러가 나는 꼴이 됩니다.
    if (f.optional) continue;
    out[f.key] = seedValue(f);
  }
  return out;
}
function seedValue(f) {
  if (f.default !== undefined) return f.default;
  switch (f.type) {
    case "object": {
      const o = seed(f.fields);
      if (f.variants) Object.assign(o, seedVariant(f.variants, f.variants.cases[0]));
      // 번호로 늘어나는 열쇠는 최소 개수만큼 미리 깔아 둡니다.
      if (f.series) {
        for (let i = 1; i <= (f.series.min || 0); i++) o[f.series.prefix + i] = seedValue(f.series.of);
      }
      return o;
    }
    // 최소 개수가 정해진 배열은 그만큼 미리 채웁니다.
    // 빈 화면에서 「+ 추가」부터 눌러야 하는 것보다 낫습니다.
    case "array":
      return Array.from({ length: f.minLength || 0 }, () =>
        f.of ? seedValue(f.of) : "");
    case "point": return { x: 0, y: 0 };
    case "posTable": return {};
    case "bool": return false;
    case "number": return 0;
    default: return "";
  }
}
function seedVariant(variants, kase) {
  const o = {};
  for (const f of kase.fields || []) setPath(o, f.key, f.default !== undefined ? f.default : "");
  return o;
}

// ─── 그리기 ──────────────────────────────────────────────────────────────

// 이미 만든 회차를 떠 옵니다. 모듈·값·리소스가 통째로 들어오고, 학습코드만
// 지금 적은 것으로 바뀝니다.
//
// **원본을 따로 들고 있는 것이 핵심입니다.** 떠 온 직후에는 모든 값이 남의
// 회차 것입니다. 무엇을 아직 안 고쳤는지 알려면 견줄 것이 있어야 합니다.
// 진행판 — 이 화면 위에 겹쳐 띄웁니다.
//
// **안은 `/board` 를 iframe 으로 띄웁니다.** 진행판을 한 벌만 만들어 두고
// 여기서도 쓰고 주소로 따로 열어도 씁니다. 두 벌로 그리면 「겹쳐 뜬 것과 새
// 창이 서로 다르다」가 생깁니다.
//
// **학습코드에서 과목·호를 꺼냅니다** — 지금 만들고 있는 것의 진행판이 떠야
// 합니다. 아직 안 적었으면 지난번에 본 것을(없으면 EN 07) 씁니다.
//
// **닫을 때 iframe 의 주소를 비웁니다.** 안 비우면 안 보이는 채로 10초마다
// 계속 서버를 두드립니다.
function boardWhere() {
  const m = /^(MA|KO|EN)L\dM(\d\d)/.exec(S.recipe.code || "");
  if (m) {
    try { localStorage.setItem("gen.board", m[1] + m[2]); } catch {}
    return { subject: m[1], issue: m[2] };
  }
  try {
    const was = localStorage.getItem("gen.board");
    if (was) return { subject: was.slice(0, 2), issue: was.slice(2) };
  } catch {}
  return { subject: "EN", issue: "07" };
}

// 놓은 자리와 크기를 기억합니다. 창을 열 때마다 다시 옮기게 하면 못 씁니다.
const WIN_KEY = "gen.board.win";

function setupBoard() {
  const win = $("boardSheet");
  const frame = $("boardFrame");

  const save = () => {
    try {
      localStorage.setItem(WIN_KEY, JSON.stringify({
        x: win.offsetLeft, y: win.offsetTop, w: win.offsetWidth, h: win.offsetHeight,
      }));
    } catch { /* 사파리 사생활 모드 같은 데서는 그냥 넘어갑니다 */ }
  };

  // 처음 열 때 자리. **화면 오른쪽 아래**에 둡니다 — 왼쪽 위는 학습코드 칸이라
  // 가리면 안 됩니다.
  const place = () => {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(WIN_KEY) || "null"); } catch { /* 무시 */ }
    const w = Math.min(p?.w || 900, window.innerWidth - 40);
    const h = Math.min(p?.h || 620, window.innerHeight - 40);
    // 기억해 둔 자리가 화면 밖이면 되돌립니다 — 모니터가 바뀌면 그런 일이 생깁니다.
    const x = clamp(p?.x ?? window.innerWidth - w - 24, 0, Math.max(0, window.innerWidth - w));
    const y = clamp(p?.y ?? window.innerHeight - h - 24, 0, Math.max(0, window.innerHeight - h));
    win.style.width = w + "px";
    win.style.height = h + "px";
    win.style.left = x + "px";
    win.style.top = y + "px";
  };

  const close = () => {
    save();
    win.hidden = true;
    // 주소를 비웁니다. 안 비우면 안 보이는 채로 10초마다 서버를 계속 두드립니다.
    frame.src = "about:blank";
  };

  $("boardBtn").onclick = () => {
    if (!win.hidden) return close(); // 한 번 더 누르면 닫힙니다
    const w = boardWhere();
    $("boardTtl").textContent = `${w.subject} ${Number(w.issue) + 1}호(M${w.issue}) 진행판`;
    frame.src = `/board?subject=${w.subject}&issue=${w.issue}`;
    win.hidden = false;
    place();
  };
  $("boardX").onclick = close;

  // 제목 줄을 끌어 옮깁니다. iframe 위를 지나도 안 끊기게 `moving` 을 겁니다.
  let drag = null;
  $("boardHead").addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    drag = { dx: e.clientX - win.offsetLeft, dy: e.clientY - win.offsetTop };
    win.classList.add("moving");
    $("boardHead").setPointerCapture(e.pointerId);
  });
  $("boardHead").addEventListener("pointermove", (e) => {
    if (!drag) return;
    win.style.left = clamp(e.clientX - drag.dx, 0, window.innerWidth - win.offsetWidth) + "px";
    win.style.top = clamp(e.clientY - drag.dy, 0, window.innerHeight - win.offsetHeight) + "px";
  });
  const drop = () => {
    if (!drag) return;
    drag = null;
    win.classList.remove("moving");
    save();
  };
  $("boardHead").addEventListener("pointerup", drop);
  $("boardHead").addEventListener("pointercancel", drop);

  // 오른쪽 아래 모서리로 크기를 바꿉니다(CSS resize). 바뀐 크기도 기억합니다.
  if (window.ResizeObserver) {
    let t = 0;
    new ResizeObserver(() => {
      if (win.hidden) return;
      clearTimeout(t);
      t = setTimeout(save, 300);
    }).observe(win);
  }

  // 다른 모니터에 놓고 보고 싶을 때. 떠 있는 창은 닫습니다.
  $("boardOpen").onclick = () => {
    const w = boardWhere();
    close();
    const opened = window.open(
      `/board?subject=${w.subject}&issue=${w.issue}`,
      "sparkon-board",
      "width=1180,height=880",
    );
    if (opened) opened.focus();
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function setupClone() {
  const go = () => void doClone();
  $("cloneGo").onclick = go;
  $("cloneFrom").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  $("cloneFrom").addEventListener("input", () => normCode($("cloneFrom")));
}

async function doClone() {
  const box = $("cloneMsg");
  // 배치표가 붙여 둔 「다른 차시」 표시를 지웁니다 — 이제 사람이 고른 원본입니다.
  box.className = "";
  box.title = "";
  const from = $("cloneFrom").value.trim();
  if (!from) { box.innerHTML = '<span class="none">원본 회차의 학습코드를 적으세요.</span>'; return; }
  box.textContent = "읽는 중…";

  const to = S.recipe.code || "";
  const r = await getJson(`/api/clone?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  if (!r || !r.ok) {
    box.innerHTML = `<span class="none">${esc((r && r.error) || "못 읽었습니다.")}</span>`;
    return;
  }

  // 원본이 쓰던 모듈로 갈아탑니다. 스펙이 있어야 칸을 그릴 수 있습니다.
  const key = (r.recipe.subject || "") + "/" + r.recipe.module;
  const spec = await getJson(`/api/spec?subject=${r.recipe.subject}&module=${r.recipe.module}`);
  if (!spec || !spec.module) {
    box.innerHTML = `<span class="none">${esc(key)} 스펙이 없습니다 — 먼저 초안을 만드세요.</span>`;
    return;
  }
  S.spec = spec;
  if ([...$("module").options].some((o) => o.value === key)) $("module").value = key;

  // 학습코드는 지금 적어 둔 것이 이깁니다. 안 적었으면 원본 것이 들어옵니다.
  S.recipe = r.recipe;
  if (to) S.recipe.code = to;
  // **만든 사람은 베끼지 않습니다.** S.recipe 를 통째로 갈아끼우는 자리라
  // 다시 넣어 주지 않으면 개발자 이름이 날아가고, devFinished 를 켜는 순간
  // 없는 info 에 쓰다가 멈춥니다.
  // 「개발 완료」도 원본 것을 안 베낍니다 — 켠 채로 시작합니다.
  S.recipe.info = { developer: $("developer").value.trim(), devTeam: "my-team", devFinished: true };
  $("devFinished").checked = true;
  $("code").value = S.recipe.code || "";
  syncSubject();

  // 견줄 원본. 깊은 사본이라야 합니다 — 같은 것을 가리키면 고치는 족족
  // 원본도 같이 바뀌어 「그대로인 자리」가 영영 안 나옵니다.
  S.origin = { code: r.from, gameData: JSON.parse(JSON.stringify(r.recipe.gameData || {})) };
  S.folded.clear(); S.foldSeen.clear();

  const notes = (r.notes || []).map((n) => `<div class="none">${esc(n)}</div>`).join("");
  box.innerHTML = `<span class="yes">${esc(r.from)} 에서 떠 왔습니다</span>` + notes;

  await scanRsc();
  render();
}

// 원본에서 같은 자리의 값을 꺼냅니다. 경로는 검사 결과와 같은 꼴
// (`quizData.inningData[2].bg`)이고, 뿌리 이름은 떼고 찾습니다 —
// S.recipe.gameData 가 이미 뿌리 **속**이라서요.
function originAt(path) {
  if (!S.origin || !path) return undefined;
  const root = (S.spec && S.spec.gameData.root) || "";
  let rel = path;
  // 뿌리가 배열이면 경로가 `quizData[0].wheel` 로 옵니다 — 점이 아니라
  // 대괄호가 붙습니다. 그 꼴도 뿌리 이름을 떼야 합니다.
  if (root && rel.startsWith(root + ".")) rel = rel.slice(root.length + 1);
  else if (root && rel.startsWith(root + "[")) rel = rel.slice(root.length);
  else if (root && rel === root) return S.origin.gameData;
  let cur = S.origin.gameData;
  for (const k of rel.split(/[.[\]]+/).filter(Boolean)) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = cur[k];
  }
  return cur;
}

const sameAsOrigin = (v, o) => o !== undefined && JSON.stringify(v) === JSON.stringify(o);

function render() {
  // 넉 줄에서 잘리므로 전문을 title 에 함께 답니다.
  $("specNote").textContent = S.spec ? (S.spec.summary || "") : "";
  $("specNote").title = S.spec ? (S.spec.summary || "") : "";
  renderAssets();
  renderGameData();
  check();
}

// ─── 탭 ──────────────────────────────────────────────────────────────────

// 서버는 띄울 때 소스를 한 번만 읽습니다. 그 뒤에 고쳤다면 화면만 새것이 되고
// 서버는 옛것으로 남습니다 — 멀쩡한 값에 엉뚱한 에러가 나는 꼴이라 사람이
// 원인을 찾기 아주 어렵습니다. 그래서 화면에 대놓고 띄웁니다.
// **Ctrl+C 만 적어 두면 막다른 길이 됩니다.** 남이 띄워 둔 서버면 그 터미널이
// 없어서 눌러도 아무 일이 안 일어납니다 (2026-09-03 실제로 걸렸습니다).
// 명령까지 적으면 줄이 길어지니, 무엇을 끊으면 되는지만 한 마디 답니다.
async function checkStale() {
  const r = await getJson("/api/version");
  if (!r || !r.stale) return;
  $("staleBar").hidden = false;
  $("staleBar").innerHTML =
    "이 서버는 <b>옛 코드로 돌고 있습니다</b> — 띄운 뒤에 양산 소스가 바뀌었습니다. " +
    "Ctrl+C 로 끄고 <span class=\"p\">yarn forge ui</span> 를 다시 띄우세요. " +
    "띄운 터미널이 없으면 <b>5300 포트를 물고 있는 node</b> 를 끊으면 됩니다.";
}

// 만들어질 자리. 검사할 때 서버가 이미 경로를 셈해서 주므로 그것을 그대로 씁니다 —
// 화면이 따로 짐작하면 실제로 쓰이는 자리와 어긋날 수 있습니다.
function showTarget(files) {
  const box = $("target");
  const first = files && files[0] && files[0].path;
  if (!first) { box.hidden = true; return; }
  const dir = first.replace(/[\\/][^\\/]+$/, "");
  const rsc = S.rsc.dir || dir.replace(/([\\/])src[\\/]activity[\\/]/, "$1public$1sparklab$1");
  box.hidden = false;
  box.innerHTML =
    `<b>여기에 만듭니다</b><br>` +
    `소스 <span class="p">${esc(dir)}</span><br>` +
    `리소스 <span class="p">${esc(rsc)}</span>`;
}

// 검증이 가리키는 자리로 탭을 옮깁니다.
//   assets.lottie          → 리소스
//   quizData.dropZoneInfo… → GameData 의 dropZoneInfo 탭
// **가리킨 자리에 표시를 남깁니다.** 전에는 1.2초 반짝이고 사라졌고,
// 짚는 것도 잎 칸이 아니라 그것을 감싼 무리(.item)였습니다 — 이닝 하나가
// 통째로 테두리 쳐지니 그 안 어느 칸을 말하는지 알 수가 없었습니다.
const AIM = { node: null, crumb: null };

function clearAim() {
  if (AIM.crumb) AIM.crumb.remove();
  if (AIM.node) AIM.node.classList.remove("aim", "aim-warn");
  for (const d of document.querySelectorAll(".issue.on")) d.classList.remove("on");
  AIM.node = null;
  AIM.crumb = null;
}

// 경로를 사람이 읽는 꼴로.
//   quizData.inningData[2].answer.items[0].alias
//   → inningData 3번째 › answer › items 1번째 › alias
function crumbOf(path) {
  if (path.startsWith("assets.")) {
    const [, kind, ...rest] = path.split(".");
    return ["리소스", KIND_LABEL[kind] || kind, ...rest].join(" › ");
  }
  const root = (S.spec && S.spec.gameData && S.spec.gameData.root) || "";
  let p = path;
  if (root && p.startsWith(root + ".")) p = p.slice(root.length + 1);
  else if (root && p.startsWith(root + "[")) p = p.slice(root.length);
  return p
    .replace(/^\./, "")
    .replace(/\[(\d+)\]/g, (_, n) => " " + (Number(n) + 1) + "번째")
    .split(".")
    .join(" › ");
}

function aimAt(node, path, level) {
  clearAim();
  node.classList.add("aim");
  if (level === "warn") node.classList.add("aim-warn");

  const crumb = el("div", { class: "crumb" + (level === "warn" ? " warn" : "") });
  crumb.appendChild(el("span", { class: "where" }, crumbOf(path)));
  const off = el("button", { class: "tiny" }, "표시 끄기");
  off.onclick = (e) => { e.preventDefault(); clearAim(); };
  crumb.appendChild(off);

  // 표 줄은 안에 넣을 수 없으니 위에 줄을 하나 끼웁니다.
  if (node.tagName === "TR") {
    const row = el("tr", { class: "crumbrow" });
    const td = el("td", { colSpan: 3 });
    td.appendChild(crumb);
    row.appendChild(td);
    node.parentNode.insertBefore(row, node);
    AIM.crumb = row;
  } else {
    node.insertBefore(crumb, node.firstChild);
    AIM.crumb = crumb;
  }
  AIM.node = node;

  node.scrollIntoView({ behavior: "smooth", block: "center" });
  // 글쇠까지 옮겨 줍니다 — 눈으로 찾고 다시 눌러야 하는 수고를 없앱니다.
  const inp = node.querySelector("input:not([type=checkbox]):not([readonly]),select,textarea");
  if (inp) {
    try {
      inp.focus({ preventScroll: true });
      if (inp.select) inp.select();
    } catch (e) { /* 초점을 못 받는 칸도 있습니다 */ }
  }
}

// 그 경로에 딱 맞는 칸. 없으면 그것을 품은 것 중 가장 안쪽.
//
// **자리 이름은 마디로 끊어서 견줍니다.** 앞글자만 보면 `items` 를 찾을 때
// `item` 이 걸립니다 — 전에 그렇게 되어 있었습니다.
function nodeFor(path) {
  let exact = null;
  let best = null;
  for (const n of document.querySelectorAll("[data-path]")) {
    const at = n.dataset.path;
    if (!at) continue;
    if (at === path) { if (!exact) exact = n; continue; }
    if (path.startsWith(at + ".") || path.startsWith(at + "[")) {
      if (!best || at.length > best.dataset.path.length) best = n;
    }
  }
  return exact || best;
}

// 검증 줄을 눌렀을 때. 못 찾으면 false 를 돌려줍니다 — 부르는 쪽이
// 「어디인지 못 짚었다」고 말해 줍니다. 아무 일도 안 일어나는 것이 제일 나쁩니다.
//
//   assets.image.bg        → 리소스 탭의 그 줄
//   quizData.inningData…   → GameData 의 그 탭 → 그 칸
function jumpTo(path, level) {
  if (!path) return false;

  if (path.startsWith("assets")) {
    S.mainTab = "assets";
    showMainTab();
    const node = nodeFor(path);
    if (!node) return false;
    aimAt(node, path, level);
    return true;
  }

  const root = S.spec && S.spec.gameData.root;
  if (!root) return false;
  if (path !== root && !path.startsWith(root + ".") && !path.startsWith(root + "[")) return false;

  // 뿌리가 배열이면 탭이 하나뿐이라 가릴 것이 없습니다.
  if (S.spec.gameData.kind !== "array") {
    const key = path.slice(root.length + 1).split(/[.[]/)[0];
    const groups = gdGroups();
    S.gdTab = (groups.find((g) => g.key === key) || groups.find((g) => g.key === "기본") || {}).key;
  }
  S.mainTab = "gamedata";
  showMainTab();

  // **접힌 칸에 든 에러로도 갈 수 있어야 합니다.** 가는 길에 있는 접힘을
  // 전부 폅니다 — 안 그러면 눌러도 아무 일이 안 일어난 것처럼 보입니다.
  for (const k of [...S.folded]) {
    if (path === k || path.startsWith(k + ".") || path.startsWith(k + "[")) S.folded.delete(k);
  }
  renderGameData();

  const node = nodeFor(path);
  if (!node) return false;
  aimAt(node, path, level);
  return true;
}

// 표시는 Esc 로도 끕니다. 고르는 목록이 떠 있으면 그쪽이 먼저입니다.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !PICK.inp && AIM.node) clearAim();
});

function setupTabs() {
  for (const b of $("mainTabs").querySelectorAll("button")) {
    b.onclick = () => { S.mainTab = b.dataset.tab; showMainTab(); };
  }
  showMainTab();
}

// 탭마다 한 줄. **무엇을 보는 칸인지가 여기서 끝나야 합니다** — 자동 검증
// 화면의 칸마다 붙은 설명(`AutoVerify.tsx` 의 SECTIONS[].note)과 같은 자리입니다.
const TAB_NOTE = {
  assets: "리소스 폴더의 파일에 <b>별칭(alias)</b>을 지정합니다. 아직 등록하지 않은 파일은 종류별 목록 아래에 남으며, 클릭하면 한 줄로 추가됩니다.",
  gamedata: "모듈이 요구하는 값입니다. 이닝은 제목 줄을 클릭해 접고 펼 수 있으며, <b>흐리게 표시된 칸은 아직 원본 회차의 값</b>입니다.",
};

// 탭마다 어디까지 내려가 있었는지 기억합니다. GameData 를 한참 고치다가
// 리소스 이름을 보러 건너갔다 오면, 안 기억하면 맨 위로 돌아가 있습니다 —
// 보던 이닝을 다시 찾아 내려가는 것이 건너가는 것보다 성가십니다.
const seenAt = { assets: 0, gamedata: 0 };
let shownTab = null;

// **무엇이 스크롤을 쥐고 있는지가 화면 폭에 따라 다릅니다.** 넓으면 왼쪽 칸이
// 제 스크롤을 갖고(`main > .col{overflow-y:auto}`), 좁으면 한 줄로 세우면서
// 페이지째 굴립니다. 엉뚱한 것의 scrollTop 을 만지면 아무 일도 안 일어납니다.
//
// `#modeActivity` 를 못 박습니다 — `main > .col` 로 찾으면 문서에서 먼저 나오는
// 모듈 스펙 화면(`#modeSpec`)의 칸이 잡힙니다.
function scroller() {
  const col = document.querySelector("#modeActivity > .col");
  if (col && getComputedStyle(col).overflowY === "auto") return col;
  return document.scrollingElement || document.documentElement;
}

function showMainTab() {
  const sc = scroller();
  const moved = shownTab && shownTab !== S.mainTab;
  if (moved) seenAt[shownTab] = sc.scrollTop;

  for (const b of $("mainTabs").querySelectorAll("button")) {
    b.classList.toggle("on", b.dataset.tab === S.mainTab);
  }
  $("tab-assets").hidden = S.mainTab !== "assets";
  $("tab-gamedata").hidden = S.mainTab !== "gamedata";
  $("tabNote").innerHTML = TAB_NOTE[S.mainTab] ?? "";

  if (moved) {
    // 두 번 놓습니다. 바로 놓은 것은 아직 안 그려진 칸에서 잘리고,
    // 다음 그림에서 제 자리로 갑니다.
    const to = seenAt[S.mainTab] || 0;
    sc.scrollTop = to;
    requestAnimationFrame(() => { sc.scrollTop = to; });
  }
  shownTab = S.mainTab;
}

// **어디를 보고 있는지 늘 띄웁니다.** 호 저장소 자리는 사람마다 달라서,
// 못 찾으면 「리소스 폴더가 없습니다」만 뜨고 무엇이 잘못인지 알 수 없습니다.
//
// 자리는 `sparkon_forge/.user.json` 의 `workRoot` 에 남습니다(git 에 안 올라감).
// 비워 두면 여태처럼 알아서 찾습니다 — 서버의 `pickRoot()`.
async function loadRoot() {
  const v = await getJson("/api/version");
  const r = (v && v.root) || null;
  const bar = $("rootBar");
  bar.hidden = false;
  if (!r) { $("rootDir").textContent = "못 읽었습니다"; bar.classList.add("bad"); return; }

  $("rootDir").textContent = r.dir;
  $("rootCount").textContent = r.warn ? r.warn : `호 ${r.repos}개 · ${r.from}`;
  bar.classList.toggle("bad", !!r.warn || r.repos === 0);
  $("rootInput").value = r.from === "설정" ? r.dir : "";
}

function setupRoot() {
  const show = (on) => { $("rootForm").hidden = !on; $("rootEdit").hidden = on; };
  $("rootEdit").onclick = () => { show(true); $("rootInput").focus(); };
  $("rootCancel").onclick = () => show(false);
  const save = async () => {
    // 비우고 저장하면 「알아서 찾기」로 돌아갑니다.
    await post("/api/user", { workRoot: $("rootInput").value.trim() });
    show(false);
    await loadRoot();
    // 자리가 바뀌면 리소스 폴더도 만들 자리도 딴 곳이 됩니다. 다시 읽습니다.
    // **스펙 목록은 그대로입니다** — `_spec` 은 sparkon_forge 안이라 작업 폴더와
    // 상관이 없습니다.
    await scanRsc();
    check();
  };
  $("rootSave").onclick = () => void save();
  $("rootInput").addEventListener("keydown", (e) => { if (e.key === "Enter") void save(); });
  void loadRoot();
}

// 한 번 닫으면 이 브라우저에서는 다시 안 뜹니다. 매번 뜨면 아는 사람에게는
// 방해라서요. 저장이 막힌 브라우저에서도 화면은 그대로 떠야 하므로 감쌉니다.
function setupGuide() {
  let hide = false;
  try { hide = localStorage.getItem("genGuideOff") === "1"; } catch { /* 저장이 막혀 있으면 그냥 보여 줍니다 */ }
  $("guide").hidden = hide;
  $("guideX").onclick = () => {
    $("guide").hidden = true;
    try { localStorage.setItem("genGuideOff", "1"); } catch { /* 못 남겨도 이번에는 닫힙니다 */ }
  };
}

// GameData 를 스펙의 큰 덩어리마다 가릅니다.
// 값 하나짜리 칸들은 「기본」에 모으고, 객체·배열은 각자 탭을 갖습니다 —
// 그것들이 길어서 스크롤을 만드는 장본인이라서요.
function gdGroups() {
  if (!S.spec) return [];
  const flat = [], groups = [];
  for (const f of S.spec.gameData.fields || []) {
    if (f.type === "object" || f.type === "array") groups.push({ key: f.key, fields: [f] });
    else flat.push(f);
  }
  return flat.length ? [{ key: "기본", fields: flat }, ...groups] : groups;
}
// figma 에서 뽑거나 공유 폴더에서 받은 파일을 폴더에 부어 놓고, 화면에서는
// 고르기만 합니다. 파일명을 옮겨 적으면 반드시 어딘가 한 글자가 틀리고,
// 그 오타는 빌드를 통과해서 브라우저에서 404 로 조용히 사라집니다.

async function scanRsc() {
  const code = S.recipe.code;
  if (!code) return;
  const r = await getJson(`/api/files?code=${encodeURIComponent(code)}`);
  if (!r.ok) { S.rsc = { dir: "", exists: false, files: [] }; showRsc(r.error); renderAssets(); return; }
  S.rsc = { dir: r.dir, exists: r.exists, files: r.files };
  showRsc();
  renderAssets();
  check();
}

// 리소스 폴더를 열고, 없으면 만들어서 엽니다.
//
// 「폴더 열기」 하나뿐입니다. 폴더가 있으면 그냥 열고 없으면 만들어 여니까,
// 「만들고 열기」와 「열기」를 가를 까닭이 없습니다 — 누르는 사람에게는 같은
// 일입니다.
//
// **누르면 리소스 탭으로 데려갑니다.** 폴더를 열어 놓고 파일을 옮긴 다음
// 돌아올 자리가 거기라서입니다.
async function openRsc() {
  const box = $("codeMsg");
  if (!S.recipe.code) {
    box.innerHTML = '<span class="none">학습코드를 먼저 적으세요.</span>';
    return;
  }
  const r = await post("/api/rsc", { code: S.recipe.code });
  if (!r.ok) {
    box.innerHTML = `<span class="none">${esc(r.error || "열지 못했습니다.")}</span>`;
    return;
  }
  box.textContent = "";
  S.mainTab = "assets";
  showMainTab();
  await scanRsc();
}

function showRsc(error) {
  const box = $("rscMsg");
  // **아직 읽은 것이 없으면 단추에 불을 켭니다.** 이 칸에서 제일 먼저 눌러야
  // 하는 것인데, 안 누르고 파일명을 손으로 적기 시작하면 오타가 그대로
  // 들어갑니다. 한 번 읽고 나면 도로 꺼서 조용하게 둡니다.
  const scan = $("rscScan");
  if (scan) scan.classList.toggle("now", !error && S.rsc.files.length === 0);

  if (error) { box.innerHTML = `<span class="none">${esc(error)}</span>`; return; }
  if (!S.rsc.dir) { box.textContent = "학습코드를 적으면 그 폴더를 읽습니다."; return; }
  const n = S.rsc.files.length;
  const state = !S.rsc.exists
    ? '<span class="none">폴더가 아직 없습니다</span>'
    : n === 0
      ? '<span class="none">폴더는 있는데 파일이 없습니다</span>'
      : `<span class="yes">파일 ${n}개</span>`;
  box.innerHTML = `${state} <span class="path">${esc(S.rsc.dir)}</span>`;
}

const filesOf = (kind) => S.rsc.files.filter((f) => f.kind === kind);

// 그 종류에서 이미 어느 줄이 쓰고 있는 파일명.
const usedOf = (kind) => new Set((S.recipe.assets[kind] || []).map((a) => a.file).filter(Boolean));

// 그 줄에 보여 줄 파일 후보.
//
// **이미 어딘가에 지정한 파일은 뺍니다.** 리소스가 스물다섯 개쯤 되면 목록에서
// 「아직 안 쓴 것」을 눈으로 골라내는 일이 일이 됩니다. 남은 것만 보이면
// 위에서부터 훑어 내려가면 끝납니다. 지금 그 줄이 들고 있는 것은 남겨 둡니다 —
// 안 그러면 자기가 고른 파일이 목록에서 사라져 「지워졌나」 싶어집니다.
//
// 굳혀 두지 않고 **누를 때마다 셈합니다.** 옆줄이 방금 집어 간 것이 바로
// 빠져야 하는데, 미리 만들어 두면 그 줄을 다시 그릴 때까지 옛 목록입니다.
function fileChoices(kind, mine) {
  const used = usedOf(kind);
  if (mine) used.delete(mine);
  // 폴더가 준 차례는 글자순이라 `card_front10` 이 `card_front2` 앞에 옵니다.
  // 아래 「안 쓰는 것」 목록과 같은 차례로 세웁니다.
  return filesOf(kind).filter((f) => !used.has(f.name)).sort(byAlias).map((f) => f.name);
}

// 파일명에서 alias 를 지어 봅니다. 관례가 「파일명 그대로」라 대개 맞습니다.
const guessAlias = (name) => name.replace(/\.[^.]+$/, "").replace(/^.*\//, "");

// alias 이름순. **숫자는 글자가 아니라 수로 견줍니다.**
// 그냥 글자순이면 `card_front10` 이 `card_front2` 앞에 섭니다. 카드가 열둘씩
// 오는 회차가 있어서(8호 ENL1M07W2S2) 눈에 바로 띕니다. `numeric` 을 켠
// Intl.Collator 가 브라우저 기본으로 그것을 해 줍니다.
const nameOrder = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });
const byAlias = (a, b) => nameOrder.compare(guessAlias(a.name), guessAlias(b.name));

// 숫자 칸은 **들어가면 통째로 잡아 둡니다.** 좌표 칸은 거의 다 `0` 으로 시작하는데,
// 지우고 적으려면 눌러서 → 지우고 → 적는 세 걸음입니다. 자리가 넷씩이라 금방
// 손이 아픕니다. 잡아 두면 누르고 바로 적으면 됩니다.
//
// 누를 때는 `mouseup` 이 잡은 것을 도로 풀어 버립니다 — 브라우저가 누른 자리에
// 글쇠를 놓기 때문입니다. 들어간 직후 한 번만 막습니다.
function pickAll(inp) {
  let fresh = false;
  inp.addEventListener("focus", () => { fresh = true; inp.select(); });
  inp.addEventListener("mouseup", (e) => { if (fresh) { e.preventDefault(); fresh = false; } });
  inp.addEventListener("blur", () => { fresh = false; });
}

// ─── 후보 고르기 ─────────────────────────────────────────────────────────
//
// **`<datalist>` 를 버리고 목록을 직접 그립니다.**
//
// 두 가지를 끝내 못 했습니다.
//
//   ① **값이 들어 있으면 후보가 하나도 안 뜹니다.** datalist 는 칸에 적힌
//      글자로 후보를 거릅니다. 원본 회차를 떠 오면 칸이 전부 차 있어서,
//      목록을 보려면 매번 값을 지워야 했습니다.
//   ② ①을 피하려고 들어갈 때 칸을 비웠더니, 이번엔 브라우저가 방금 띄운
//      후보창을 **스스로 닫아 버립니다.** 값이든 목록이든 건드리면 닫는
//      규칙이라 `focus` 에서 하든 `pointerdown` 에서 하든 비켜 갈 자리가
//      없었습니다. 한 번 눌러서는 안 뜨고 두 번 눌러야 뜨던 것이 이것입니다.
//
// 우리가 그리면 우리가 안 닫으면 안 닫힙니다. 값이 있어도 누르면 전부 보이고,
// 적기 시작하면 그때부터 걸러 줍니다. **칸의 값은 건드리지 않습니다** — 비웠다
// 되돌리는 잔재주가 통째로 없어졌습니다.
//
// 창은 `<body>` 바로 아래 **하나만** 두고 돌려 씁니다. 표 안에 그리면 넘치는
// 부분이 잘리고, 줄마다 만들면 수십 개가 됩니다. 자리는 화면 기준(fixed)이라
// 스크롤하면 따라 옮깁니다.
const PICK = { inp: null, all: [], shown: [], q: "", at: -1 };

function pickBox() {
  let box = $("pickBox");
  if (box) return box;
  box = el("div", { id: "pickBox", class: "pickbox" });
  box.hidden = true;
  // **누름만 막고 고르는 것은 우리가 합니다.** 그냥 두면 초점이 칸에서 빠지고
  // blur 가 창을 먼저 닫아, 손가락을 뗄 때는 이미 목록이 없습니다.
  // 그 대신 **스크롤막대를 끌 수는 없습니다** — 누름을 막았으니까요. 목록이
  // 길면 휠이나 ↑↓ 로 내립니다.
  box.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const row = e.target.closest(".pickrow");
    if (row) takePick(row.dataset.v);
  });
  document.body.appendChild(box);
  return box;
}

function closePick() {
  PICK.inp = null;
  const box = $("pickBox");
  if (box) box.hidden = true;
}

// 칸 바로 아래에 붙입니다. 아래가 좁으면 위로 폅니다 — 표 끝줄에서 목록이
// 화면 밖으로 나가 버리면 고를 수가 없습니다.
function placePick() {
  if (!PICK.inp) return;
  // 목록을 편 채로 표가 다시 그려지면 그 칸은 이미 사라진 것입니다. 남은
  // 창이 엉뚱한 자리에 붙어 떠다니지 않게 여기서 접습니다.
  if (!PICK.inp.isConnected) { closePick(); return; }
  const r = PICK.inp.getBoundingClientRect();
  const box = pickBox();
  const below = window.innerHeight - r.bottom;
  box.style.left = `${r.left}px`;
  box.style.width = `${r.width}px`;
  if (below < 160 && r.top > below) {
    box.style.top = "auto";
    box.style.bottom = `${window.innerHeight - r.top + 2}px`;
    box.style.maxHeight = `${Math.max(80, Math.min(320, r.top - 8))}px`;
  } else {
    box.style.bottom = "auto";
    box.style.top = `${r.bottom + 2}px`;
    box.style.maxHeight = `${Math.max(80, Math.min(320, below - 8))}px`;
  }
}

function drawPick() {
  const box = pickBox();
  const q = PICK.q.trim().toLowerCase();
  PICK.shown = q ? PICK.all.filter((s) => s.toLowerCase().includes(q)) : PICK.all.slice();
  if (!PICK.shown.length) {
    // 왜 비었는지까지 말해 줍니다. 폴더를 안 읽은 것과 이름이 안 맞는 것은
    // 손쓸 데가 다릅니다.
    box.innerHTML = `<div class="picknone">${
      PICK.all.length ? "그런 이름이 없습니다." : "고를 것이 없습니다 — 「폴더 읽기」를 먼저 누르세요."
    }</div>`;
  } else {
    box.innerHTML = PICK.shown
      .map((s, i) => `<div class="pickrow${i === PICK.at ? " on" : ""}" data-v="${esc(s)}">${esc(s)}</div>`)
      .join("");
  }
  box.hidden = false;
  placePick();
  const on = box.querySelector(".pickrow.on");
  if (on) on.scrollIntoView({ block: "nearest" });
}

function takePick(v) {
  const inp = PICK.inp;
  if (!inp) return;
  inp.value = v;
  closePick();
  // 코드로 값을 넣으면 `input`·`change` 가 저절로 안 납니다. 손으로 적었을
  // 때와 똑같이 굴러가야 하므로 우리가 냅니다 — 이 둘에 alias 짓기·유령 표시·
  // 검사·임시저장이 전부 매달려 있습니다.
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  inp.dispatchEvent(new Event("change", { bubbles: true }));
}

// 칸 하나에 후보 목록을 답니다. `list()` 는 **부를 때마다** 후보를 셈해 주는
// 함수입니다 — 옆줄이 뭘 집었는지에 따라 달라지므로 미리 굳히면 안 됩니다.
function attachPick(inp, list) {
  const open = () => {
    PICK.inp = inp;
    PICK.all = list() || [];
    PICK.q = "";      // 값이 있어도 처음엔 전부 보여 줍니다
    PICK.at = -1;
    drawPick();
  };
  // 브라우저가 제 나름의 자동완성을 겹쳐 띄우면 우리 목록을 가립니다.
  inp.setAttribute("autocomplete", "off");
  // 누르면 엽니다. **이미 열려 있으면 그냥 둡니다** — 글자 사이를 누르는 것은
  // 커서를 옮기려는 것이지 목록을 닫으려는 것이 아닙니다. 닫는 것은 Esc 와
  // 칸을 벗어나는 것, 둘입니다.
  inp.addEventListener("pointerdown", () => { if (PICK.inp !== inp) open(); });
  inp.addEventListener("focus", () => { if (PICK.inp !== inp) open(); });
  inp.addEventListener("input", () => {
    if (PICK.inp !== inp) return;
    PICK.q = inp.value;
    PICK.at = -1;
    drawPick();
  });
  inp.addEventListener("blur", () => { if (PICK.inp === inp) closePick(); });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (PICK.inp === inp) { closePick(); e.stopPropagation(); } return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (PICK.inp !== inp) { open(); return; }
      e.preventDefault();
      const n = PICK.shown.length;
      if (!n) return;
      PICK.at = e.key === "ArrowDown"
        ? (PICK.at + 1) % n
        : (PICK.at <= 0 ? n - 1 : PICK.at - 1);
      drawPick();
      return;
    }
    if (e.key === "Enter" && PICK.inp === inp && PICK.at >= 0) {
      e.preventDefault();
      takePick(PICK.shown[PICK.at]);
    }
  });
}

// 창은 화면 기준이라 스크롤하면 칸만 움직이고 창은 제자리에 남습니다.
// 붙어 다니게 따라 옮깁니다. `true` — 안쪽 칸(리소스·GameData)이 굴러도 받게.
window.addEventListener("scroll", () => { if (PICK.inp) placePick(); }, true);
window.addEventListener("resize", () => { if (PICK.inp) placePick(); });

function renderAssets() {
  spareWraps.clear();
  const box = $("assets");
  box.innerHTML = "";
  if (!S.spec) { box.innerHTML = '<div class="muted">모듈을 먼저 고르세요.</div>'; return; }

  const provided = S.spec.assets.providedByModule;
  if (provided) {
    const lines = KINDS.filter((k) => provided[k]).map((k) => `${KIND_LABEL[k]}: ${provided[k].join(", ")}`);
    if (lines.length) {
      box.insertAdjacentHTML("beforeend",
        `<div class="desc">모듈이 이미 넣어 주는 것 — 여기 다시 넣지 마세요.<br>${lines.map(esc).join("<br>")}</div>`);
    }
  }

  for (const kind of KINDS) {
    // **레시피에 들어 있는 그 배열이어야 합니다.** `|| []` 로 새 배열을 만들면
    // 아래 「안 쓰는 것」이 딴 배열을 보게 되어 넣어도 안 지워집니다.
    const list = (S.recipe.assets[kind] = S.recipe.assets[kind] || []);
    const fs_ = el("fieldset");
    fs_.dataset.path = "assets." + kind;
    // 몇 줄인지 이름 옆에 붙여 둡니다. 열어 보지 않아도 크기가 가늠됩니다.
    const lg = el("legend");
    lg.innerHTML = esc(KIND_LABEL[kind]) + (list.length ? ` <span class="n">${list.length}</span>` : "");
    fs_.appendChild(lg);

    const table = el("table");
    table.innerHTML = "<tr><th style='width:34%'>alias</th><th>파일명</th><th class='shrink'></th></tr>";
    list.forEach((a, i) => {
      const req = (S.spec.assets.required || []).find((r) => r.alias === a.alias && r.fixedAlias);
      const tr = el("tr");
      // 검증이 내는 자리는 `assets.image.bg` 처럼 별칭까지입니다. 이름을
      // 고치면 자리도 따라 바뀌어야 눌렀을 때 그 줄로 옵니다.
      const markPath = () => { tr.dataset.path = "assets." + kind + "." + a.alias; };
      markPath();
      const aliasTd = el("td");
      const aliasIn = el("input", { type: "text", value: a.alias });
      if (req) { aliasIn.readOnly = true; aliasIn.title = req.note || "이름이 고정된 자원입니다."; }
      aliasIn.oninput = () => { a.alias = aliasIn.value.trim(); markPath(); check(); };
      aliasTd.appendChild(aliasIn);
      if (req) aliasTd.insertAdjacentHTML("beforeend", ' <span class="fixed">이름 고정</span>');
      tr.appendChild(aliasTd);

      const fileTd = el("td");
      const fileIn = el("input", {
        type: "text", value: a.file,
        placeholder: kind === "sound" ? "SL_ma_137_s2_nar02.mp3" : "bg.png",
      });
      // 폴더를 읽었는데 그 파일이 없으면 그 자리에서 빨갛게 알려 줍니다.
      const markGhost = () => {
        const known = S.rsc.files.some((f) => f.name === a.file);
        fileIn.classList.toggle("ghost", S.rsc.exists && !!a.file && !known);
        fileIn.title = fileIn.classList.contains("ghost") ? "이 이름의 파일이 폴더에 없습니다." : "";
      };
      fileIn.oninput = () => {
        a.file = fileIn.value.trim();
        // 빈 alias 는 파일명에서 지어 줍니다. 이미 적어 둔 것은 건드리지 않습니다.
        if (!a.alias && a.file) { a.alias = guessAlias(a.file); aliasIn.value = a.alias; }
        // 폴더를 읽었을 때만 base 를 고칩니다. 안 읽었으면 스펙이 적어 둔 것을 둡니다.
        const hit = S.rsc.exists ? S.rsc.files.find((f) => f.name === a.file) : null;
        if (hit) { if (hit.base === "root") a.base = "root"; else delete a.base; }
        markGhost();
        // **여기서 다시 그리지 않으면 아래 목록이 옛날 그대로입니다.**
        // 지정한 파일이 「안 쓰는 것」에 계속 남아 있어서, 다 채우고도
        // 아직 남은 줄 알게 됩니다. 통째로 다시 그리면 글쇠 초점을 뺏기므로
        // 그 칸만 갈아 끼웁니다.
        fillSpare(kind);
        check();
      };
      // 후보는 누를 때마다 셈합니다 — 옆줄이 방금 집어 간 파일은 빠지고,
      // 지금 이 줄이 들고 있는 것은 남습니다.
      attachPick(fileIn, () => fileChoices(kind, a.file));
      markGhost();
      fileTd.appendChild(fileIn);
      if (a.base === "root") fileTd.insertAdjacentHTML("beforeend", ' <span class="fixed">폴더 바로 아래</span>');
      tr.appendChild(fileTd);

      const del = el("td", { class: "shrink" });
      if (!req) {
        const b = el("button", { class: "tiny" }, "삭제");
        b.onclick = () => { list.splice(i, 1); renderAssets(); check(); };
        del.appendChild(b);
      }
      tr.appendChild(del);
      table.appendChild(tr);
    });
    fs_.appendChild(table);

    const add = el("button", { class: "tiny" }, "+ 줄 추가");
    add.onclick = () => {
      S.recipe.assets[kind] = S.recipe.assets[kind] || [];
      S.recipe.assets[kind].push({ alias: "", file: "" });
      renderAssets();
    };
    fs_.appendChild(add);
    fs_.appendChild(spareBox(kind));
    box.appendChild(fs_);
  }
}

// 폴더에는 있는데 아직 어느 줄도 안 쓰고 있는 파일. 눌러서 한 줄로 넣습니다.
// 「빠뜨린 리소스」가 여기 그대로 보입니다 — 다 눌러 비우면 다 쓴 것입니다.
//
// alias 는 파일명에서 짓습니다. 6호 M28 로 재 보니 37개 중 30개가 맞았고,
// 틀린 7개는 전부 이름이 고정된 자원(character_idle 처럼 모듈이 이름으로 찾는 것)
// 이었습니다. 그래서 고정 자원 칸이 비어 있으면 여기서 추측하지 않고
// 그 줄에서 직접 고르게 합니다 — 잘못 지어 놓으면 찾기가 훨씬 어렵습니다.
//
// 상자는 한 번 만들고 **속만 갈아 끼웁니다**. 파일명을 고칠 때 화면을 통째로
// 다시 그리면 적고 있던 칸에서 초점이 튕겨 나갑니다.
const spareWraps = new Map();

function spareBox(kind) {
  const wrap = el("div", { class: "spare" });
  spareWraps.set(kind, wrap);
  fillSpare(kind);
  return wrap;
}

function fillSpare(kind) {
  const wrap = spareWraps.get(kind);
  if (!wrap) return;
  wrap.innerHTML = "";
  const list = S.recipe.assets[kind] || [];
  const used = usedOf(kind);
  // **이름순으로 세웁니다.** 「전부 넣기」가 이 차례 그대로 줄을 만들므로,
  // 여기만 정렬해 두면 넣은 표도 아래 단추 목록도 같은 차례가 됩니다.
  const spare = filesOf(kind).filter((f) => !used.has(f.name)).sort(byAlias);
  if (!S.rsc.exists || !spare.length) return;

  const holes = list.filter((a) => !a.file && a.alias).length;
  wrap.appendChild(el("span", {}, "폴더에 있는데 안 쓰는 것 "));
  wrap.appendChild(el("b", {}, `${spare.length}개`));
  if (holes) {
    wrap.appendChild(el("span", { class: "none" },
      ` · 이름 고정 ${holes}칸이 비어 있습니다 — 그 줄의 파일명 칸에서 고르세요`));
  } else {
    wrap.appendChild(el("span", {}, " — "));
    const all = el("button", { class: "go" }, "전부 넣기");
    all.onclick = () => { for (const f of spare) addSpare(kind, f); renderAssets(); check(); };
    wrap.appendChild(all);
  }
  wrap.appendChild(el("br"));
  for (const f of spare) {
    const b = el("button", { class: "tiny" }, f.name);
    b.onclick = () => { addSpare(kind, f); renderAssets(); check(); };
    wrap.appendChild(b);
  }
}

// 이름을 아직 안 적은 빈 줄이 있으면 거기에, 없으면 새 줄로 넣습니다.
// 이름이 이미 적힌 빈 줄(고정 자원)은 건드리지 않습니다.
function addSpare(kind, f) {
  const list = (S.recipe.assets[kind] = S.recipe.assets[kind] || []);
  const slot = list.find((a) => !a.file && !a.alias);
  const row = slot || {};
  row.alias = guessAlias(f.name);
  row.file = f.name;
  if (f.base === "root") row.base = "root";
  if (!slot) list.push(row);
}

function renderGameData() {
  clearAim();
  const box = $("gamedata");
  const tabs = $("gdTabs");
  box.innerHTML = "";
  tabs.innerHTML = "";
  if (!S.spec) { box.innerHTML = '<div class="muted">모듈을 먼저 고르세요.</div>'; return; }
  if (S.spec.gameData.kind === "unused") {
    box.innerHTML = '<div class="muted">이 모듈은 GameData 를 쓰지 않습니다. 리소스만 채우면 됩니다.</div>';
    return;
  }

  // **뿌리가 통째로 배열인 모듈.** 감싸는 객체가 없어서 탭도 하나뿐이고,
  // 자리 경로가 `quizData[0].wheel` 처럼 바로 대괄호로 들어갑니다.
  //
  // 배열 칸을 그리는 코드를 그대로 씁니다 — 담을 그릇만 잠깐 지어 넘깁니다.
  // renderArray 는 그 배열을 **자리에서 고치므로**(push·splice) 그릇을 새로
  // 지어도 레시피가 따라옵니다. 다만 배열이 아니었을 때는 새 배열로 갈아
  // 끼우므로, 그린 뒤에 한 번 되받아 둡니다.
  if (S.spec.gameData.kind === "array") {
    const rootName = S.spec.gameData.root || "quizData";
    if (!Array.isArray(S.recipe.gameData)) S.recipe.gameData = [];
    const f = {
      key: rootName,
      type: "array",
      of: S.spec.gameData.of,
      minLength: S.spec.gameData.minLength,
      minLengthWhy: S.spec.gameData.minLengthWhy,
    };
    const holder = { [rootName]: S.recipe.gameData };
    const b = el("button", { class: "on" });
    const n = S.recipe.gameData.length;
    b.innerHTML = esc(rootName) + (n ? ` <span class="n">${n}</span>` : "");
    tabs.appendChild(b);
    box.appendChild(renderArray(f, holder, ""));
    S.recipe.gameData = holder[rootName];

    if (S.origin) {
      const t = { spots: 0, same: 0 };
      countOrigin(S.recipe.gameData, rootName, t);
      const bar = el("div", { class: "originbar" });
      bar.innerHTML = t.same
        ? `<b>${t.same}</b>자리가 아직 <b>${esc(S.origin.code)}</b> 값 그대로입니다 (모두 ${t.spots}자리 중) — 흐린 칸입니다.`
        : `${t.spots}자리가 모두 원본과 다릅니다.`;
      box.insertBefore(bar, box.firstChild);
    }
    paintIssueBadges();
    return;
  }

  const groups = gdGroups();
  if (!groups.some((g) => g.key === S.gdTab)) S.gdTab = groups[0] && groups[0].key;

  for (const g of groups) {
    const b = el("button", g.key === S.gdTab ? { class: "on" } : {});
    // 배열은 몇 칸인지 이름 옆에 답니다. 열어 보지 않아도 크기가 가늠됩니다.
    const v = S.recipe.gameData[g.key];
    const n = Array.isArray(v) ? v.length : 0;
    b.innerHTML = esc(g.key) + (n ? ` <span class="n">${n}</span>` : "");
    b.onclick = () => { S.gdTab = g.key; renderGameData(); };
    tabs.appendChild(b);
  }

  const cur = groups.find((g) => g.key === S.gdTab);
  if (cur) renderFields(cur.fields, S.recipe.gameData, box, S.spec.gameData.root || "");

  // 원본을 떠 왔으면 「아직 원본 그대로인 자리」를 셉니다.
  // 이 수가 0 이 되는 것이 이 회차를 다 고쳤다는 뜻입니다.
  if (S.origin) {
    const t = { spots: 0, same: 0 };
    if (cur) {
      const base = S.spec.gameData.root || "";
      for (const f of cur.fields) countOrigin(S.recipe.gameData[f.key], sub(base, f.key), t);
    }
    const bar = el("div", { class: "originbar" });
    bar.innerHTML = t.same
      ? `<b>${t.same}</b>자리가 아직 <b>${esc(S.origin.code)}</b> 값 그대로입니다 (이 탭 ${t.spots}자리 중) — 흐린 칸입니다.`
      : `이 탭 ${t.spots}자리는 모두 원본과 다릅니다.`;
    box.insertBefore(bar, box.firstChild);
  }
  paintIssueBadges();
}

// **그리는 것과 따로 셉니다.** 예전에는 칸을 그리면서 셌는데, 접어 둔 칸은
// 그리지 않으므로 전부 접으면 「0자리」가 됐습니다 — 다 고친 것과 구별이
// 안 됩니다. 값만 훑으면 접든 펴든 같은 수가 나옵니다.
function countOrigin(v, path, out) {
  if (v !== null && typeof v === "object") {
    if (Array.isArray(v)) v.forEach((x, i) => countOrigin(x, path + "[" + i + "]", out));
    else for (const k of Object.keys(v)) countOrigin(v[k], sub(path, k), out);
    return;
  }
  const o = originAt(path);
  if (o === undefined) return;
  out.spots++;
  if (sameAsOrigin(v, o)) out.same++;
}

// 자리 경로를 한 마디 잇습니다. 검사 결과의 `path` 와 같은 꼴이어야
// 접힌 칸에 에러 수를 달 수 있습니다.
const sub = (path, key) => (path ? path + "." + key : key);

// 접힌 칸에 무엇이 들었는지 한 줄로. 값이 아무것도 없으면 빈 칸입니다.
function itemSummary(v, depth) {
  if (depth > 3 || v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v !== "object") return "";
  for (const x of Array.isArray(v) ? v : Object.values(v)) {
    const t = itemSummary(x, depth + 1);
    if (t) return t;
  }
  return "";
}

// 칸을 넣고 빼면 번호가 밀립니다. 접힌 표시도 같이 밀어 줍니다 —
// 안 그러면 지운 칸의 접힘이 옆 칸에 옮겨 붙습니다.
function shiftFolds(path, at, delta) {
  const head = path + "[";
  const moved = [];
  for (const k of [...S.folded]) {
    if (!k.startsWith(head)) continue;
    const close = k.indexOf("]", head.length);
    const i = Number(k.slice(head.length, close));
    if (!Number.isInteger(i)) continue;
    S.folded.delete(k);
    if (delta < 0 && i === at) continue; // 지운 칸 자신
    moved.push(head + (i >= at ? i + delta : i) + k.slice(close));
  }
  for (const k of moved) S.folded.add(k);
}

function swapFolds(path, a, b) {
  const ka = path + "[" + a + "]", kb = path + "[" + b + "]";
  const fa = S.folded.has(ka), fb = S.folded.has(kb);
  S.folded.delete(ka); S.folded.delete(kb);
  if (fb) S.folded.add(ka);
  if (fa) S.folded.add(kb);
}

// 접힌 칸이 에러를 숨기면 안 됩니다. 검사 뒤에 배지만 갈아 끼웁니다 —
// 여기서 renderGameData() 를 부르면 타이핑하던 칸이 날아갑니다.
function paintIssueBadges() {
  const box = $("gamedata");
  if (!box) return;
  for (const item of box.querySelectorAll(".item[data-path]")) {
    const at = item.dataset.path;
    let n = 0;
    for (const i of S.issues) {
      if (i.level === "error" && i.path && (i.path === at || i.path.startsWith(at + ".") || i.path.startsWith(at + "["))) n++;
    }
    const b = item.querySelector(".errb");
    if (b) b.textContent = n ? "에러 " + n : "";
  }
}

function renderFields(fields, state, parent, path) {
  for (const f of fields || []) {
    parent.appendChild(f.optional ? renderOptional(f, state, path) : renderField(f, state, path));
  }
}

// 써도 되고 안 써도 되는 칸. 켜야 값이 생기고, 끄면 키째로 사라집니다.
// 켜고 끄는 것을 눈에 보이게 두는 편이 「비워 두면 알아서 빠지겠지」보다 낫습니다 —
// 빈 문자열과 「없음」은 모듈에게 다른 뜻이라서요.
function renderOptional(f, state, path) {
  const on = state[f.key] !== undefined && state[f.key] !== null;
  const wrap = el("div", { class: "opt" });

  const b = el("button", { class: "tiny" }, on ? `− ${f.key} 빼기` : `+ ${f.key} 쓰기`);
  b.onclick = () => {
    if (on) delete state[f.key];
    else state[f.key] = seedValue(f);
    renderGameData(); check();
  };
  wrap.appendChild(b);

  if (!on) {
    wrap.appendChild(el("span", { class: "offnote" }, f.desc || "안 씁니다."));
    return wrap;
  }
  wrap.appendChild(renderField(f, state, path));
  return wrap;
}

function renderField(f, state, path) {
  if (f.type === "object") return renderObject(f, state, path);
  if (f.type === "array") return renderArray(f, state, path);
  if (f.type === "posTable") return renderPosTable(f, state, sub(path, f.key));
  if (f.type === "point") return renderPoint(f.key, f.desc, state, f.key, sub(path, f.key));

  const here = sub(path, f.key);
  const wrap = el("div", { class: "field" });
  // 검증에서 이 칸을 정확히 짚을 수 있게 자리를 남깁니다.
  wrap.dataset.path = here;
  // 꼭 채워야 하는 칸의 별표는 빨갛게 — 훑을 때 바로 보입니다.
  const lab = el("label", {}, f.key);
  if (f.required) lab.insertAdjacentHTML("beforeend", ' <span class="req">*</span>');
  wrap.appendChild(lab);
  if (f.desc) wrap.appendChild(el("div", { class: "desc" }, f.desc));

  if (f.type === "bool") {
    const cb = el("input", { type: "checkbox" });
    cb.checked = state[f.key] === true;
    cb.onchange = () => { state[f.key] = cb.checked; check(); };
    const lab2 = el("label", { class: "chip" });
    lab2.appendChild(cb);
    lab2.appendChild(el("span", {}, cb.checked ? "예" : "아니오"));
    cb.addEventListener("change", () => { lab2.lastChild.textContent = cb.checked ? "예" : "아니오"; });
    wrap.appendChild(lab2);
    return wrap;
  }

  if (f.type === "enum") {
    const sel = el("select");
    sel.innerHTML = (f.values || []).map((v) =>
      `<option value="${esc(v)}"${state[f.key] === v ? " selected" : ""}>${v === "" ? "(없음)" : esc(v)}</option>`).join("");
    sel.onchange = () => { state[f.key] = sel.value; markOrigin(sel, state[f.key], here); check(); };
    markOrigin(sel, state[f.key], here);
    wrap.appendChild(sel);
    return wrap;
  }

  if (f.type === "number") {
    const inp = el("input", { type: "number", value: state[f.key] ?? 0 });
    inp.oninput = () => { state[f.key] = Number(inp.value || 0); markOrigin(inp, state[f.key], here); check(); };
    pickAll(inp);
    markOrigin(inp, state[f.key], here);
    wrap.appendChild(inp);
    return wrap;
  }

  // string / asset:*
  const inp = el("input", { type: "text", value: state[f.key] ?? "" });
  if (String(f.type).startsWith("asset:")) {
    const kind = String(f.type).slice(6);
    inp.placeholder = KIND_LABEL[kind] + " alias";
    // 후보는 누를 때마다 셈합니다 — 리소스 쪽에서 방금 지은 alias 가 바로
    // 보여야 합니다. 원본을 떠 와 칸이 차 있어도 전부 뜹니다.
    attachPick(inp, () => aliasesOf(kind));
  }
  inp.oninput = () => { state[f.key] = inp.value.trim(); markOrigin(inp, state[f.key], here); check(); };
  markOrigin(inp, state[f.key], here);
  wrap.appendChild(inp);
  return wrap;
}

// 값이 원본 그대로면 칸을 흐리게 둡니다. **지우지는 않습니다** — 원본 값이
// 그대로 맞는 자리도 많습니다(배경·효과음). 「아직 안 본 자리」 표시입니다.
//
// 세는 것은 여기서 하지 않습니다 — countOrigin 이 값만 훑어 따로 셉니다.
function markOrigin(inp, value, path) {
  if (!S.origin || !path) return;
  const o = originAt(path);
  if (o === undefined) return;
  const same = sameAsOrigin(value, o);
  inp.classList.toggle("fromorigin", same);
  inp.title = same ? `${S.origin.code} 값 그대로입니다.` : `원본은 ${JSON.stringify(o)} 였습니다.`;
}

function renderObject(f, state, path) {
  const fs_ = el("fieldset");
  fs_.dataset.path = sub(path, f.key);
  fs_.appendChild(el("legend", {}, f.key));
  if (f.desc) fs_.appendChild(el("div", { class: "desc" }, f.desc));
  state[f.key] = state[f.key] || {};
  const inner = state[f.key];

  if (f.figma) renderXYObject(f, inner, fs_);
  else renderFields(f.fields, inner, fs_, sub(path, f.key));
  if (f.series) renderSeries(f, inner, fs_, sub(path, f.key));

  if (f.variants) {
    const v = f.variants;
    const disc = v.cases[0].name;              // 판정 키 (= 첫 케이스 이름)
    const activeIdx = (disc in inner) ? 0 : 1;
    const pick = el("div", { class: "field" });
    pick.appendChild(el("label", {}, "방식"));
    if (v.note) pick.appendChild(el("div", { class: "desc" }, v.note));
    // 라디오는 name 이 같아야 서로 배타적이 됩니다. 그룹마다 하나씩 만듭니다.
    const group = "v_" + f.key + "_" + (groupSeq++);
    const line = el("div", { class: "inline" });
    v.cases.forEach((kase, i) => {
      const lab = el("label", { class: "chip" });
      const r = el("input", { type: "radio", name: group });
      r.checked = i === activeIdx;
      r.onchange = () => {
        for (const other of v.cases) for (const ff of other.fields || []) delPath(inner, ff.key);
        Object.assign(inner, seedVariant(v, kase));
        renderGameData(); check();
      };
      lab.appendChild(r);
      lab.appendChild(el("span", {}, kase.name + " — " + kase.when));
      line.appendChild(lab);
    });
    pick.appendChild(line);
    fs_.appendChild(pick);

    for (const ff of v.cases[activeIdx].fields || []) {
      fs_.appendChild(renderDotted(ff, inner, sub(path, f.key)));
    }
  }
  return fs_;
}

// 번호로 늘어나는 열쇠(c1 · c2 · …).
//
// **몇 개인지는 스펙이 아니라 값이 정합니다.** 전에는 스펙에 c1~c8 을 손으로
// 적어 두어서, 낱말이 열둘 온 회차(8호 ENL1M07W2S2)에서 c9 부터는 더할 수가
// 없었습니다. 올 때마다 스펙을 늘리는 것은 끝이 없습니다.
//
// 배열처럼 **접거나 차례를 바꾸지는 못하게** 했습니다 — 이닝이
// `answerCardIndex: 'c3'` 으로 **이름을 가리키기 때문**입니다. 차례를 바꾸면
// 이름이 따라 바뀌어 가리키던 카드가 어긋납니다. 늘리고 줄이는 것만 둡니다.
function renderSeries(f, inner, fs_, path) {
  const s = f.series;
  const re = new RegExp("^" + s.prefix + "(\\d+)$");
  const numOf = (k) => Number(re.exec(k)[1]);
  const keys = Object.keys(inner).filter((k) => re.test(k)).sort((a, b) => numOf(a) - numOf(b));
  const label = s.label || f.key;

  for (const k of keys) {
    const box = el("div", { class: "item" });
    if (at) box.dataset.path = at + "." + count;
    const head = el("div", { class: "head" });
    head.appendChild(el("span", { class: "fold" }, `${k} — ${label} ${numOf(k)}`));
    // 최소 개수까지는 지우지 못하게 둡니다. 아래로 내려가면 모듈이 없는 칸을
    // 읽습니다.
    if (keys.length > (s.min || 0)) {
      const del = el("button", { class: "tiny" }, "삭제");
      del.onclick = () => { delete inner[k]; renderGameData(); check(); };
      head.appendChild(del);
    }
    box.appendChild(head);
    if (s.of.type === "object") {
      inner[k] = inner[k] || {};
      renderFields(s.of.fields, inner[k], box, sub(path, k));
    } else {
      box.appendChild(renderField({ ...s.of, key: k }, inner, path));
    }
    fs_.appendChild(box);
  }

  const add = el("button", { class: "tiny" }, "+ " + label + " 추가");
  add.onclick = () => {
    // **뒤에 붙입니다** — 중간의 빈 번호를 메우지 않습니다. 가운데를 지운 것은
    // 뜻이 있어 지운 것이고, 이닝이 이름으로 가리키므로 조용히 되살리면 엉뚱한
    // 카드가 그 자리에 붙습니다.
    const next = keys.length ? numOf(keys[keys.length - 1]) + 1 : 1;
    inner[s.prefix + next] = seedValue(s.of);
    renderGameData(); check();
  };
  fs_.appendChild(add);
}

// ani.idle 처럼 점이 든 키.
function renderDotted(f, state, path) {
  if (!f.key.includes(".")) return renderField(f, state, path);
  const [head, ...rest] = f.key.split(".");
  state[head] = state[head] || {};
  return renderField({ ...f, key: rest.join(".") }, state[head], sub(path, head));
}

function renderArray(f, state, path) {
  const fs_ = el("fieldset");
  state[f.key] = Array.isArray(state[f.key]) ? state[f.key] : [];
  const list = state[f.key];
  const at = sub(path, f.key);
  fs_.dataset.path = at;
  const lg = el("legend");
  lg.innerHTML = esc(f.key) + (list.length ? ` <span class="n">${list.length}</span>` : "");
  fs_.appendChild(lg);

  // **처음 열 때 네 칸 넘으면 첫 칸만 펴 둡니다.** 이닝이 열 칸씩 되는 모듈에서
  // 전부 펼쳐 두면 아무것도 안 보입니다. 한 번만 합니다 — 그 뒤로는 사람이 접은
  // 대로 둡니다(안 그러면 펼쳐 놓은 것이 다시 그릴 때마다 접힙니다).
  if (list.length >= 4 && !S.foldSeen.has(at)) {
    S.foldSeen.add(at);
    for (let i = 1; i < list.length; i++) S.folded.add(at + "[" + i + "]");
  }

  if (list.length >= 2) {
    const allFolded = list.every((_, i) => S.folded.has(at + "[" + i + "]"));
    const t = el("button", { class: "tiny foldall" }, allFolded ? "전부 펴기" : "전부 접기");
    t.onclick = (e) => {
      e.preventDefault();
      list.forEach((_, i) => {
        if (allFolded) S.folded.delete(at + "[" + i + "]");
        else S.folded.add(at + "[" + i + "]");
      });
      renderGameData();
    };
    lg.appendChild(t);
  }
  if (f.desc) fs_.appendChild(el("div", { class: "desc" }, f.desc));

  // 칸 수가 정해진 배열(스펙의 fixed). 모듈이 정해진 자리를 이름 대신 번호로
  // 읽는 것들입니다 — 넣고 빼게 두면 없는 자리를 읽고 터집니다.
  if (f.fixed) {
    const n = f.minLength || list.length;
    while (list.length < n) list.push(f.of ? seedValue(f.of) : "");
    list.length = n;
  }

  list.forEach((item, i) => {
    const here = at + "[" + i + "]";
    const off = S.folded.has(here);
    const box = el("div", { class: off ? "item folded" : "item" });
    box.dataset.path = here;

    // 이름 쪽 전체가 접고 펴는 자리입니다 — 작은 삼각형만 노리게 하면 성가십니다.
    const head = el("div", { class: "head" });
    const grip = el("span", { class: "fold", title: off ? "펴기" : "접기" });
    grip.appendChild(el("span", { class: "caret" }, off ? "▶" : "▼"));
    grip.appendChild(el("span", {}, (f.itemLabels && f.itemLabels[i]) || `${f.key} ${i + 1}`));
    // 접힌 채로도 무엇이 든 칸인지는 보여야 합니다.
    if (off) {
      const t = itemSummary(item, 0);
      if (t) grip.appendChild(el("span", { class: "sum" }, t.length > 30 ? t.slice(0, 30) + "…" : t));
    }
    // 이 칸이 통째로 원본과 같으면 한 번에 말해 줍니다 — 복제만 해 놓고
    // 손 안 댄 이닝이 여기서 걸립니다.
    if (sameAsOrigin(item, originAt(here))) {
      grip.appendChild(el("span", { class: "sameb" }, "원본 그대로"));
    }
    grip.appendChild(el("span", { class: "errb" }, ""));
    grip.onclick = () => {
      if (off) S.folded.delete(here); else S.folded.add(here);
      renderGameData();
    };
    head.appendChild(grip);

    // 칸 수가 정해진 배열에는 넣고 빼는 단추를 아예 두지 않습니다.
    if (!f.fixed) {
      const btns = el("span");
      if (i > 0) {
        const up = el("button", { class: "tiny" }, "↑");
        up.onclick = () => {
          list.splice(i - 1, 0, list.splice(i, 1)[0]);
          swapFolds(at, i - 1, i); renderGameData(); check();
        };
        btns.appendChild(up);
      }
      const copy = el("button", { class: "tiny" }, "복제");
      copy.onclick = () => {
        list.splice(i + 1, 0, JSON.parse(JSON.stringify(item)));
        shiftFolds(at, i + 1, 1); renderGameData(); check();
      };
      btns.appendChild(copy);
      const del = el("button", { class: "tiny" }, "삭제");
      del.onclick = () => {
        list.splice(i, 1);
        shiftFolds(at, i, -1); renderGameData(); check();
      };
      btns.appendChild(del);
      head.appendChild(btns);
    }
    box.appendChild(head);

    // 접힌 칸은 속을 아예 안 만듭니다. 숨기기만 하면 이닝 스무 칸짜리에서
    // 입력칸 수백 개를 그대로 들고 있게 됩니다.
    if (!off) {
      if (f.of && f.of.type === "object" && f.of.figma) renderXYObject(f.of, item, box);
      else if (f.of && f.of.type === "object") renderFields(f.of.fields, item, box, here);
      else box.appendChild(renderField({ ...(f.of || { type: "string" }), key: String(i) }, list, at));
    }
    fs_.appendChild(box);
  });

  if (!f.fixed) {
    const add = el("button", { class: "tiny" }, "+ " + f.key + " 추가");
    add.onclick = () => {
      // 앞의 것을 복제합니다 — 이닝은 대개 앞과 거의 같아서 그편이 빠릅니다.
      const base = list.length ? JSON.parse(JSON.stringify(list[list.length - 1]))
                               : (f.of ? seedValue(f.of) : "");
      list.push(base);
      renderGameData(); check();
    };
    fs_.appendChild(add);
  }
  return fs_;
}

function renderPosTable(f, state, at) {
  const fs_ = el("fieldset");
  if (at) fs_.dataset.path = at;
  fs_.appendChild(el("legend", {}, f.key));
  if (f.desc) fs_.appendChild(el("div", { class: "desc" }, f.desc));
  state[f.key] = state[f.key] || {};
  const table = state[f.key];

  for (const count of Object.keys(table).sort()) {
    const box = el("div", { class: "item" });
    const head = el("div", { class: "head" });
    head.appendChild(el("span", {}, `${f.keyedBy || "개수"} ${count}`));
    const del = el("button", { class: "tiny" }, "삭제");
    del.onclick = () => { delete table[count]; renderGameData(); check(); };
    head.appendChild(del);
    box.appendChild(head);
    const arr = table[count];
    arr.forEach((_, i) =>
      box.appendChild(renderPoint(`${i + 1}번`, null, arr, i, at ? at + "." + count + "[" + i + "]" : null)));
    fs_.appendChild(box);
  }

  const add = el("button", { class: "tiny" }, "+ 개수 추가");
  add.onclick = () => {
    const n = prompt("선지 몇 개짜리 자리인가요? (숫자)");
    const k = String(parseInt(n, 10));
    if (!k || k === "NaN" || table[k]) return;
    table[k] = Array.from({ length: Number(k) }, () => ({ x: 0, y: 0 }));
    renderGameData(); check();
  };
  fs_.appendChild(add);
  return fs_;
}

// 좌표 칸. figma 값으로 적으면 서버가 계산합니다.
function renderPoint(label, desc, state, key, at) {
  const wrap = el("div", { class: "field" });
  if (at) wrap.dataset.path = at;
  wrap.appendChild(el("label", {}, label));
  if (desc) wrap.appendChild(el("div", { class: "desc" }, desc));
  let v = state[key];
  if (!v || typeof v !== "object") v = state[key] = { x: 0, y: 0 };
  // 좌표만 든 칸이라 통째로 갈아 끼웁니다.
  wrap.appendChild(pointLine(v, (wasFigma) => {
    state[key] = wasFigma ? { x: 0, y: 0 } : { fx: 0, fy: 0, w: 0, h: 0 };
  }));
  return wrap;
}

// 좌표를 직접 들고 있는 객체를 받아 한 줄로 그립니다.
// 좌표만 든 칸(point)과 다른 값도 함께 든 칸(quizItemPos 의 scale)이 둘 다
// 이 줄을 씁니다 — 다른 것은 「입력 방식을 바꿀 때 무엇을 갈아 끼우나」뿐이라
// 그 부분만 swap 으로 받습니다.
function pointLine(v, swap, baseSpec) {
  const isFigma = "fx" in v;
  const line = el("div", { class: "inline" });
  // 단추 글씨는 「지금 무엇으로 적고 있는지」입니다. 누르면 바뀝니다.
  const toggle = el("button", { class: "tiny" }, isFigma ? "입력: figma" : "입력: 캔버스");
  toggle.title = "누르면 입력 방식을 바꿉니다. figma 값으로 적으면 캔버스 좌표를 계산해서 넣습니다.";
  toggle.onclick = () => { swap(isFigma); renderGameData(); check(); };

  let calc = () => {};
  const num = (k) => {
    const i = el("input", { type: "number", value: v[k] ?? 0 });
    i.oninput = () => { v[k] = Number(i.value || 0); calc(); check(); };
    pickAll(i);
    return i;
  };

  const label = baseSpec && baseSpec.label;
  if (isFigma) {
    // figma 오른쪽 패널의 값을 그대로 옮겨 적는 자리입니다.
    // 「x·y」라고만 써 두면 캔버스 좌표로 착각합니다 — 그것과는 다른 값입니다.
    //
    // **차례는 figma 패널과 같게 둡니다** — 왼쪽 · 상단 · 높이 · 너비.
    // 보면서 옮겨 적는 자리라, 차례가 다르면 너비와 높이를 서로 바꿔 적습니다.
    line.append(toggle, tag("왼쪽"), num("fx"), tag("상단"), num("fy"),
      tag("높이"), num("h"), tag("너비"), num("w"));
    const out = el("span", { class: "calc" });
    line.appendChild(out);
    calc = () => {
      const p = toCanvasXY(v);
      const b = baseXY(baseSpec);
      const r = (n) => Math.round((n) * 100) / 100;
      out.textContent = `→ ${label ? label + " 기준 " : ""}x ${r(p.x - b.x)}, y ${r(p.y - b.y)}`;
    };
    calc();
  } else {
    line.append(toggle, tag("x"), num("x"), tag("y"), num("y"));
    if (label) line.appendChild(el("span", { class: "calc" }, `${label} 기준으로 적는 값입니다`));
  }
  return line;
}

// 생성기의 toCanvasPoint 와 같은 셈입니다. 화면이 먼저 보여 주고 생성기가
// 다시 계산하는 구조라, 둘이 어긋나면 「보이는 값과 나오는 값이 다른」
// 제일 나쁜 꼴이 됩니다. 식을 바꿀 때는 반드시 둘을 같이 고칩니다.
function toCanvasXY(v) {
  if ("fx" in v) {
    const ax = v.anchorX ?? 0.5, ay = v.anchorY ?? 0.5;
    return { x: v.fx + v.w * ax - 960, y: v.fy + v.h * ay - 540 };
  }
  return { x: Number(v.x || 0), y: Number(v.y || 0) };
}

// 「무엇에 붙어 다니는 좌표인가」. 스펙의 figmaBase 를 그대로 따릅니다.
function baseXY(baseSpec) {
  if (!baseSpec) return { x: 0, y: 0 };
  let p = { x: 0, y: 0 };
  if (baseSpec.field) {
    const raw = baseSpec.field.split(".").reduce(
      (cur, k) => (cur && typeof cur === "object" ? cur[k] : undefined), S.recipe.gameData);
    if (raw && typeof raw === "object") p = toCanvasXY(raw);
  }
  const o = baseSpec.offset || {};
  return { x: p.x + (o.x || 0), y: p.y + (o.y || 0) };
}

// 좌표를 품고 있지만 다른 값도 든 객체(스펙에 figma: true).
// x·y 는 좌표 줄로 묶고, 나머지만 보통 칸으로 냅니다.
function renderXYObject(f, item, box) {
  if (!("x" in item) && !("fx" in item)) { item.x = 0; item.y = 0; }
  box.appendChild(pointLine(item, (wasFigma) => {
    for (const k of wasFigma ? ["fx", "fy", "w", "h"] : ["x", "y"]) delete item[k];
    Object.assign(item, wasFigma ? { x: 0, y: 0 } : { fx: 0, fy: 0, w: 0, h: 0 });
  }, f.figmaBase));
  renderFields((f.fields || []).filter((g) => g.key !== "x" && g.key !== "y"), item, box);
}

function tag(t) { return el("span", { class: "muted" }, t); }

// ─── 모듈 스펙 만들기 ────────────────────────────────────────────────────
//
// 기계가 표본을 견줘 초안을 냅니다. 여기서 볼 것은 둘입니다.
//   필수 / 선택   기계는 표본에 없으면 무조건 「선택」이라고밖에 못 답합니다
//   제목·설명     비워 두어도 됩니다. 나중에 채웁니다
// 타입은 읽기만 됩니다. M27 로 시험했을 때 38자리를 다 맞혔습니다 —
// 고칠 수 있게 열어 두면 맞은 것을 망칠 여지만 늡니다.
//
// 빈 칸을 재촉하지 않습니다. M05 는 자리가 836개라 설명을 다 물으면
// 화면이 숙제가 됩니다. 비어 있으면 비어 있는 대로 저장합니다.

// 초안은 제목이 비어 있습니다. 「MA · M27 — 」 로 끝나면 고장 난 것처럼 보입니다.
function specLabel(s) {
  return `${s.subject} · ${s.module} — ` + (s.title ? esc(s.title) : "(설명은 나중에)");
}

function setupModes() {
  for (const b of $("modeTabs").querySelectorAll("button")) {
    b.onclick = () => pickMode(b.dataset.mode);
  }
  $("mdList").onchange = () => { $("mdDraft").disabled = !$("mdList").value; };
  $("mdDraft").onclick = doDraft;
  $("specSave").onclick = doSaveSpec;
}

function pickMode(mode) {
  for (const b of $("modeTabs").querySelectorAll("button")) {
    b.classList.toggle("on", b.dataset.mode === mode);
  }
  $("modeActivity").hidden = mode !== "activity";
  $("modeSpec").hidden = mode !== "spec";
  $("actToolbar").hidden = mode !== "activity";
  measureHeader();
  // 목록은 한 번만 읽습니다. 1,200개를 훑는 일이라 누를 때마다 하면 답답합니다.
  if (mode === "spec" && !S.md.rows.length) loadModules();
}

async function loadModules() {
  const rows = await getJson("/api/modules");
  if (!Array.isArray(rows)) {
    $("mdMsg").innerHTML = '<span class="none">모듈 목록을 못 읽었습니다.</span>';
    return;
  }
  S.md.rows = rows;
  const todo = rows.filter((r) => !r.hasSpec).length;
  $("mdList").innerHTML = '<option value="">— 고르세요 —</option>' +
    rows.map((r) => `<option value="${r.subject}/${r.module}">` +
      `${r.hasSpec ? "✔ " : ""}${r.subject} · ${r.module} — 액티비티 ${r.count}개</option>`).join("");
  $("mdMsg").innerHTML = `모듈 ${rows.length}종 · 스펙이 아직 없는 것 <b>${todo}종</b>. ` +
    '<span class="dim2">✔ 표시는 이미 스펙이 있는 것입니다 — 고르면 지금 것을 덮어씁니다.</span>';
}

async function doDraft() {
  const [subject, module] = $("mdList").value.split("/");
  if (!module) return;
  $("mdDraft").disabled = true;
  $("mdMsg").innerHTML = "표본을 읽는 중…";
  const r = await post("/api/draft", { subject, module });
  $("mdDraft").disabled = false;

  if (!r.ok) {
    $("specEdit").hidden = true;
    $("mdMsg").innerHTML = `<span class="none">${esc(r.error || "초안을 못 만들었습니다.")}</span>`;
    return;
  }
  S.md.subject = subject;
  S.md.module = module;
  S.md.spec = r.spec;
  S.md.force = false;
  $("mdMsg").innerHTML = `표본 ${r.samples.length}개를 견줬습니다 — ` +
    `<span class="dim2">${esc(r.samples.slice(0, 6).join(" "))}` +
    (r.samples.length > 6 ? ` 외 ${r.samples.length - 6}개` : "") + "</span>" +
    // 표본이 하나면 견줄 것이 없습니다. 「늘 그렇다」와 「그때 그랬다」가 구별이 안 됩니다.
    (r.samples.length < 3
      ? '<div class="warn">표본이 적습니다 — 무엇이 늘 같고 무엇이 매번 다른지 가릴 수 없어, ' +
        "필수 여부를 특히 눈여겨봐 주세요.</div>"
      : "");
  renderSpec();
}

function renderSpec() {
  const spec = S.md.spec;
  $("specEdit").hidden = false;
  $("specSaveMsg").innerHTML = "";
  $("specSave").textContent = "스펙 저장";

  // 제목과 한 줄 설명. 이 둘이 없으면 다른 사람이 목록에서 무엇인지 알 수 없습니다.
  $("specHead").innerHTML = "";
  $("specHead").append(
    headRow("제목", "이 모듈이 무엇을 하는지 한 줄로", spec.title, (v) => { spec.title = v; }),
    headRow("설명", "학생이 무엇을 하고 무엇이 일어나는지", spec.summary || "", (v) => { spec.summary = v; }),
  );

  const box = $("specFields");
  box.innerHTML = "";
  const head = el("div", { class: "fhead" });
  for (const t of ["자리", "타입", "필수", "설명 — 이 칸이 무엇인지"]) head.append(el("div", {}, t));
  box.append(head);

  const rows = flattenFields(spec.gameData.fields || [], "", 0, []);
  if (!rows.length) {
    box.append(el("div", { class: "muted", style: "padding:12px 0" },
      "적을 자리가 없습니다. GameData 가 비어 있는 모듈입니다."));
  }
  for (const r of rows) box.append(fieldRow(r));
  countSpots();
}

function headRow(label, hint, value, set) {
  const inp = el("input", { type: "text", value: value || "", placeholder: hint });
  inp.oninput = () => { set(inp.value.trim()); countSpots(); };
  const wrap = el("div", { class: "field" });
  wrap.append(el("label", {}, label), inp);
  return wrap;
}

// 자리 하나가 한 줄입니다. 배열 속은 `[]` 를 붙여 한 단 들어갑니다.
function flattenFields(fields, prefix, depth, out) {
  for (const f of fields) {
    const path = prefix ? prefix + "." + f.key : f.key;
    out.push({ f, path, depth });
    if (f.fields) flattenFields(f.fields, path, depth + 1, out);
    if (f.of && f.of.fields) flattenFields(f.of.fields, path + "[]", depth + 1, out);
  }
  return out;
}

function fieldRow({ f, path, depth }) {
  const row = el("div", { class: "frow" });

  const p = el("div", { class: "p", style: `padding-left:${depth * 14}px`, title: path });
  const cut = path.lastIndexOf(f.key);
  p.append(el("span", { class: "up" }, path.slice(0, cut)), el("span", { class: "own" }, f.key));
  row.append(p, el("div", { class: "t", title: f.type }, f.type));

  // 필수인지 아닌지만은 사람이 봐야 압니다. 기계는 표본에 없었다는 것밖에 모릅니다.
  const chip = el("label", { class: "chip req", title: "표본 전부에 있으면 기계가 미리 켜 둡니다" });
  const cb = el("input", { type: "checkbox" });
  cb.checked = f.required === true;
  cb.onchange = () => {
    if (cb.checked) { f.required = true; delete f.optional; }
    else { f.optional = true; delete f.required; }
  };
  chip.append(cb, el("span", {}, "필수"));
  row.append(chip);

  const right = el("div", {});
  right.append(descInput(f, "desc", "비워 두어도 됩니다"));
  // 배열이면 왜 그만큼 있어야 하는지, 좌표표면 무엇으로 고르는 표인지.
  if (f.type === "array") right.append(descInput(f, "minLengthWhy", `왜 최소 ${f.minLength}칸인지`));
  if (f.type === "posTable") right.append(descInput(f, "keyedBy", "무엇의 개수로 고르는 표인지"));
  row.append(right);
  return row;
}

// 비우면 그 칸을 아예 지웁니다. 빈 글자를 남겨 두면 「적었는데 비어 있는 것」과
// 「아직 안 적은 것」이 구별되지 않습니다.
function descInput(f, key, hint) {
  const inp = el("input", { type: "text", placeholder: hint, value: f[key] || "" });
  inp.oninput = () => {
    const v = inp.value.trim();
    if (v) f[key] = v; else delete f[key];
    countSpots();
  };
  if (key !== "desc") inp.style.marginTop = "4px";
  return inp;
}

// 재촉이 아니라 알림입니다. 설명이 없는 자리는 나중에 채웁니다.
function countSpots() {
  const rows = flattenFields(S.md.spec.gameData.fields || [], "", 0, []);
  const named = rows.filter((r) => r.f.desc).length;
  $("specTodo").innerHTML =
    `<span class="dim2">자리 ${rows.length}개 · 설명 적힌 자리 ${named}개</span>`;
}

async function doSaveSpec() {
  const { subject, module, spec, force } = S.md;
  const msg = $("specSaveMsg");
  const r = await post("/api/spec", { subject, module, spec, force });

  if (r.exists) {
    // 손으로 다듬어 둔 것을 한 번에 날리지 않게 한 번 물어봅니다.
    S.md.force = true;
    $("specSave").textContent = "덮어쓰기 — 한 번 더 누르세요";
    msg.innerHTML = `<span class="warn">이미 있습니다: <code>${esc(r.file)}</code></span>`;
    return;
  }
  if (!r.ok) {
    msg.innerHTML = `<span class="none">${esc(r.error || "저장하지 못했습니다.")}</span>`;
    return;
  }
  S.md.force = false;
  $("specSave").textContent = "스펙 저장";
  msg.innerHTML = `<span class="ok">${r.existed ? "덮어썼습니다" : "저장했습니다"} — ` +
    `<code>${esc(r.file)}</code></span>` +
    '<div class="muted">제목과 자리별 설명은 나중에 채웁니다.</div>';

  // 방금 만든 스펙이 액티비티 쪽 모듈 목록에도 바로 보이게 합니다.
  await refreshSpecList();
  await loadModules();
}

async function refreshSpecList() {
  const specs = await getJson("/api/specs");
  if (!Array.isArray(specs)) return;
  S.specs = specs;
  const sel = $("module");
  const was = sel.value;
  sel.innerHTML = '<option value="">— 고르세요 —</option>' +
    specs.map((s) => `<option value="${s.subject}/${s.module}">${specLabel(s)}</option>`).join("");
  sel.value = was;
  syncSubject();
}

// ─── 서버에 묻는 자리 ────────────────────────────────────────────────
//
// **이 화면은 두 곳에서 돕니다** (2026-09-11).
//
//   브라우저 — `yarn forge ui` 의 HTTP 서버로 fetch 합니다. 지금까지의 길입니다.
//   앱      — 스파크온 매니지먼트 안에서는 서버가 없습니다. preload 가 넘겨준
//             `window.api.forge` 로 IPC 를 부릅니다.
//
// **아래 두 함수만 그 차이를 압니다.** 나머지 2300줄은 어디서 도는지 모르고,
// 그래서 화면을 한 벌로 둘 수 있습니다 — 두 벌이 되면 한쪽만 고치는 날이 옵니다.
//
// 서버가 사라지면(`_document/방향.md` 판단 2) fetch 쪽만 지우면 됩니다.

const IPC = (typeof window !== "undefined" && window.api && window.api.forge) || null;

// 주소 → IPC 함수. **앱에 열려 있는 것의 전부가 이 표입니다.**
// 모르는 주소는 조용히 넘기지 않고 그렇다고 말합니다.
function viaIpc(method, path, data) {
  const at = path.split("?")[0];
  const q = new URL(path, "http://x").searchParams;
  const d = data || {};
  if (method === "GET") {
    switch (at) {
      case "/api/version": return IPC.version();
      case "/api/specs":   return IPC.specs();
      case "/api/spec":    return IPC.spec(q.get("subject"), q.get("module"));
      case "/api/modules": return IPC.modules();
      case "/api/user":    return IPC.user();
      case "/api/files":   return IPC.files(q.get("code"));
      case "/api/layout":  return IPC.layout(q.get("code"));
      case "/api/clone":   return IPC.clone(q.get("from"), q.get("to") || undefined);
    }
  } else {
    switch (at) {
      case "/api/draft":    return IPC.draft(d.subject, d.module);
      case "/api/spec":     return IPC.writeSpec(d.subject, d.module, d.spec, d.force === true);
      case "/api/user":     return IPC.setUser(d);
      case "/api/open":     return IPC.openRef(d.code);
      case "/api/rsc":      return IPC.resourceDir(d.code);
      case "/api/check":    return IPC.check(d);
      case "/api/generate": return IPC.generate(d.recipe, d.force === true, d.save !== false);
    }
  }
  return Promise.resolve({ ok: false, error: `앱이 아직 모르는 주소입니다 — ${method} ${at}` });
}

async function getJson(path) {
  if (IPC) return viaIpc("GET", path);
  try {
    const r = await fetch(path);
    return await r.json();
  } catch {
    return { ok: false, error: "서버에 닿지 않습니다 — yarn forge ui 가 떠 있는지 보세요." };
  }
}

// 서버가 JSON 이 아닌 것을 주면(없는 주소·죽은 서버) 조용히 사라지지 않게
// 에러 꼴로 바꿔 돌려줍니다. 「눌러도 아무 일이 없다」가 제일 나쁩니다.
async function post(path, data) {
  if (IPC) return viaIpc("POST", path, data);
  try {
    const r = await fetch(path, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      return { ok: false, error: `서버가 ${r.status} 을 냈습니다 — ${text.slice(0, 80)}` +
        (r.status === 404 ? " (서버를 다시 띄워 주세요)" : "") };
    }
  } catch (e) {
    return { ok: false, error: "서버에 닿지 않습니다 — yarn forge ui 가 떠 있는지 보세요." };
  }
}

function aliasesOf(kind) {
  const out = [];
  const provided = (S.spec && S.spec.assets.providedByModule) || {};
  for (const a of provided[kind] || []) out.push(a);
  for (const a of (S.recipe.assets[kind] || [])) if (a.alias) out.push(a.alias);
  return [...new Set(out)];
}

// ─── 임시 저장 ───────────────────────────────────────────────────────────
// 적던 것이 새로고침 한 번에 날아가면 안 됩니다. 값이 바뀔 때마다 브라우저에
// 통째로 적어 두고, 다음에 열 때 되살립니다. 레시피 파일로 남는 것은
// 「생성」을 눌렀을 때뿐이라, 그 전까지는 여기가 유일한 보관처입니다.
const DRAFT_KEY = "sparkon.ui.draft";

function saveDraft() {
  if (!S.spec) return; // 모듈도 안 고른 빈 상태는 적어 둘 것이 없습니다.
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      at: Date.now(),
      // 화면(select)이 아니라 스펙에서 가져옵니다. 화면은 아직 안 그려졌을 수도 있고,
      // 그러면 「저장은 됐는데 되살릴 수 없는」 것이 남습니다.
      module: `${S.spec.subject}/${S.spec.module}`,
      recipe: S.recipe,
    }));
  } catch {
    // 저장 공간이 막혔거나 꽉 찼습니다. 적던 것은 화면에 그대로 있으니
    // 여기서 멈추지는 않습니다.
  }
}

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const d = raw ? JSON.parse(raw) : null;
    return d && d.module && d.recipe ? d : null;
  } catch { return null; }
}

function dropDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* 없으면 없는 대로 */ }
}

async function restoreDraft() {
  const d = readDraft();
  if (!d) return false;
  const [subject, module] = d.module.split("/");
  S.spec = await getJson(`/api/spec?subject=${subject}&module=${module}`);
  if (!S.spec || !S.spec.module) return false;
  S.recipe = d.recipe;
  S.folded.clear(); S.foldSeen.clear();
  // 개발자 이름은 이 PC 의 설정이 정본입니다. 적어 둔 것으로 되돌리면 안 됩니다.
  // 「개발 완료」는 적어 둔 것이 이깁니다 — 꺼 두고 나갔으면 꺼진 채로 돌아와야
  // 합니다. 그 키가 아예 없는 옛날 것만 켬으로 시작합니다.
  S.recipe.info = Object.assign({ devTeam: "my-team", devFinished: true }, S.recipe.info,
    { developer: $("developer").value.trim() });
  $("module").value = d.module;
  $("code").value = S.recipe.code || "";
  $("devFinished").checked = !!S.recipe.info.devFinished;
  syncSubject();
  showDraftBar(d.at);
  await scanRsc();
  render();
  return true;
}

function showDraftBar(at) {
  const bar = $("draftBar");
  bar.hidden = false;
  bar.innerHTML = `<span>적던 것을 이어서 불러왔습니다 <span class="dim2">— ${esc(ago(at))}</span></span> `;
  const b = el("button", { class: "tiny" }, "버리고 새로 시작");
  b.onclick = () => { dropDraft(); location.reload(); };
  bar.appendChild(b);
}

function ago(at) {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.round(s / 60)}분 전`;
  if (s < 86400) return `${Math.round(s / 3600)}시간 전`;
  return `${Math.round(s / 86400)}일 전`;
}


// ─── 검증 ────────────────────────────────────────────────────────────────

let timer = null;
function check() {
  // 값이 바뀌면 임시 저장도 함께 따라갑니다. 여기 한 자리에 모아 두면
  // 「어디선가 부르는 것을 빠뜨려서」 생기는 어긋남이 없습니다.
  // (후보 목록은 이제 누를 때마다 셈하므로 미리 채워 둘 것이 없습니다.)
  saveDraft();
  clearTimeout(timer);
  timer = setTimeout(doCheck, 250);
}

async function doCheck() {
  if (!S.spec || !S.recipe.code) {
    $("issues").innerHTML = '<span class="muted">학습코드와 모듈을 고르면 검사합니다.</span>';
    $("issueCount").innerHTML = "";
    $("target").hidden = true;
    $("gen").disabled = true;
    return;
  }
  const r = await post("/api/check", S.recipe);

  if (r.error) {
    $("issues").innerHTML = `<div class="issue error">${esc(r.error)}</div>`;
    $("issueCount").innerHTML = '<span class="badge error">멈춤</span>';
    $("gen").disabled = true;
    return;
  }
  S.issues = r.issues || [];
  paintIssueBadges();
  const errs = (r.issues || []).filter((i) => i.level === "error");
  const warns = (r.issues || []).filter((i) => i.level === "warn");

  // 몇 개가 남았는지 제목 옆에 붙입니다. 목록을 세지 않아도 됩니다.
  const badges = [];
  if (errs.length) badges.push(`<span class="badge error">에러 ${errs.length}</span>`);
  if (warns.length) badges.push(`<span class="badge warn">경고 ${warns.length}</span>`);
  if (!badges.length) badges.push('<span class="badge ok">깨끗</span>');
  $("issueCount").innerHTML = badges.join(" ");

  const html = [];
  if (!errs.length) html.push('<div class="ok">에러 없음 — 생성할 수 있습니다.</div>');
  for (const i of [...errs, ...warns]) {
    // 탭으로 갈라 두면 다른 탭의 에러는 눈에 안 띕니다. 눌러서 그리로 갑니다.
    html.push(`<div class="issue ${i.level} jump" data-path="${esc(i.path)}" title="눌러서 그 자리로">
      <div class="path">${esc(i.path)} · ${esc(i.rule)}</div>
      <div>${esc(i.message)}</div>
      ${i.why ? `<div class="why">${esc(i.why)}</div>` : ""}
    </div>`);
  }
  $("issues").innerHTML = html.join("");
  for (const d of $("issues").querySelectorAll(".jump")) {
    d.onclick = () => {
      const ok = jumpTo(d.dataset.path, d.classList.contains("warn") ? "warn" : "error");
      for (const o of $("issues").querySelectorAll(".issue.on")) o.classList.remove("on");
      d.classList.add("on");
      // **못 찾았으면 그렇다고 말합니다.** 눌렀는데 아무 일도 안 일어나면
      // 화면이 고장 난 것으로 보입니다. 실제로는 그 칸이 아직 없는 것입니다
      // (안 쓰는 칸을 꺼 두었거나, 리소스 줄을 아직 안 만들었거나).
      let note = d.querySelector(".lost");
      if (ok) { if (note) note.remove(); return; }
      if (!note) {
        note = el("div", { class: "why lost" });
        d.appendChild(note);
      }
      note.textContent = "화면에서 그 칸을 못 찾았습니다 — 아직 안 만든 칸이거나 꺼 둔 칸입니다.";
    };
  }
  showTarget(r.files);
  $("gen").disabled = errs.length > 0;

  S.preview = r.preview || null;
  renderPreview();
}

function renderPreview() {
  const tabs = $("tabs");
  if (!S.preview) { tabs.innerHTML = ""; $("preview").textContent = "아직 없습니다."; return; }
  const names = Object.keys(S.preview);
  if (!S.tab || !names.includes(S.tab)) S.tab = names[0];
  tabs.innerHTML = "";
  for (const n of names) {
    const b = el("button", {}, n);
    b.setAttribute("aria-selected", String(n === S.tab));
    b.onclick = () => { S.tab = n; renderPreview(); };
    tabs.appendChild(b);
  }
  $("preview").textContent = S.preview[S.tab];
}

async function doGenerate() {
  $("gen").disabled = true;
  const r = await post("/api/generate", { recipe: S.recipe, force: $("force").checked });

  const box = $("genResult");
  if (r.error) { box.innerHTML = `<div class="issue error">${esc(r.error)}</div>`; }
  else if (r.ok) {
    box.innerHTML = `<div class="ok">파일 ${r.files.length}개를 만들었습니다.</div>` +
      `<div class="muted" style="font-size:12px;margin-top:6px">${r.files.map((f) => esc(f.path)).join("<br>")}</div>` +
      `<div class="muted" style="font-size:12px;margin-top:6px">레시피도 sparkon_forge/_recipe/${esc(S.recipe.code)}.json 에 저장했습니다.</div>`;
  } else {
    box.innerHTML = '<div class="issue error">에러가 있어 쓰지 않았습니다.</div>';
  }
  doCheck();
}

// ─── 잡동사니 ────────────────────────────────────────────────────────────

function el(tag, attrs, text) {
  const n = document.createElement(tag);
  for (const k in (attrs || {})) {
    if (k === "value") n.value = attrs[k];
    else if (k === "checked") n.checked = attrs[k];
    else n.setAttribute(k, attrs[k]);
  }
  if (text !== undefined) n.textContent = text;
  return n;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]] = cur[parts[i]] || {};
  cur[parts[parts.length - 1]] = value;
}
function delPath(obj, dotted) {
  const top = dotted.split(".")[0];
  delete obj[top];
}

boot();
