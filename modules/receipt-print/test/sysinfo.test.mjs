import test from 'node:test'
import assert from 'node:assert/strict'
import { basicInfo, windowsDetails, collectDetails, formatDuration } from '../lib/sysinfo.mjs'

const fakeRun = (payload) => async () => ({ ok: true, stdout: JSON.stringify(payload) })

test('基本信息：用户名、计算机名、操作系统都在', () => {
  const rows = new Map(basicInfo({ version: '0.13.0', nodeVersion: '22.0.0' }))
  assert.ok(rows.get('用户名'))
  assert.ok(rows.get('计算机名'))
  assert.match(rows.get('操作系统'), /Windows|macOS|Linux/)
  assert.equal(rows.get('插件版本'), '0.13.0')
  assert.equal(rows.get('Node'), '22.0.0')
})

test('运行时长格式化', () => {
  assert.equal(formatDuration(90), '1 分')
  assert.equal(formatDuration(3700), '1 小时 1 分')
  assert.equal(formatDuration(90000), '1 天 1 小时')
})

test('Windows 详情：打印机、驱动、端口字段都解析出来', async () => {
  const payload = {
    PrinterName: 'DL',
    Model: 'DL-58 USB Printer',
    PortName: 'USB001',
    Processor: 'winprint',
    Datatype: 'RAW',
    Shared: false,
    ShareName: '',
    Location: '前台',
    Comment: '',
    Status: 'Normal',
    DriverManufacturer: 'DL Tech',
    DriverVersion: '3.1.0.0',
    Environment: 'Windows x64',
    InfPath: 'C:\\Windows\\INF\\dl58.inf',
    ConfigFile: 'C:\\Windows\\System32\\spool\\drivers\\x64\\3\\dl58.dll',
    DataFile: 'dl58.dat',
    HelpFile: '',
    DependentFiles: ['dl58.dll', 'dl58ui.dll'],
    PortDescription: 'USB 虚拟打印机端口',
    PortHost: '',
    PortNumber: '',
  }
  const details = await windowsDetails('DL', { run: fakeRun(payload), platform: 'win32' })
  const printer = new Map(details.printer)
  assert.equal(printer.get('打印机名称'), 'DL')
  assert.equal(printer.get('打印机型号'), 'DL-58 USB Printer')
  assert.equal(printer.get('端口名称'), 'USB001')
  assert.equal(printer.get('打印机处理器'), 'winprint')
  assert.equal(printer.get('数据格式'), 'RAW')
  assert.equal(printer.get('共享'), '否')
  const driver = new Map(details.driver)
  assert.equal(driver.get('厂商'), 'DL Tech')
  assert.equal(driver.get('驱动版本'), '3.1.0.0')
  assert.equal(driver.get('依赖文件'), '2 个')
  assert.equal(details.port.length, 1, '空字段要被过滤')
  assert.equal(new Map(details.port).get('端口描述'), 'USB 虚拟打印机端口')
})

test('Windows 详情：非 Windows 或读不到就返回 null', async () => {
  assert.equal(await windowsDetails('DL', { platform: 'linux', run: fakeRun({}) }), null)
  assert.equal(await windowsDetails('', { platform: 'win32', run: fakeRun({}) }), null)
  assert.equal(await windowsDetails('DL', { platform: 'win32', run: async () => ({ ok: false, stdout: '' }) }), null)
  assert.equal(await windowsDetails('DL', { platform: 'win32', run: async () => ({ ok: true, stdout: 'not json' }) }), null)
})

test('collectDetails：非 Windows 只有系统信息', async () => {
  const sections = await collectDetails({ name: 'x', transport: 'preview' }, { version: '0.13.0', platform: 'linux' })
  assert.equal(sections.length, 1)
  assert.equal(sections[0].title, '系统信息')
  assert.ok(sections[0].rows.length >= 5)
})

test('collectDetails：Windows 会带上打印机/驱动/端口三段', async () => {
  const payload = { PrinterName: 'DL', Model: 'M', PortName: 'USB001', DriverManufacturer: 'DL', DependentFiles: [] }
  const sections = await collectDetails(
    { name: 'DL', transport: 'windows', target: 'DL' },
    { version: '0.13.0', platform: 'win32', run: fakeRun(payload) },
  )
  const titles = sections.map((s) => s.title)
  assert.deepEqual(titles, ['系统信息', '打印机信息', '驱动程序'])
})
