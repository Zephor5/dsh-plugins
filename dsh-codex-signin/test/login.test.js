import test from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { Login } from '../login.js'

test('only the initiating card can answer the current prompt and read the authorization link',async () => {
  const login = new Login({describe:() => ({methods:[{id:'oauth'}]}), async begin({interaction}) {
    const value = await interaction.prompt({kind:'select',message:'Method',options:[{id:'device_code',label:'Device'}]})
    assert.equal(value,'device_code')
    interaction.notify({url:'https://auth.openai.com/device',code:'EXAMPLE'})
    await setImmediate()
    return {status:'authorized'}
  }})
  const state = login.start('first')
  const question = state.question.id
  assert.throws(() => login.handle({op:'poll',id:'second'}),/expired/)
  assert.throws(() => login.start('second'),/busy/)
  assert.throws(() => login.handle({op:'answer',id:'first',question:'old',answer:'device_code'}),/stale/)
  login.handle({op:'answer',id:'first',question,answer:'device_code'})
  await setImmediate()
  assert.equal(state.notice.code,'EXAMPLE')
  await setImmediate()
  assert.deepEqual(login.handle({op:'poll',id:'first'}),{phase:'authorized'})
})
test('cancelling releases the active question and removes its information',async () => {
  const login = new Login({ describe:() => ({methods:[{id:'oauth'}]}),
    async begin({interaction}) { await interaction.prompt({kind:'text',message:'Callback URL'}) } })
  login.start('first')
  login.handle({op:'cancel',id:'first'})
  await setImmediate()
  assert.deepEqual(login.handle({op:'poll',id:'first'}),{phase:'cancelled'})
})
