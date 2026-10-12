// 훅 줄에서 직접 부르는 이름 · 클래스 멤버.
//
// `draft.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `draft.ts` 에서 가져다 씁니다.


// `async onLoad() { … }` 의 중괄호 안쪽만. 짝을 세어 끝을 찾습니다.
// 훅 줄에서 「직접 부르는 이름」만 골라 냅니다.
//
// 주석과 따옴표 안은 글자라 지웁니다. 앞에 `.` 이 붙은 것(`M28.OnResize()`)은
// 남의 것을 부르는 자리라 들여올 이름이 아닙니다.
export function symbolsUsed(lines: string[]): Set<string> {
  const out = new Set<string>();
  for (const line of lines) {
    const bare = line.replace(/\/\/.*$/, "").replace(QUOTED, "''");
    for (const m of bare.matchAll(
      /(^|[^.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\s*[.(]/g,
    )) {
      if (m[2]) out.add(m[2]);
    }
  }
  return out;
}

// 따옴표 안은 글자입니다. 안을 비워 두고 봅니다.
const QUOTED = /"[^"]*"|'[^']*'|`[^`]*`/g;

// 클래스 맨 위의 멤버 선언을 베낍니다.
//
//   private mM05: M05 = new M05();
//   public mCom_Content: Com_Content = new Com_Content();
//   private inningManager!: InningManager;
//
// **첫 메서드에서 멈춥니다.** 멤버는 늘 위에 모여 있고, 아래까지 훑으면
// 메서드 안의 지역 변수를 멤버로 잘못 셉니다.
//
// **`mStudyCode` 는 뺍니다** — 생성기가 늘 냅니다. 베끼면 두 번 나갑니다.
//
// **세미콜론은 없어도 봅니다.** 호 repo 는 세미콜론을 안 찍는 파일이 섞여
// 있어서(`MAL3M01W3S3` 이 그 꼴), 끝을 `;` 로만 잡으면 M06 처럼 멤버가 통째로
// 안 잡힙니다. 없으면 아래에서 붙여 줍니다.
const MEMBER =
  /^(?:(?:public|private|protected|readonly|static|declare|override)\s+)*[A-Za-z_$][\w$]*\s*[!?]?\s*(?::[^=;]+)?(?:=[^;]*)?;?$/;
const METHOD =
  /^(?:(?:public|private|protected|static|async|override|get|set)\s+)*(?:constructor|[A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/;
const STUDY_CODE =
  /^(?:(?:public|private|protected|readonly|static)\s+)*mStudyCode\b/;

export function classMembers(text: string): string[] {
  const at = /class\s+Activity\s+extends\s+[A-Za-z0-9_]+[^{]*\{/.exec(text);
  if (!at) return [];
  const out: string[] = [];
  for (const raw of text.slice(at.index + at[0].length).split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("//")) continue;
    if (METHOD.test(line)) break;
    if (!MEMBER.test(line) || STUDY_CODE.test(line)) continue;
    out.push(line.endsWith(";") ? line : line + ";");
  }
  return out;
}

// 멤버 줄이 쓰는 이름. **훅과 규칙이 다릅니다** — 훅은 부르는 이름만 있으면
// 되지만, 멤버는 `private mM05: M05` 의 **타입 이름**이 들어와 있어야 합니다.
export function symbolsInMembers(lines: string[]): Set<string> {
  const out = new Set<string>();
  for (const line of lines) {
    const bare = line.replace(QUOTED, "''");
    for (const m of bare.matchAll(/:\s*([A-Za-z_$][\w$]*)/g))
      if (m[1]) out.add(m[1]);
    for (const m of bare.matchAll(/\bnew\s+([A-Za-z_$][\w$]*)/g))
      if (m[1]) out.add(m[1]);
    for (const m of bare.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\./g))
      if (m[2]) out.add(m[2]);
  }
  return out;
}

// `for (const v of AssetTable.image) { AssetManager.addAsset(...) }` 같은
// 리소스 등록 반복문을 통째로 뺍니다. 생성기가 같은 것을 이미 씁니다.
export function dropAssetLoops(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (
      !/^\s*for\s*\(\s*const\s+\w+\s+of\s+.*\b(font|image|sound|lottie)\b/.test(
        line,
      )
    ) {
      out.push(line);
      continue;
    }
    // 여는 줄부터 짝이 맞는 닫는 줄까지 세어 보고, 안이 등록 호출뿐이면 버립니다.
    let depth = 0;
    let end = i;
    const inside: string[] = [];
    for (; end < lines.length; end++) {
      const l = lines[end] ?? "";
      depth += (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length;
      if (end > i) inside.push(l);
      if (depth <= 0 && end > i) break;
    }
    const body = inside.slice(0, -1).join(" ").trim();
    if (
      body !== "" &&
      !/^(AssetManager\.addAsset|AudioManager\.add)\b/.test(body)
    ) {
      out.push(line);
      continue;
    }
    i = end;
  }
  return out;
}

export function hookBody(text: string, name: string): string[] {
  // `)` 와 `{` 사이의 **반환형을 넘겨야 합니다.** 원본은 `onResize(): void {` 로
  // 적습니다 — 517개가 그 꼴이고 `onResize() {` 은 8개뿐입니다. 이걸 안 넘겨서
  // onResize 를 통째로 못 읽고 있었습니다 (2026-09-02).
  const head = new RegExp(
    `(?:async\\s+)?${name}\\s*\\([^)]*\\)\\s*(?::[^{]*)?\\{`,
  ).exec(text);
  if (!head) return [];
  let depth = 1;
  let i = head.index + head[0].length;
  const start = i;
  for (; i < text.length && depth > 0; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") depth--;
  }
  return text
    .slice(start, i - 1)
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() !== "")
    .map((l) => l.replace(/^ {4}/, ""));
}
