import { basename, join } from 'node:path'
import { readdir, stat } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import type { FolderInfo, FolderListResult, FolderSize } from '../../shared/ipc'
import { SIZE_SCAN_MAX_ENTRIES, SIZE_SCAN_TIMEOUT_MS } from '../constants'
import { toErrorMessage } from '../lib/errors'
import { readPermissions, unknownPermissions } from './permissions'

/** 조회 실패 시 IPC 계층이 error 만 채워 돌려줄 수 있도록 빈 결과를 만든다. */
export function emptyFolderList(target: string): FolderListResult {
  return { path: target, folders: [] }
}

export function emptyFolderInfo(target: string): FolderInfo {
  return {
    path: target,
    name: basename(target) || target,
    createdAt: null,
    modifiedAt: null,
    folderCount: 0,
    fileCount: 0,
    directFileBytes: 0,
    permissions: unknownPermissions()
  }
}

export function emptyFolderSize(target: string): FolderSize {
  return { path: target, bytes: 0, files: 0, folders: 0, truncated: false }
}

/** 지정한 경로의 하위 폴더 목록을 반환한다. 파일은 제외한다. */
export async function listFolders(target: string): Promise<FolderListResult> {
  try {
    const entries = await readdir(target, { withFileTypes: true })
    const folders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ name: entry.name, path: join(target, entry.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    return { path: target, folders }
  } catch (error) {
    return { ...emptyFolderList(target), error: toErrorMessage(error, target) }
  }
}

/** 바로 아래 항목 수와 파일 용량 합계 */
async function countEntries(
  target: string
): Promise<{ folderCount: number; fileCount: number; directFileBytes: number }> {
  const entries = await readdir(target, { withFileTypes: true })
  let folderCount = 0
  let fileCount = 0
  let directFileBytes = 0

  for (const entry of entries) {
    if (entry.isDirectory()) {
      folderCount += 1
      continue
    }
    fileCount += 1
    // 개별 파일 stat 실패(권한, 잠김)는 용량 합계에서만 빠지고 조회 자체는 계속한다.
    try {
      directFileBytes += (await stat(join(target, entry.name))).size
    } catch {
      /* 무시 */
    }
  }

  return { folderCount, fileCount, directFileBytes }
}

/** 폴더 속성을 조회한다. 재귀 탐색을 하지 않으므로 빠르게 반환된다. */
export async function folderInfo(target: string): Promise<FolderInfo> {
  try {
    const info = await stat(target)
    if (!info.isDirectory()) {
      return { ...emptyFolderInfo(target), error: `${target} 경로는 폴더가 아닙니다.` }
    }

    // 항목 집계와 ACL 조회는 서로 독립적이므로 동시에 수행한다.
    const [counted, permissions] = await Promise.all([
      countEntries(target),
      readPermissions(target)
    ])

    return {
      path: target,
      name: basename(target) || target,
      createdAt: info.birthtimeMs || null,
      modifiedAt: info.mtimeMs || null,
      ...counted,
      permissions
    }
  } catch (error) {
    // 내용을 못 읽어도 권한 정보는 알 수 있으므로 함께 담아 돌려준다.
    return {
      ...emptyFolderInfo(target),
      permissions: await readPermissions(target),
      error: toErrorMessage(error, target)
    }
  }
}

/**
 * 하위 폴더까지 재귀로 용량을 합산한다.
 * 거대한 트리에서 앱이 멈추지 않도록 시간·항목 수 상한을 두고,
 * 상한에 걸리면 truncated=true 로 알린다. 심볼릭 링크는 순환을 피해 건너뛴다.
 */
export async function folderSize(target: string): Promise<FolderSize> {
  const result = emptyFolderSize(target)
  const deadline = Date.now() + SIZE_SCAN_TIMEOUT_MS
  const queue: string[] = [target]

  try {
    while (queue.length > 0) {
      if (Date.now() > deadline || result.files + result.folders > SIZE_SCAN_MAX_ENTRIES) {
        result.truncated = true
        break
      }

      const current = queue.pop() as string
      let entries: Dirent[]
      try {
        entries = await readdir(current, { withFileTypes: true })
      } catch {
        // 접근할 수 없는 하위 폴더는 건너뛰고 합계 계산을 계속한다.
        continue
      }

      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue
        const child = join(current, entry.name)
        if (entry.isDirectory()) {
          result.folders += 1
          queue.push(child)
        } else if (entry.isFile()) {
          result.files += 1
          try {
            result.bytes += (await stat(child)).size
          } catch {
            /* 무시 */
          }
        }
      }
    }
    return result
  } catch (error) {
    return { ...result, error: toErrorMessage(error, target) }
  }
}
