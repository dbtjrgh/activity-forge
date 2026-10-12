import type { AccessEntry, FolderPermissions } from '../../shared/ipc'
import { ACL_TIMEOUT_MS } from '../constants'
import { runPowerShellJson } from '../lib/powershell'

/** GENERIC_ALL. Get-Acl 이 권한을 이름 대신 숫자로 돌려주는 경우가 있다. */
const GENERIC_ALL = 0x10000000

/** 쓰기로 볼 수 있는 권한 비트: FILE_WRITE_DATA, FILE_APPEND_DATA, GENERIC_WRITE, GENERIC_ALL */
const WRITE_BITS = 0x0002 | 0x0004 | 0x40000000 | GENERIC_ALL

/** 폴더의 ACL 과 현재 사용자의 SID 목록을 JSON 으로 덤프하는 스크립트. 경로는 env 로 받는다. */
const ACL_SCRIPT = `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$acl = Get-Acl -LiteralPath $env:ACL_TARGET -ErrorAction Stop
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$payload = [ordered]@{
  owner       = $acl.Owner
  currentUser = $identity.Name
  mySids      = @(@($identity.User.Value) + @($identity.Groups | ForEach-Object { $_.Value }))
  access      = @($acl.Access | ForEach-Object {
    $sid = $null
    try { $sid = $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { }
    [ordered]@{
      principal = $_.IdentityReference.Value
      sid       = $sid
      mask      = [int]$_.FileSystemRights
      rights    = $_.FileSystemRights.ToString()
      type      = $_.AccessControlType.ToString()
      inherited = [bool]$_.IsInherited
    }
  })
}
ConvertTo-Json -InputObject $payload -Depth 4 -Compress
`

interface RawAce {
  principal?: string
  sid?: string | null
  mask?: number
  rights?: string
  type?: string
  inherited?: boolean
}

interface AclPayload {
  owner?: string | null
  currentUser?: string | null
  mySids?: string[]
  access?: RawAce[]
}

/**
 * 같은 사용자에 대한 ACE 를 하나로 합친다.
 * Get-Acl 은 상속된 권한을 이름(FullControl)과 숫자(GENERIC_*) 두 벌로 돌려주는 일이 많아
 * 그대로 표시하면 같은 사용자가 두 번씩 나온다.
 */
export function mergeAces(raw: RawAce[], mySids: Set<string>): AccessEntry[] {
  const groups = new Map<
    string,
    {
      principal: string
      deny: boolean
      inherited: boolean
      appliesToMe: boolean
      rights: Set<string>
    }
  >()

  for (const ace of raw) {
    const principal = ace.principal?.trim()
    if (!principal) continue
    const deny = ace.type === 'Deny'
    const inherited = Boolean(ace.inherited)
    const key = `${principal}|${deny}|${inherited}`
    const group = groups.get(key) ?? {
      principal,
      deny,
      inherited,
      appliesToMe: Boolean(ace.sid && mySids.has(ace.sid)),
      rights: new Set<string>()
    }

    for (const token of (ace.rights ?? '').split(',').map((t) => t.trim())) {
      if (!token) continue
      const numeric = Number(token)
      if (!Number.isNaN(numeric)) {
        // 숫자 권한은 GENERIC_ALL 만 의미를 확정할 수 있다. 나머지는 특수 권한으로 묶는다.
        group.rights.add(numeric === GENERIC_ALL ? 'FullControl' : 'SpecialRights')
        continue
      }
      group.rights.add(token)
    }
    groups.set(key, group)
  }

  return [...groups.values()]
    .map(({ principal, deny, inherited, appliesToMe, rights }) => {
      // FullControl 이 있으면 나머지 세부 권한은 표시할 의미가 없다.
      if (rights.has('FullControl')) {
        return { principal, deny, inherited, appliesToMe, rights: 'FullControl' }
      }
      // 이름이 붙은 권한을 알고 있다면, 같은 ACE 의 숫자 표현(GENERIC_*)은 버린다.
      const tokens = [...rights]
      const named = tokens.filter((token) => token !== 'SpecialRights')
      return {
        principal,
        deny,
        inherited,
        appliesToMe,
        rights: (named.length > 0 ? named : tokens).join(', ')
      }
    })
    .sort((a, b) => {
      if (a.deny !== b.deny) return a.deny ? -1 : 1 // 거부 규칙을 먼저
      if (a.appliesToMe !== b.appliesToMe) return a.appliesToMe ? -1 : 1 // 나에게 적용되는 것을 먼저
      if (a.inherited !== b.inherited) return a.inherited ? 1 : -1 // 직접 지정을 먼저
      return a.principal.localeCompare(b.principal, 'ko')
    })
}

/**
 * ACL 에서 현재 사용자의 쓰기 가능 여부를 계산한다.
 * 거부(Deny)가 허용(Allow)보다 우선한다.
 */
export function resolveWritable(raw: RawAce[], mySids: Set<string>): boolean {
  const mine = raw.filter((ace) => ace.sid && mySids.has(ace.sid))
  const hasWriteBit = (ace: RawAce): boolean => ((ace.mask ?? 0) & WRITE_BITS) !== 0
  if (mine.some((ace) => ace.type === 'Deny' && hasWriteBit(ace))) return false
  return mine.some((ace) => ace.type === 'Allow' && hasWriteBit(ace))
}

/** 권한 정보를 알 수 없을 때의 기본값 */
export function unknownPermissions(error?: string): FolderPermissions {
  return { writable: null, owner: null, currentUser: null, entries: [], error }
}

/** 폴더의 소유자, 사용자별 권한, 현재 사용자의 쓰기 가능 여부를 조회한다. Windows 전용. */
export async function readPermissions(target: string): Promise<FolderPermissions> {
  if (process.platform !== 'win32') {
    return unknownPermissions('권한 조회는 Windows 에서만 지원합니다.')
  }

  try {
    const parsed = await runPowerShellJson<AclPayload>(
      ACL_SCRIPT,
      { ACL_TARGET: target },
      ACL_TIMEOUT_MS
    )
    const mySids = new Set(parsed.mySids ?? [])
    const raw = parsed.access ?? []
    const entries = mergeAces(raw, mySids)
    const owner = parsed.owner?.trim() || null
    const currentUser = parsed.currentUser?.trim() || null

    // Get-Acl 은 보안 설명자를 읽을 권한이 없을 때 예외 대신 빈 결과를 주기도 한다.
    if (!owner && entries.length === 0) {
      return { ...unknownPermissions('권한 정보를 읽을 권한이 없습니다.'), currentUser }
    }

    return { writable: resolveWritable(raw, mySids), owner, currentUser, entries }
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : String(error)
    return unknownPermissions(`권한 정보를 읽지 못했습니다: ${detail}`)
  }
}
