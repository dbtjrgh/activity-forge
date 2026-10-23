import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'

type Props = { label: string; children: ReactNode }
type State = { error: string; round: number }

/**
 * **화면 한 칸의 오류가 앱 전체를 비우지 않게** (2026-10-14). React 는 그리다 던진 오류를 받는 곳이 없으면 뿌리째 내려
 * 옆줄 · 진행판까지 하얗게 된다 — 작업대 하나가 깨져도 다른 학습코드로 못 넘어갔다.
 * 오류 글 한 줄과 「다시 그리기」만 보인다. 다시 그리기는 안쪽을 새로 세운다(`round` 를 열쇠로) — 오류만 지우면 같은 상태로 또 던진다.
 * 대화 · 미리보기 서버는 메인이 들고 있어 다시 그려도 이어진다. 오류는 콘솔에도 남긴다(dev 는 터미널로 간다)
 */
export default class ErrorGuard extends Component<Props, State> {
  state: State = { error: '', round: 0 }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    // 빈 글이면 「오류 없음」으로 읽혀 같은 것을 또 그리다 던진다 — 그러면 React 가 앱 전체를 내린다
    const text = error instanceof Error ? error.message || error.name : String(error)
    return { error: text || '알 수 없는 오류' }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`[${this.props.label}] 화면 오류`, error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <section className="card">
          <p className="state error">
            {this.props.label} 화면을 그리지 못했습니다: {this.state.error}
          </p>
          <p className="row-actions">
            <button className="ghost" onClick={() => this.setState((s) => ({ error: '', round: s.round + 1 }))}>
              다시 그리기
            </button>
          </p>
        </section>
      )
    }
    return <Fragment key={this.state.round}>{this.props.children}</Fragment>
  }
}
