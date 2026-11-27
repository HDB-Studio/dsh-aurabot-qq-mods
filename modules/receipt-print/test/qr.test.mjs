import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveQr } from '../lib/qr.mjs'
import { momentUrl } from '../lib/moments.mjs'

test('二维码：auto 有链接就用链接', () => {
  assert.equal(resolveQr({ mode: 'auto', custom: '{date}', url: 'https://example.com/a' }), 'https://example.com/a')
  assert.equal(resolveQr({ mode: 'auto', custom: '店里 WiFi', url: '  ' }), '店里 WiFi')
})

test('二维码：custom 只认自定义文字，off 直接不打', () => {
  assert.equal(resolveQr({ mode: 'custom', custom: 'AURABOT', url: 'https://example.com' }), 'AURABOT')
  assert.equal(resolveQr({ mode: 'off', custom: 'AURABOT', url: 'https://example.com' }), '')
  assert.equal(resolveQr({ mode: 'off' }), '')
})

test('说说网址：宿主给了 url 就用它', () => {
  assert.equal(momentUrl({ url: 'https://qzone.qq.com/x' }), 'https://qzone.qq.com/x')
  assert.equal(momentUrl({ tid: 'https://qzone.qq.com/y' }), 'https://qzone.qq.com/y')
})

test('说说网址：uin + tid 拼 QQ 空间地址', () => {
  assert.equal(momentUrl({ tid: 'ABC123', uin: '10001' }), 'https://user.qzone.qq.com/10001/mood/ABC123')
  assert.equal(momentUrl({ id: 'XYZ', userId: '123456' }), 'https://user.qzone.qq.com/123456/mood/XYZ')
})

test('说说网址：拼不出来就返回空，交给固定二维码', () => {
  assert.equal(momentUrl({}), '')
  assert.equal(momentUrl({ tid: 'ABC' }), '')
  assert.equal(momentUrl({ tid: 'ABC', uin: 'abc' }), '')
})
