import test from 'node:test'
import assert from 'node:assert/strict'
import { accountModels, fetchAccountModels } from '../models.js'

const remote = { slug:'codex-example', display_name:'Codex Example', visibility:'list', context_window:500000,
  supported_reasoning_levels:[{ effort:'low' },{ effort:'high' },{ effort:'ultra' }], input_modalities:['text','image'] }
const [row] = accountModels({models:[remote]})

test('account rows retain context and wire effort names and hide unavailable entries', () => {
  const rows = accountModels({ models:[{ ...remote, visibility:'hide' }, remote, remote] })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].contextWindow, 500000)
  assert.deepEqual(rows[0].reasoningEfforts, {low:'low',high:'high'})
  assert.deepEqual(rows[0].inputModalities, ['text', 'image'])
  assert.equal(accountModels({models:[{...remote,context_window:undefined}]})[0].contextWindow,undefined)
  assert.deepEqual(accountModels({models:[]}),[])
  assert.throws(() => accountModels({}),/catalog/)
})

test('model discovery uses only the fixed account endpoint and distinguishes unauthorized responses', async () => {
  const credentials = { readRecord: async () => ({ kind:'grant', payload:{ access:'test-only', accountId:'workspace' } }) }
  const signal = new AbortController().signal
  const rows = await fetchAccountModels(credentials, signal, async (url, options) => {
    assert.equal(new URL(url).origin, 'https://chatgpt.com')
    assert.equal(new URL(url).pathname, '/backend-api/codex/models')
    assert.equal(options.redirect, 'error')
    assert.equal(options.headers.Authorization, 'Bearer test-only')
    assert.equal(options.headers['ChatGPT-Account-Id'],'workspace')
    return Response.json({models:[remote]})
  })
  assert.deepEqual(rows,[row])
  await assert.rejects(fetchAccountModels(credentials,signal,async () => new Response(null,{status:401})),/signin/)
  await assert.rejects(fetchAccountModels({readRecord:async () => undefined},signal,() => assert.fail()),/signin/)
})
