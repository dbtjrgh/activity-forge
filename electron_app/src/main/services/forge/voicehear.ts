/**
 * **「대사 성우」에서 들어 볼 소리 한 개** — `voiceset.ts` 에서 뗐다(2026-10-06, 동작 변화 없음 · 200줄을 넘어서).
 *
 * 완성본이면 그 완성본의 첫 대사(시작 대사가 있으면 그것), 이 학습코드면 폴더에 새로 온 소리 하나
 * (어느 완성본 대사와도 바이트가 다른 첫 파일 — 이번 호 성우 목소리). 못 찾으면 null.
 * 고를 수 있는 것은 그 모듈을 쓴 학습코드뿐 — 렌더러는 학습코드만 보낸다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import { sameFile } from './rsccopy'
import { filesOf, withCtx } from './voiceset'

export function voiceSample(code: string, from: string): Promise<{ file: string; bytes: Buffer } | null> {
  return withCtx(
    code,
    () => null,
    (ctx) => {
      const pickOf = (files: Map<string, string>): string | undefined => files.get('person-start') ?? [...files.values()][0]
      if (from !== code) {
        if (!ctx.choices.includes(from)) return null
        const f = pickOf(filesOf(ctx, from))
        return f ? { file: path.basename(f), bytes: fs.readFileSync(f) } : null
      }
      const sounds = path.join(ctx.dir, 'sounds')
      if (!ctx.dir || !fs.existsSync(sounds)) return null
      const known = ctx.choices.flatMap((c) => [...filesOf(ctx, c).values()])
      const fresh = fs
        .readdirSync(sounds)
        .filter((n) => /\.mp3$/i.test(n))
        .map((n) => path.join(sounds, n))
        .find((f) => !known.some((k) => sameFile(k, f)))
      return fresh ? { file: path.basename(fresh), bytes: fs.readFileSync(fresh) } : null
    }
  )
}
