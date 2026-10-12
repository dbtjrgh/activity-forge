/**
 * **지우는 것은 휴지통으로** (2026-09-29, M5 — 저장소 규칙 7). 양산을 모른다.
 *
 * 휴지통은 Electron(`shell.trashItem`)이 하므로 앱이 켤 때 넘겨준다(`main/index.ts`) —
 * services 는 Electron 을 import 하지 않는다. **안 넘겨졌으면(Node 로만 돌 때) 지우지 않는다** —
 * 되돌릴 길이 없으면 안 지우는 쪽이 맞다.
 */

export type Trasher = (file: string) => Promise<void>

let trasher: Trasher | null = null

export function configureTrash(fn: Trasher): void {
  trasher = fn
}

export async function toTrash(file: string): Promise<void> {
  if (!trasher) throw new Error('휴지통을 쓸 수 없어 지우지 않았습니다. 앱 안에서만 지울 수 있습니다.')
  await trasher(file)
}
