// 抖音写操作失败分类：用户报「日志全是失败」时，日志要能区分验证码/风控、选择器、网络、额度。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyFailure, describeFailure } from '../lib/failure.mjs'

test('失败分类：验证 / 登录 / 额度 / 找不到人 / 选择器 / 网络 / 不确定 / 业务码', () => {
  assert.equal(classifyFailure(Object.assign(new Error('no'), { code: 'verify' })), 'risk')
  assert.equal(classifyFailure(new Error('抖音提示要完成安全验证')), 'risk')
  assert.equal(classifyFailure(new Error('操作太频繁，稍后再试')), 'risk')
  assert.equal(classifyFailure(new Error('抖音还没登录')), 'login')
  assert.equal(classifyFailure(new Error('今天点赞次数用完了')), 'limit')
  assert.equal(classifyFailure(new Error('@ 候选里没找到主人（可能互相没关注）')), 'target')
  assert.equal(classifyFailure(new Error('分享面板里没找到主人（可能互相没关注、私信不通）')), 'target')
  assert.equal(classifyFailure(new Error('页面上找不到点赞按钮（试过 6 种选择器）')), 'selector')
  assert.equal(classifyFailure(new Error('评论框点不进去')), 'selector')
  assert.equal(classifyFailure(new Error('点了分享，但没等到抖音私信的回应')), 'network')
  assert.equal(classifyFailure(new Error('私信发送状态不确定，已暂停重试')), 'uncertain')
  assert.equal(classifyFailure(Object.assign(new Error('分享失败（5）'), { code: 5 })), 'api')
  assert.equal(classifyFailure(new Error('没法解释的问题')), 'unknown')
})

test('失败日志行：动作 + 类别 + 视频 id + 原始错误，便于用户直接复制', () => {
  const f = describeFailure('抖音点赞', new Error('页面上找不到点赞按钮'), { awemeId: '7675305737601436971' })
  assert.equal(f.kind, 'selector')
  assert.equal(f.text, '抖音点赞失败[selector] aweme=7675305737601436971：页面上找不到点赞按钮')
})
