// 터미널 색. **chalk 를 안 씁니다.**
//
// 이 코드는 `sparkon_cli` 에서 옮겨 왔고 거기서는 chalk 를 썼습니다. 그런데
// chalk 5 는 ESM 전용이라 이 서버(commonjs · ts-node)에서는 안 불립니다.
// chalk 4 를 따로 받을 수도 있지만, **로컬에서 명령 한 줄 돌리자고 공용
// package.json 에 의존성을 더할 값은 아닙니다.** 쓰는 색이 여섯 개뿐입니다.
//
// 색을 끄는 자리도 chalk 와 맞췄습니다 — 파이프로 넘기거나 `NO_COLOR` 가
// 있으면 글자만 냅니다. 검사 결과를 파일로 받아 볼 때 제어문자가 섞이면
// 사람이 읽기 어렵습니다.

const on = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

function wrap(code: number): (s: string) => string {
  const esc = String.fromCharCode(27) + "["; // ESC. 소스에 제어문자를 그대로 두면 편집기가 지웁니다
  return (s: string) => (on ? `${esc}${code}m${s}${esc}0m` : s);
}

export const chalk = {
  red: wrap(31),
  green: wrap(32),
  yellow: wrap(33),
  cyan: wrap(36),
  gray: wrap(90),
  bold: wrap(1),
};
