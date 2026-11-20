import z from '@deepseek-ai/schemastery'
import { modelDefaults } from './defaults.js'
import { Login, key } from './login.js'
import { connectEditor } from './editor.js'

export const Config = z.object({
  modelDefaults: z.dict(z.union(['auto', 'off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])).default({}).volatile(),
})

export const inject = ['authorization', 'credentials', 'connection', 'llm', 'settings']
const errors = new Set(['busy', 'expired', 'stale', 'unavailable', 'invalid'])
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })

/** Register a Host-owner-only Fetch route on the authenticated Harness connection. */
export function apply(ctx, config) {
  const login = new Login(ctx.authorization)
  const stop = new AbortController()
  ctx.effect(() => () => { stop.abort(); login.dispose() })
  ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber))
  const discovered = connectEditor(ctx, stop.signal)
  const defaults = modelDefaults(ctx, config, discovered)
  ctx.connection.fetch.register({
    path: '/api/codex-signin', methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return json({ error: 'invalid' }, 415)
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object') return json({ error: 'invalid' }, 400)
      try {
        switch (body.op) {
          case 'effort':
            return json(await defaults.describe(body.model))
          case 'set-effort':
            return json(await defaults.save(body.model, body.value))
          case 'status': {
            const grant = await ctx.credentials.describeRecord(key)
            return json({ signedIn: grant.kind === 'grant' && grant.configured })
          }
          case 'start':
            if (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/.test(body.id)) throw new Error('invalid')
            return json(login.start(body.id))
          case 'poll': case 'answer': case 'cancel':
            return json(login.handle(body))
          default: throw new Error('invalid')
        }
      } catch (error) {
        const code = errors.has(error?.message) ? error.message : 'failed'
        return json({ error: code }, ['busy', 'expired', 'stale'].includes(code) ? 409 : 400)
      }
    },
  })
}
