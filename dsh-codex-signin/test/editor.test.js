import assert from 'node:assert/strict'
import test from 'node:test'
import { connectEditor } from '../editor.js'
import { key } from '../login.js'

const account = [
  { id: 'one', name: 'One', contextWindow: 500000, reasoningEfforts: { low: 'low', high: 'high' } },
  { id: 'two', name: 'Two', contextWindow: 272000, reasoningEfforts: false },
]
const provider = 'openai-codex'
const path = ['providers', provider, 'models']

function fixture(load = async () => account) {
  const cleanup = []
  const events = new Map()
  const route = {}
  class Llm {
    discoverModels(...args) { return { receiver: this, args } }
  }
  class Settings {
    describe() { return [{ ns: 'llm-pi-ai', value: { providers: { [provider]: route } } }] }
    mutate(...args) { return { receiver: this, args } }
  }
  const ctx = {
    llm: new Llm(), settings: new Settings(), credentials: {},
    on(name, listener) { events.set(name, listener) },
    effect(attach) { cleanup.push(attach()) },
  }
  connectEditor(ctx, new AbortController().signal, load)
  return { ...ctx, route, events, dispose: () => cleanup.reverse().forEach(f => f()) }
}

test('native discovery returns selectable account models and never writes on fetch', async () => {
  const {llm} = fixture()
  assert.deepEqual(await llm.discoverModels('llm-pi-ai', {provider}), account.map(({reasoningEfforts, ...rest}) => rest))
})

test('one native save carries multiple models, manual context, ordering, and explicit efforts', async () => {
  const {llm, settings} = fixture()
  await llm.discoverModels('llm-pi-ai', {provider})
  const inputs = [{id:'two',contextWindow:123456}, {id:'manual'}, {id:'one',contextWindow:400000}]
  const op = {op:'set',path,value:inputs}
  const {args,receiver} = settings.mutate('llm-pi-ai',[op],17)
  assert.equal(receiver,settings)
  assert.deepEqual(args,['llm-pi-ai',[{op:'set',path,value:[
    {...inputs[0],reasoningEfforts:false}, inputs[1], {...inputs[2],reasoningEfforts:account[0].reasoningEfforts},
  ]}],17])
  assert.equal(inputs[0].reasoningEfforts, undefined)
  const explicit = {op:'set',path,value:[{id:'one',reasoningEfforts:{low:'low'}}]}
  assert.deepEqual(settings.mutate('llm-pi-ai',[explicit],18).args[1],[explicit])
})

test('delegate other providers and custom endpoints and keep unrelated writes intact', async () => {
  const {llm,settings,route} = fixture()
  const probe = {provider}
  await llm.discoverModels('llm-pi-ai',probe)
  for (const args of [['other',probe],['llm-pi-ai',{provider:'openai'}],['llm-pi-ai',{...probe,baseURL:'https://example.test'}]]) {
    const result = await llm.discoverModels(...args)
    assert.equal(result.receiver,llm)
    assert.deepEqual(result.args,args)
  }
  const unset = {op:'unset',path}
  const other = {op:'set',path:['providers','other','models'],value:[{id:'one'}]}
  assert.deepEqual(settings.mutate('llm-pi-ai',[unset,other],3).args[1],[unset,other])
  route.apiKeyEnv = 'OTHER_KEY'
  assert.deepEqual((await llm.discoverModels('llm-pi-ai',probe)).args,['llm-pi-ai',probe])
  const op = {op:'set',path,value:[{id:'one'}]}
  assert.deepEqual(settings.mutate('llm-pi-ai',[op],3).args[1],[op])
})

test('discard account capabilities after credential rotation, including during a fetch', async () => {
  const promise = Promise.withResolvers()
  const {llm,settings,events} = fixture(() => promise.promise)
  const result = llm.discoverModels('llm-pi-ai',{provider})
  events.get('credentials/record-updated')(key)
  promise.resolve(account)
  await assert.rejects(result,/Account changed/)
  const op = {op:'set',path,value:[{id:'one'}]}
  assert.deepEqual(settings.mutate('llm-pi-ai',[op],3).args[1],[op])
})

test('unload restores the instance methods and leaves other instances independent', async () => {
  const first = fixture()
  const second = fixture()
  first.dispose()
  assert.equal(Object.hasOwn(first.llm,'discoverModels'),false)
  assert.equal(Object.hasOwn(first.settings,'mutate'),false)
  assert.equal(Object.hasOwn(second.llm,'discoverModels'),true)
})
