// 二维码内容：自动优先用这条内容自己的链接（说说/网页），否则用固定文字。

/** mode: 'auto' 有链接就指向链接；'custom' 永远用自定义文字；'off' 不打二维码。 */
export function resolveQr({ mode = 'auto', custom = '', url = '' } = {}) {
  if (mode === 'off') return ''
  const link = String(url || '').trim()
  if (mode === 'auto' && link) return link
  return String(custom || '').trim()
}
