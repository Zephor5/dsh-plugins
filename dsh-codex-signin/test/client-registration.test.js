import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

test('registers the browser plugin under the module ID requested by DSH', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const script = readFileSync(new URL('../' + manifest.exports['./client'], import.meta.url), 'utf8')
  const modules = new Map()
  const loader = { load: ({ id, factory }) => modules.set(id, factory) }
  runInNewContext(script, { window: { __ModuleLoader__: loader } })
  assert.equal(typeof modules.get(manifest.name), 'function')
})
