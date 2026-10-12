import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import { invalidPathMessage, resolveTarget } from '../lib/paths'
import {
  emptyFolderInfo,
  emptyFolderList,
  emptyFolderSize,
  folderInfo,
  folderSize,
  listFolders
} from '../services/folders'

/**
 * 경로를 받는 채널의 공통 처리.
 * 렌더러 입력 검증을 여기서 한 번만 하고, 서비스는 검증된 절대 경로만 받는다.
 * 오류는 예외로 던지지 않고 결과 객체의 error 에 담는다. 렌더러가 화면에 그대로 표시한다.
 */
function handlePathQuery<T>(
  channel: string,
  run: (target: string) => Promise<T>,
  onInvalid: (target: string, message: string) => T
): void {
  ipcMain.handle(channel, async (_event, dirPath?: string) => {
    const target = resolveTarget(dirPath)
    const message = invalidPathMessage(target)
    return message ? onInvalid(target, message) : run(target)
  })
}

/** 폴더 트리와 속성·권한 화면이 쓰는 채널. */
export function registerFolderHandlers(): void {
  handlePathQuery(IPC.listFolders, listFolders, (path, error) => ({
    ...emptyFolderList(path),
    error
  }))
  handlePathQuery(IPC.folderInfo, folderInfo, (path, error) => ({
    ...emptyFolderInfo(path),
    error
  }))
  handlePathQuery(IPC.folderSize, folderSize, (path, error) => ({
    ...emptyFolderSize(path),
    error
  }))
}
