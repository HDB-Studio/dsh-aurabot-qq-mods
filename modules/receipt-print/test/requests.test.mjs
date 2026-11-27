import test from 'node:test'
import assert from 'node:assert/strict'
import { messageSegments, messageText, messageImages, firstUrl, htmlToText, clipText } from '../lib/requests.mjs'

test('消息分段：数组和 CQ 字符串都能解析', () => {
  assert.equal(messageSegments({ raw: { message: [{ type: 'text', data: { text: 'hi' } }] } }).length, 1)
  const segs = messageSegments({ raw: { message: '看这个[CQ:image,file=a.jpg,url=https://x/1.png]&#91;好&#93;' } })
  assert.deepEqual(segs.map((s) => s.type), ['text', 'image', 'text'])
  assert.equal(segs[1].data.url, 'https://x/1.png')
  assert.equal(segs[2].data.text, '[好]')
})

test('消息文字：去掉 CQ 码和图片占位符', () => {
  assert.equal(messageText({ text: '[图片] 你好 [CQ:face,id=1]' }), '你好')
  assert.equal(messageText({ raw: { message: '纯文字' } }), '纯文字')
})

test('消息图片：有 url 取 url，只有 file 时留给 get_image', () => {
  const msg = { raw: { message: '[CQ:image,file=a.jpg,url=https://x/a.png][CQ:image,file=b.jpg]' } }
  assert.deepEqual(messageImages(msg), ['https://x/a.png', { file: 'b.jpg' }])
  assert.deepEqual(messageImages({ images: ['https://y/z.png'] }), ['https://y/z.png'])
})

test('取第一个链接，去掉尾部标点', () => {
  assert.equal(firstUrl('看看这个 https://example.com/a?b=1 挺好'), 'https://example.com/a?b=1')
  assert.equal(firstUrl('（https://example.com/x）'), 'https://example.com/x')
  assert.equal(firstUrl('没有链接'), '')
})

test('网页正文：优先 article，去脚本样式，实体解码', () => {
  const html = `<!doctype html><html><head><title>标题 &amp; 副标题</title>
    <style>.a{color:red}</style></head><body>
    <nav>导航</nav>
    <article><h1>小标题</h1><p>第一段&nbsp;文字</p><p>第一段&nbsp;文字</p>
    <script>alert(1)</script><p>第二段 &#39;引号&#39;</p></article>
    <footer>页脚</footer></body></html>`
  const { title, text } = htmlToText(html)
  assert.equal(title, '标题 & 副标题')
  assert.match(text, /小标题/)
  assert.match(text, /第一段 文字/)
  assert.equal(text.match(/第一段 文字/g).length, 1, '重复行只留一条')
  assert.match(text, /第二段 '引号'/)
  assert.ok(!text.includes('alert(1)'), '脚本必须去掉')
  assert.ok(!text.includes('color:red'), '样式必须去掉')
})

test('超长截断：加后略', () => {
  const long = '啊'.repeat(500)
  const clipped = clipText(long, 100)
  assert.equal(clipped.clipped, true)
  assert.equal(clipped.text.length, 100 + '…（后略）'.length)
  assert.match(clipped.text, /（后略）$/)
  assert.equal(clipText('短的', 100).clipped, false)
})
