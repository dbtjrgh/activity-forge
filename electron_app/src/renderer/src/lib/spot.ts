/**
 * **그 칸으로 데려가 강조하기** (2026-10-01) — 순서 막대 · 「진행할 수 없습니다」 줄을 누르면 해당 칸으로.
 *
 * 스크롤하고, 접힌 것(`<details>`)은 펴고, 잠깐 빛나게 하고, 입력 칸이 있으면 첫 칸에 커서를 둔다 —
 * 누른 뒤 바로 적을 수 있게. 칸 id 는 `lib/benchorder.ts` 의 `TARGET` 이 정본이다.
 */

const FLASH_MS = 1600

/**
 * 아직 안 적은 입력 칸이 먼저 — 다 적었으면 첫 입력 칸. 입력 칸이 없으면 첫 단추
 * (파일 카드만 있으면 「리소스 폴더 열기」 — 커서가 가야 Enter 로 누르고, 어디를 누르면 되는지 보인다)
 */
function firstField(el: HTMLElement): HTMLElement | null {
  const fields = [...el.querySelectorAll<HTMLElement>('input:not([type=hidden]):not(:disabled), textarea:not(:disabled), select:not(:disabled)')]
  const empty = fields.find((f) => f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement ? f.value === '' : false)
  return empty ?? fields[0] ?? el.querySelector<HTMLElement>('button:not(:disabled)')
}

export function spot(id: string): void {
  const el = document.getElementById(id)
  if (!el) return
  for (let p: HTMLElement | null = el; p; p = p.parentElement) if (p instanceof HTMLDetailsElement) p.open = true
  el.querySelectorAll('details').forEach((d) => (d.open = true))
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.remove('spot-flash')
  // 다시 누르면 다시 빛나게 — 클래스를 뗀 뒤 한 틀 쉬고 붙인다
  requestAnimationFrame(() => el.classList.add('spot-flash'))
  window.setTimeout(() => el.classList.remove('spot-flash'), FLASH_MS)
  const field = firstField(el)
  if (field) window.setTimeout(() => field.focus({ preventScroll: true }), 350)
}
