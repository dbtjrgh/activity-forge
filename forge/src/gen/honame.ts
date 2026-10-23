// M 번호 → 호 이름 · 호 차례 (2026-10-23). 명령줄 머리 줄(`layoutprint.ts` · `layoutwhy.ts`)과 원본 고르기(`layoutorigin.ts`)가 같이 씁니다.
//
// **셈으로 짓지 않고 표로 둡니다** — 1~5호는 M01~M05, **6호는 방학호 M11**, 7~11호는 M06~M10, 12호는 겨울 방학호 M12 입니다.
// 전에는 세 자리가 `Number(target) + 1` 로 불러 `layout NU 01` 이 「2호(M01)」, M11 이 「12호」였고,
// 원본 고르기의 따로 적은 셈은 M12 를 「13호」로 불렀습니다(저장소 함정 「M 번호에 1 을 더한다고 호가 되지 않는다」).
//
// **앱 쪽 표 `electron_app/src/shared/forge/boardlist.ts` 의 `HO_OF` 와 같아야 합니다.** forge 는 앱을 import 하지 않아 한 벌 더 적었습니다 —
// 한쪽에 호를 더하면 다른 쪽도 같이 고칩니다. 표에 없는 M 은 앱과 같이 이름을 짓지 않고(`M13`) 차례는 맨 뒤(100 + M 번호)입니다.
// 브라우저 화면(`ui/board.html` · `ui/screen.js`)은 이 파일을 못 불러 아직 `+ 1` 입니다.

const HO: Record<string, { name: string; order: number }> = {
  "01": { name: "1호", order: 1 },
  "02": { name: "2호", order: 2 },
  "03": { name: "3호", order: 3 },
  "04": { name: "4호", order: 4 },
  "05": { name: "5호", order: 5 },
  "11": { name: "6호(방학)", order: 6 },
  "06": { name: "7호", order: 7 },
  "07": { name: "8호", order: 8 },
  "08": { name: "9호", order: 9 },
  "09": { name: "10호", order: 10 },
  "10": { name: "11호", order: 11 },
  "12": { name: "12호(방학)", order: 12 },
};

const key = (m: string): string => m.padStart(2, "0");

/** 호 이름 — 「9호」 · 「6호(방학)」. 표에 없는 M 은 `M13` */
export function hoName(m: string): string {
  return HO[key(m)]?.name ?? `M${key(m)}`;
}

/** 머리 줄에 쓰는 이름 — 「9호(M08)」 · 「6호(방학)(M11)」(앱 `hoLabel` 과 같은 꼴). 표에 없는 M 은 `M13` 하나 */
export function hoLabel(m: string): string {
  const ho = HO[key(m)];
  return ho ? `${ho.name}(M${key(m)})` : `M${key(m)}`;
}

/** 호 차례 — M11 은 6호라 5호(M05)와 7호(M06) 사이입니다 */
export function hoOf(m: string): number {
  return HO[key(m)]?.order ?? 100 + Number(m);
}
