// 自检页：比 Windows 驱动自带测试页更全，用来核对排版、字体、对齐和打印头。
import { wrapText, displayWidth } from './layout.mjs'
import { formatDate } from './templates.mjs'
import { clipQrText, qrCapacityForDots } from './qr.mjs'

// 二维码塞得下的上限：太多字会让模块小到扫不出来，超出的部分截断加省略号。
const QR_MAX_BYTES = 1200

/** 0-9 循环，正好铺满 columns 列，用来量宽度。 */
export function rulerLine(columns) {
  const unit = '1234567890'
  return unit.repeat(Math.ceil(columns / 10) + 1).slice(0, Math.max(1, Math.floor(columns)))
}

/** 每 5 列一个 +，其余是点，和上一行数字对齐，方便数格子。 */
export function tickLine(columns) {
  let out = ''
  for (let i = 0; i < Math.max(1, Math.floor(columns)); i++) out += i % 5 === 4 ? '+' : '.'
  return out
}

/** 用空格把文字顶到中间 / 右边，驱动忽略对齐指令时靠这段看效果。 */
export function padCenter(text, columns) {
  const width = Math.max(0, Math.floor(columns) - displayWidth(text))
  const left = Math.floor(width / 2)
  return ' '.repeat(left) + String(text) + ' '.repeat(width - left)
}

export function padRight(text, columns) {
  const width = Math.max(0, Math.floor(columns) - displayWidth(text))
  return ' '.repeat(width) + String(text)
}

/** 纯 ASCII 方框，宽度正好等于 columns，用来看左右边框有没有被切。 */
export function boxLines(columns, text = '') {
  const width = Math.max(6, Math.floor(columns))
  const inner = width - 2
  const content = String(text || '').slice(0, inner)
  const padLeft = Math.floor((inner - displayWidth(content)) / 2)
  const padRight = Math.max(0, inner - displayWidth(content) - padLeft)
  return [
    `+${'-'.repeat(inner)}+`,
    `|${' '.repeat(Math.max(0, padLeft))}${content}${' '.repeat(padRight)}|`,
    `+${'-'.repeat(inner)}+`,
  ]
}

/**
 * 打印头测试图：横向 1 点竖条查断针，灰阶查浓度，竖条查进纸，实心块查发热。
 * 宽度就是有效宽度的点数，超一点都会切边。
 */
export function testPattern(dots, height = 48) {
  const width = Math.max(32, Math.min(576, Math.round(Number(dots) || 384)))
  const rows = Math.max(24, Math.floor(height))
  const bytesPerRow = Math.ceil(width / 8)
  const data = Buffer.alloc(bytesPerRow * rows)
  const set = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= rows) return
    data[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      const band = Math.floor((y / rows) * 4)
      let on = false
      if (band === 0) on = x % 2 === 0 // 1 点竖条：断针会留下白缝
      else if (band === 1) on = (x * 8) / width > (y - rows / 4) / (rows / 4) // 斜向灰阶
      else if (band === 2) on = Math.floor(x / 8) % 2 === 0 // 8 点竖条
      else on = x > width * 0.05 && x < width * 0.95 // 实心块，留一点白边
      if (on) set(x, y)
    }
  }
  // 左右各画一条 1 点竖线，右边框被切会立刻看出来
  for (let y = 0; y < rows; y++) {
    set(0, y)
    set(width - 1, y)
  }
  return { width, height: rows, data }
}

/**
 * 自检页二维码：把这台机器这次自检的全部信息写进去（设备、系统、打印机、驱动、端口、时间），
 * 手机扫一下就能看到完整质检结果，不用逐行抄纸。
 */
export function buildSelfTestQr({
  printer = {},
  paper = {},
  settings = {},
  transportLabel = '',
  version = '',
  now = new Date(),
  extraInfo = [],
} = {}) {
  const columns = Math.max(8, Math.min(96, Math.floor(paper.columns) || 32))
  const paperMm = Number(paper.paperMm) || 58
  const effectiveMm = Number(paper.effectiveMm) || 48
  const dots = Number(paper.dots) || effectiveMm * 8
  const stamp = formatDate(now)
  const lines = [
    `AURABOT 热敏打印 自检 v${version || '-'}`,
    `打印机：${printer.name || '未命名'}`,
    `通道：${transportLabel || printer.transport || '未知'}`,
    `目标：${printer.transport === 'preview' ? '不实际出纸' : (printer.target || '未填')}`,
    `纸宽：${paperMm}mm · 有效 ${effectiveMm}mm · ${columns} 列`,
    `编码：${printer.encoding || settings.encoding || 'gbk'} · 切纸：${printer.cut || settings.cut || 'partial'} · 抖动：${settings.imageDither === false ? '关' : '开'}`,
    `时间：${stamp.datetime} ${stamp.weekday}`,
  ]
  for (const section of extraInfo) {
    if (!section?.rows?.length) continue
    lines.push(`[${section.title}]`)
    for (const [key, value] of section.rows) {
      const text = String(value ?? '').replace(/\s+/g, ' ').trim()
      if (text) lines.push(`${key}：${text}`)
    }
  }
  // 再长就扫不清了：先按纸宽点数算能塞多少，再用硬上限兜底
  const maxBytes = Math.max(200, Math.min(QR_MAX_BYTES, qrCapacityForDots(dots, 2)))
  return clipQrText(lines.join('\n'), maxBytes)
}

/**
 * 组装自检页的行和位图。styles 见 lib/escpos.mjs：title/center/right/bold/big/large/sep/normal。
 */
export function buildSelfTestPage({
  printer = {},
  paper = {},
  settings = {},
  transportLabel = '',
  version = '',
  now = new Date(),
  extraInfo = [],
} = {}) {
  const columns = Math.max(8, Math.min(96, Math.floor(paper.columns) || 32))
  const paperMm = Number(paper.paperMm) || 58
  const effectiveMm = Number(paper.effectiveMm) || 48
  const dots = Number(paper.dots) || effectiveMm * 8
  const stamp = formatDate(now)
  const lines = []

  // title 是倍宽字，按半宽折行，加起来才不会超纸宽
  const push = (style, text = '') => {
    const width = style === 'title' ? Math.max(4, Math.floor(columns / 2)) : columns
    for (const line of wrapText(String(text ?? ''), width)) lines.push({ text: line, style })
  }
  const sep = () => lines.push({ text: '-'.repeat(columns), style: 'sep' })
  // 空格对齐的行不能被折行逻辑吃掉尾部空格，原样入列
  const pushExact = (style, text) => lines.push({ text: String(text), style })

  push('title', '打印机自检')
  push('center', 'AURABOT · receipt-print')
  sep()

  push('bold', '设备信息')
  push('normal', `打印机：${printer.name || '未命名'}`)
  push('normal', `通道：${transportLabel || printer.transport || '未知'}`)
  push('normal', `目标：${printer.transport === 'preview' ? '不实际出纸' : (printer.target || '未填')}`)
  push('normal', `纸宽：${paperMm}mm · 有效 ${effectiveMm}mm · ${columns} 列`)
  push('normal', `编码：${printer.encoding || settings.encoding || 'gbk'} · 抖动：${settings.imageDither === false ? '关' : '开'}`)
  push('normal', `切纸：${printer.cut || settings.cut || 'partial'}`)
  push('normal', `插件：${version || '-'}`)
  push('normal', `时间：${stamp.datetime} ${stamp.weekday}`)
  sep()

  for (const section of extraInfo) {
    if (!section?.rows?.length) continue
    push('bold', section.title)
    for (const [key, value] of section.rows) {
      const text = String(value ?? '').trim()
      if (!text) continue
      const head = `${key}：`
      if (displayWidth(head) + displayWidth(text) <= columns) {
        push('normal', head + text)
      } else {
        // 第一段贴着标签放，剩下的缩进两格续行
        const firstWidth = Math.max(4, columns - displayWidth(head))
        const first = wrapText(text, firstWidth)
        lines.push({ text: head + (first.shift() || ''), style: 'normal' })
        for (const line of wrapText(first.join(''), Math.max(4, columns - 2))) push('normal', `  ${line}`)
      }
    }
    sep()
  }

  push('bold', '对齐测试（对齐指令）')
  push('normal', 'LEFT 左对齐')
  push('center', 'CENTER 居中')
  push('right', 'RIGHT 右对齐')
  push('bold', '对齐测试（空格填充）')
  push('normal', 'LEFT')
  pushExact('normal', padCenter('CENTER', columns))
  pushExact('normal', padRight('RIGHT', columns))
  push('normal', '两段都居中/贴右说明正常；只有第二段对，说明打印机忽略对齐指令，按空格为准。')
  sep()

  push('bold', '字号测试')
  push('normal', '常规 normal ABC abc 0123456789')
  push('big', '倍高 ABC')
  push('large', '倍宽倍高 A1')
  push('bold', '加粗 bold A1')
  sep()

  push('bold', '字符测试')
  push('normal', '中文：热敏打印中文正常')
  push('normal', '标点：，。！？；：（）《》“”')
  push('normal', '混排：中文 + English + 123')
  push('normal', '长行要按纸宽折行，不能溢出。')
  push('normal', 'ASCII: !"#$%&\'()*+,-./')
  push('normal', '0123456789:;<=>?@')
  push('normal', 'ABCZ[\\]^_`abcz{|}~')
  sep()

  push('bold', '宽度刻度')
  push('normal', rulerLine(columns))
  push('normal', tickLine(columns))
  push('normal', '铺满整行=宽度正确，被切就调小。')
  for (const line of boxLines(columns, 'BOARD')) push('normal', line)
  sep()

  push('bold', '打印头测试图')
  push('normal', `下方 ${dots} 点宽：竖条看断针，灰阶看浓度，实心块看发热。`)

  lines.push({ text: '', style: 'normal' })
  lines.push({ text: '-'.repeat(columns), style: 'sep' })
  push('center', `自检完成 · ${stamp.time}`)

  return {
    lines,
    images: [testPattern(dots)],
    qr: buildSelfTestQr({ printer, paper, settings, transportLabel, version, now, extraInfo }),
    columns,
    dots,
  }
}
