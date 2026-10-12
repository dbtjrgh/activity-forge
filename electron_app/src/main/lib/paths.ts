import { isAbsolute } from 'node:path'
import { DEFAULT_DIR } from '../../shared/ipc'

/** 렌더러가 보낸 경로를 정리한다. 값이 없으면 기본 경로를 쓴다. */
export function resolveTarget(dirPath?: string): string {
  return typeof dirPath === 'string' && dirPath.trim() ? dirPath.trim() : DEFAULT_DIR
}

/**
 * 렌더러는 신뢰 경계 밖이므로 넘어온 경로를 그대로 쓰지 않고 절대 경로만 허용한다.
 * 문제가 없으면 null, 있으면 사용자에게 보여줄 메시지를 반환한다.
 */
export function invalidPathMessage(target: string): string | null {
  return isAbsolute(target) ? null : '절대 경로만 조회할 수 있습니다.'
}
