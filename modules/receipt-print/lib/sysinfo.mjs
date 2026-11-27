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
  const cpu = os.cpus?.()[0]
  const memory = (bytes) => `${Math.round((Number(bytes) || 0) / 1024 / 1024 / 1024 * 10) / 10} GB`
  const locale = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().locale || ''
    } catch {
      return ''
    }
  })()
  const timeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    } catch {
      return ''
    }
  })()
  return [
    ['用户名', user || '未知'],
    ['计算机名', os.hostname() || '未知'],
    ['操作系统', `${PLATFORM_LABEL[os.platform()] || os.platform()} ${os.release()} (${os.arch()})`],
    ['系统版本', String(os.version?.() || '')],
    ['CPU', cpu?.model ? `${cpu.model.trim()} · ${os.cpus().length} 核` : ''],
    ['系统内存', `${memory(os.totalmem())}（空闲 ${memory(os.freemem())}）`],
    ['系统运行', formatDuration(os.uptime())],
    ['系统语言', locale],
    ['时区', timeZone],
    ['用户目录', os.homedir()],
    ['临时目录', os.tmpdir()],
    ['进程 ID', String(process.pid)],
    ['插件版本', version || '-'],
    ['Node', String(nodeVersion || '-')],
  ].filter(([, value]) => value)
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
  Type = $p.Type
  Published = $p.Published
  WorkOffline = $p.WorkOffline
  KeepPrintedJobs = $p.KeepPrintedJobs
  Priority = $p.Priority
  DefaultJobPriority = $p.DefaultJobPriority
  StartTime = $p.StartTime
  UntilTime = $p.UntilTime
  JobCount = $p.JobCount
  PagesPerMinute = $p.AveragePagesPerMinute
  Renderer = $p.Renderer
  Attributes = $p.Attributes
  Parameters = $p.Parameters
  AllowUserManagement = $p.AllowUserManagement
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
  PortMonitor = $o.PortMonitor
  SNMPEnabled = $o.SNMPEnabled
  SNMPCommunity = $o.SNMPCommunity
  LprQueueName = $o.LprQueueName
  PortUrl = $o.Url
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

const yesNo = (value) => {
  if (value === true) return '是'
  if (value === false) return '否'
  return ''
}

const timeText = (value) => {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && Number.isFinite(value.Hour) && Number.isFinite(value.Minute)) {
    return `${String(value.Hour).padStart(2, '0')}:${String(value.Minute).padStart(2, '0')}`
  }
  return ''
}

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
    ['类型', clean(data.Type)],
    ['共享', data.Shared ? `是${data.ShareName ? `（${clean(data.ShareName)}）` : ''}` : '否'],
    ['发布到目录', yesNo(data.Published)],
    ['脱机', yesNo(data.WorkOffline)],
    ['保留打印文档', yesNo(data.KeepPrintedJobs)],
    ['位置', clean(data.Location)],
    ['备注', clean(data.Comment)],
    ['状态', clean(data.Status)],
    ['优先级', data.Priority === undefined ? '' : String(data.Priority)],
    ['默认作业优先级', data.DefaultJobPriority === undefined ? '' : String(data.DefaultJobPriority)],
    ['可用开始', timeText(data.StartTime)],
    ['可用结束', timeText(data.UntilTime)],
    ['队列作业数', data.JobCount === undefined ? '' : String(data.JobCount)],
    ['每分钟页数', data.PagesPerMinute === undefined ? '' : String(data.PagesPerMinute)],
    ['渲染器', clean(data.Renderer)],
    ['属性', clean(data.Attributes)],
    ['参数', clean(data.Parameters)],
    ['允许用户管理', yesNo(data.AllowUserManagement)],
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
    ['端口监视器', clean(data.PortMonitor)],
    ['SNMP', data.SNMPEnabled === true ? `开${data.SNMPCommunity ? `（${clean(data.SNMPCommunity)}）` : ''}` : yesNo(data.SNMPEnabled)],
    ['LPR 队列', clean(data.LprQueueName)],
    ['端口 URL', clean(data.PortUrl)],
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
