// 自检页用的系统/驱动信息：比 Windows 测试页更细，能查的全列出来。
import os from 'node:os'
import { execFile } from 'node:child_process'

const PLATFORM_LABEL = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
  freebsd: 'FreeBSD',
  android: 'Android',
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const day = Math.floor(total / 86400)
  const hour = Math.floor((total % 86400) / 3600)
  const min = Math.floor((total % 3600) / 60)
  if (day) return `${day} 天 ${hour} 小时`
  if (hour) return `${hour} 小时 ${min} 分`
  return `${min} 分`
}

/** 跨平台的基本信息，任何系统都能打。 */
export function basicInfo({ version = '', nodeVersion = process.versions.node } = {}) {
  const user = (() => {
    try {
      return os.userInfo().username
    } catch {
      return ''
    }
  })()
  return [
    ['用户名', user || '未知'],
    ['计算机名', os.hostname() || '未知'],
    ['操作系统', `${PLATFORM_LABEL[os.platform()] || os.platform()} ${os.release()} (${os.arch()})`],
    ['系统内存', `${Math.round((os.totalmem() || 0) / 1024 / 1024 / 1024)} GB`],
    ['系统运行', formatDuration(os.uptime())],
    ['插件版本', version || '-'],
    ['Node', String(nodeVersion || '-')],
  ]
}

const PS_SCRIPT = (name) => `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$n = '${String(name).replace(/'/g, "''")}'
$p = Get-Printer -Name $n
$d = Get-PrinterDriver -Name $p.DriverName
$o = Get-PrinterPort -Name $p.PortName
[pscustomobject]@{
  PrinterName = $p.Name
  Model = $p.DriverName
  PortName = $p.PortName
  Processor = $p.PrintProcessor
  Datatype = $p.Datatype
  Shared = $p.Shared
  ShareName = $p.ShareName
  Location = $p.Location
  Comment = $p.Comment
  Status = $p.PrinterStatus
  DriverManufacturer = $d.Manufacturer
  DriverVersion = $d.DriverVersion
  Environment = $d.PrinterEnvironment
  InfPath = $d.InfPath
  ConfigFile = $d.ConfigFile
  DataFile = $d.DataFile
  HelpFile = $d.HelpFile
  DependentFiles = $d.DependentFiles
  PortDescription = $o.Description
  PortHost = $o.PrinterHostAddress
  PortNumber = $o.PortNumber
} | ConvertTo-Json -Compress
`

function defaultRun(command, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error && !stdout) resolve({ ok: false, error: error.message, stdout: '' })
      else resolve({ ok: true, stdout: String(stdout || '') })
    })
  })
}

const clean = (value) => String(value ?? '').replace(/\uFFFD/g, '').trim()

/** Windows 专属：打印机 / 驱动 / 端口三块详情。读不到就返回空，不影响自检页。 */
export async function windowsDetails(printerName, { run = defaultRun, timeoutMs = 15000, platform = process.platform } = {}) {
  if (platform !== 'win32' || !printerName) return null
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT(printerName)]
  const result = await run('powershell.exe', args, timeoutMs)
  if (!result.ok || !result.stdout.trim()) return null
  let data
  try {
    data = JSON.parse(result.stdout)
  } catch {
    return null
  }
  const printer = [
    ['打印机名称', clean(data.PrinterName)],
    ['打印机型号', clean(data.Model)],
    ['端口名称', clean(data.PortName)],
    ['打印机处理器', clean(data.Processor)],
    ['数据格式', clean(data.Datatype)],
    ['共享', data.Shared ? `是${data.ShareName ? `（${clean(data.ShareName)}）` : ''}` : '否'],
    ['位置', clean(data.Location)],
    ['备注', clean(data.Comment)],
    ['状态', clean(data.Status)],
  ]
  const driver = [
    ['厂商', clean(data.DriverManufacturer)],
    ['驱动版本', clean(data.DriverVersion)],
    ['环境', clean(data.Environment)],
    ['INF 文件', clean(data.InfPath)],
    ['配置文件', clean(data.ConfigFile)],
    ['数据文件', clean(data.DataFile)],
    ['帮助文件', clean(data.HelpFile)],
    ['依赖文件', Array.isArray(data.DependentFiles) ? data.DependentFiles.length ? `${data.DependentFiles.length} 个` : '' : clean(data.DependentFiles)],
  ]
  const port = [
    ['端口描述', clean(data.PortDescription)],
    ['主机地址', clean(data.PortHost)],
    ['端口号', clean(data.PortNumber)],
  ].filter(([, value]) => value)
  if (Array.isArray(data.DependentFiles)) {
    for (const file of data.DependentFiles.slice(0, 6)) driver.push(['依赖', clean(file)])
  }
  return {
    printer: printer.filter(([, value]) => value),
    driver: driver.filter(([, value]) => value),
    port,
  }
}

/** 汇总成自检页要的分段。 */
export async function collectDetails(printer, { version = '', platform = process.platform, run, timeoutMs } = {}) {
  const sections = [{ title: '系统信息', rows: basicInfo({ version }) }]
  const details = await windowsDetails(printer?.transport === 'preview' ? '' : printer?.target, { run, timeoutMs, platform })
    .catch(() => null)
  if (details) {
    if (details.printer.length) sections.push({ title: '打印机信息', rows: details.printer })
    if (details.driver.length) sections.push({ title: '驱动程序', rows: details.driver })
    if (details.port.length) sections.push({ title: '端口', rows: details.port })
  }
  return sections
}
