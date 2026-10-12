/**
 * **AI 가 준 글을 그대로 남긴다.** 무엇이 왜 안 됐는지 나중에 볼 수 있게.
 *
 * 2026-09-15 에 이것이 없어 애를 먹었다. 리허설에서 열한 차시가 `taken=0 ·
 * refused=0` 으로 나왔는데 — **답을 하나도 못 읽었다**는 뜻이라 까닭이 둘로
 * 갈렸다. ① AI 가 아예 안 썼거나 ② 꼴이 어긋나 못 읽었거나. **원문이 없어
 * 가릴 수가 없었고**, 한 차시를 다시 불러서야 알았다.
 *
 * 실제로 둘 다 있었다 — 어떤 차시는 「맞출 짝이 없습니다」라고 바르게 답했고,
 * 어떤 답은 마크다운 표라 탭만 읽던 파서가 통째로 버렸다. 뒤엣것은 **여섯 줄이
 * 다 맞았는데 한 줄도 못 건진 것**이다. 원문이 남아 있었으면 그날 바로 보였다.
 *
 * **자리는 `_recipe/<코드>.reply.txt` 다.** `_recipe` 는 이미 「만들 때마다 떨어지는
 * 산출물」이 사는 곳이고 `.gitignore` 에 들어 있다 — 남의 저장소에 올라갈 것이
 * 아니다. 답과 메모(`.answer.json`·`.note.json`)가 이미 그 옆에 있다.
 *
 * **덮어쓴다.** 부를 때마다 쌓으면 어느 것이 마지막인지 흐려진다. 지금 화면이
 * 보고 있는 것과 같은 것 하나만 둔다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'

function fileOf(repoRoot: string, code: string, tag: string): string {
  return path.join(repoRoot, '_recipe', `${code}.${tag}.txt`)
}

/**
 * 부른 것과 받은 것을 한 장에 남긴다.
 *
 * **브리프도 같이 남긴다.** 답만 있으면 「무엇을 물었길래 저렇게 답했나」를
 * 알 수 없다 — 그 둘을 떼어 놓으면 반쪽만 보인다.
 *
 * 남기다 실패해도 **양산을 넘어뜨리지 않는다.** 이것은 곁다리 기록이다.
 */
export function saveReply(
  repoRoot: string,
  code: string,
  tag: string,
  brief: string,
  reply: string,
  note: string
): void {
  try {
    const file = fileOf(repoRoot, code, tag)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const head = [
      `# ${code} — ${tag}`,
      `# ${new Date().toISOString()}`,
      note ? `# ${note}` : '',
      '',
      '─── 보낸 글 ───────────────────────────────',
      ''
    ].filter((l) => l !== '')
    fs.writeFileSync(
      file,
      [...head, brief, '', '─── 받은 글 ───────────────────────────────', '', reply, ''].join('\n'),
      'utf8'
    )
  } catch {
    // 기록을 못 남겨도 하던 일은 계속한다.
  }
}

/** 남긴 글을 읽는다. 없으면 `null`. */
export function readReply(repoRoot: string, code: string, tag: string): string | null {
  try {
    return fs.readFileSync(fileOf(repoRoot, code, tag), 'utf8')
  } catch {
    return null
  }
}
