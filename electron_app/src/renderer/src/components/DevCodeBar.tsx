import { useCallback, useEffect, useState } from 'react'
import type { CodeChanged } from '../../../shared/forge'

/** 묻는 사이 — 소스 폴더 셋을 훑을 뿐이라 1분마다 물어도 가볍다 */
const EVERY_MS = 60_000

/**
 * **dev 앱의 소스가 켠 뒤 바뀌었다** (2026-10-14). 사람은 감시 모드가 아닌 dev 앱(`start-app`, 9222)으로 양산한다 —
 * 화면은 HMR 로 바로 바뀌는데 메인 · preload 는 켤 때 빌드한 그대로라, 다 바뀐 줄 알고 쓰다가 엇갈린다.
 * 다시 켜면 도는 대화가 끊기므로 알리기만 한다. 켤 때 · 1분마다 · 창으로 돌아올 때 묻는다.
 * 실행 파일은 메인이 null 을 돌려 안 보인다. 감시 모드(`yarn dev`)에서는 preload 만 고쳐도 뜬다(그 모드는 화면을 다시 읽어 먹는다)
 */
export default function DevCodeBar() {
  const [got, setGot] = useState<CodeChanged | null>(null)
  const ask = useCallback(async () => {
    try {
      setGot(await window.api.appCodeChanged())
    } catch {
      // 못 물었으면 다음 차례에 다시 묻는다
    }
  }, [])

  useEffect(() => {
    void ask()
    const t = setInterval(() => void ask(), EVERY_MS)
    const onFocus = (): void => void ask()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [ask])

  if (!got?.files.length) return null
  return (
    <p className="dev-code-bar" title={got.files.slice(0, 20).join('\n')}>
      앱 코드가 바뀌었으니 대화가 끝나면 앱을 다시 켜세요.
    </p>
  )
}
