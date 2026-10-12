/**
 * 글 두 장을 줄 단위로 견준다. 폴더도 양산도 모르는 범용 코드다(`lib/` 규칙).
 *
 * **왜 직접 쓰나.** 의존성을 하나 더 들이지 않으려는 것이다(forge/CLAUDE.md 와
 * 같은 결). 견줄 것이 **같은 틀에서 나온 두 파일**이라 어려운 경우가 없다 —
 * 줄이 통째로 뒤집히거나 하지 않는다.
 *
 * **상한을 둔다.** 표를 n×m 으로 잡으므로 큰 파일 둘을 그냥 견주면 메모리가
 * 터진다. 앞뒤로 같은 줄을 먼저 걷어내고, 그러고도 남은 것이 상한을 넘으면
 * **견주지 않고 그렇다고 말한다.** 조용히 반만 견주지 않는다.
 */

export type DiffKind = 'same' | 'add' | 'del'

export interface DiffRow {
  kind: DiffKind
  /** 원본 쪽 줄 번호(1부터). 새로 생긴 줄이면 null */
  before: number | null
  /** 새 쪽 줄 번호(1부터). 없어진 줄이면 null */
  after: number | null
  text: string
}

export interface Diff {
  rows: DiffRow[]
  added: number
  removed: number
  /** 상한에 걸려 못 견줬으면 그 까닭. 걸리지 않았으면 빈 글 */
  tooBig: string
}

/** 가운데(앞뒤 같은 줄을 걷어낸 나머지) 한쪽이 이보다 길면 견주지 않는다. */
const CAP = 2000

export function lineDiff(before: string, after: string, cap = CAP): Diff {
  const a = before.split(/\r?\n/)
  const b = after.split(/\r?\n/)

  // 앞뒤로 똑같은 줄은 견줄 것이 없다. 같은 틀에서 나온 파일이라 이것만으로
  // 대개 몇십 줄로 줄어든다.
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail++
  }

  const midA = a.slice(head, a.length - tail)
  const midB = b.slice(head, b.length - tail)

  if (midA.length > cap || midB.length > cap) {
    return {
      rows: [],
      added: 0,
      removed: 0,
      tooBig: `바뀐 곳이 너무 많아 줄 단위로 비교할 수 없습니다(원본 ${midA.length}줄, 새 파일 ${midB.length}줄, 상한 ${cap}줄). 아래에서 생성된 파일 전체를 확인하세요.`
    }
  }

  const rows: DiffRow[] = []
  for (let i = 0; i < head; i++) rows.push({ kind: 'same', before: i + 1, after: i + 1, text: a[i] })

  let added = 0
  let removed = 0
  for (const row of walk(midA, midB, head)) {
    rows.push(row)
    if (row.kind === 'add') added++
    if (row.kind === 'del') removed++
  }

  for (let i = 0; i < tail; i++) {
    const at = a.length - tail + i
    rows.push({ kind: 'same', before: at + 1, after: b.length - tail + i + 1, text: a[at] })
  }
  return { rows, added, removed, tooBig: '' }
}

/** 가운데만 LCS 표로 견준다. `at` 은 걷어낸 앞머리 줄 수 — 번호를 맞추는 데 쓴다. */
function walk(a: string[], b: string[], at: number): DiffRow[] {
  const n = a.length
  const m = b.length
  // (n+1)×(m+1) 표. Int32Array 하나로 잡아 줄마다 배열을 만들지 않는다.
  const lcs = new Int32Array((n + 1) * (m + 1))
  const w = m + 1
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * w + j + 1] + 1
          : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1])
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ kind: 'same', before: at + i + 1, after: at + j + 1, text: a[i] })
      i++
      j++
    } else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) {
      rows.push({ kind: 'del', before: at + i + 1, after: null, text: a[i] })
      i++
    } else {
      rows.push({ kind: 'add', before: null, after: at + j + 1, text: b[j] })
      j++
    }
  }
  while (i < n) rows.push({ kind: 'del', before: at + i + 1, after: null, text: a[i++] })
  while (j < m) rows.push({ kind: 'add', before: null, after: at + j + 1, text: b[j++] })
  return rows
}

/**
 * 달라진 줄만 남기고, 앞뒤로 몇 줄씩 붙여 둔다.
 *
 * 문맥이 없으면 「어디가 달라졌는지」는 알아도 **무슨 자리인지**를 모른다.
 * 무리 사이는 `null` 로 끊어 화면이 「…」를 그릴 수 있게 한다.
 */
export function onlyChanged(rows: DiffRow[], context = 2): (DiffRow | null)[] {
  const keep = new Set<number>()
  rows.forEach((row, at) => {
    if (row.kind === 'same') return
    for (let k = at - context; k <= at + context; k++) if (k >= 0 && k < rows.length) keep.add(k)
  })

  const out: (DiffRow | null)[] = []
  let last = -1
  for (const at of [...keep].sort((x, y) => x - y)) {
    if (last >= 0 && at > last + 1) out.push(null)
    out.push(rows[at])
    last = at
  }
  return out
}
