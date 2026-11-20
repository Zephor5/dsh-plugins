import test from 'node:test'
import assert from 'node:assert/strict'
import { modelDefaults, preferredInfo } from '../defaults.js'

const provider = 'openai-codex'
const enabled = { efforts: [{id:'low'}, {id:'high'}], defaultEffort:'low' }

test('apply defaults only for the matching provider and supported model without changing the original catalog', () => {
  const info = { provider, id:'astra', reasoning:enabled }
  assert.equal(preferredInfo(info,'auto'),info)
  assert.equal(preferredInfo(info,'ultra'),info)
  const other = {...info,provider:'other'}
  assert.equal(preferredInfo(other,'high'),other)
  assert.equal(preferredInfo(info,'high').reasoning.defaultEffort,'high')
  assert.equal(info.reasoning.defaultEffort,'low')
})

test('two models retain separate profile defaults; inheritance restores the adapter default', async () => {
  const values = {}
  const disposers = []
  class Llm {
    normalizeModelInfo(registration,id,model) { return model }
    listProviders() { return [{id:provider}] }
    listModels() { return [{id:'astra'}, {id:'sol'}] }
    resolveModelInfo(_,id) { return this.normalizeModelInfo(null,id,{provider,id,reasoning:enabled}) }
  }
  const llm = new Llm()
  const events = []
  const ctx = {llm, fiber:{entry:{options:{id:'signin'}}}, emit:event => events.push(event),
    effect:run => disposers.push(run()), settings:{mutate(ns,[op]) {
      assert.equal(ns,'signin')
      assert.equal(op.path[0],'modelDefaults')
      values[op.path[1]]=op.value
    }}}
  const service=modelDefaults(ctx,{modelDefaults:{get:()=>values}},id=>id==='draft'?{high:'high'}:undefined)
  assert.deepEqual(await service.describe('astra'),{choices:['low','high'],value:'auto'})
  await service.save('astra','high')
  await service.save('sol','low')
  assert.equal(llm.resolveModelInfo(provider,'astra').reasoning.defaultEffort,'high')
  assert.equal(llm.resolveModelInfo(provider,'sol').reasoning.defaultEffort,'low')
  await assert.rejects(service.save('astra','ultra'),/invalid/)
  await assert.rejects(service.save('__proto__','low'),/invalid/)
  assert.equal((await service.describe('astra')).value,'high')
  await service.save('draft','high')
  assert.deepEqual((await service.describe('unknown')).choices,[])
  await service.save('astra','auto')
  assert.equal(llm.resolveModelInfo(provider,'astra').reasoning.defaultEffort,'low')
  assert.equal((await service.describe('sol')).value,'low')
  assert.equal(events.length,4)
  disposers.reverse().forEach(fn=>fn())
  assert.equal(Object.hasOwn(llm,'normalizeModelInfo'),false)
})
