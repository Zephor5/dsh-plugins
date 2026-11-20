import { randomUUID } from 'node:crypto'

export const key = 'llm-pi-ai/openai-codex'

/** A single interaction with the native grant flow. Only its initiating card has the attempt ID. */
export class Login {
  constructor(authorization) {
    this.authorization = authorization
  }

  start(id) {
    if (this.active?.state.phase === 'waiting') {
      if (this.active.id === id) return this.active.state
      throw new Error('busy')
    }
    if (!this.authorization.describe(key)?.methods.some(option => option.id === 'oauth')) throw new Error('unavailable')
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10 * 60_000)])
    const attempt = { id, controller, state: { phase: 'waiting' } }
    this.active = attempt
    const interaction = {
      notify: ({ url, code }) => {
        if (!url) return
        const link = new URL(url)
        if (link.protocol !== 'https:' || !['auth.openai.com', 'chatgpt.com'].includes(link.hostname) || link.username || link.password || link.port) {
          throw new Error('unexpected authorization URL')
        }
        attempt.state.notice = { url: link.href, code }
      },
      prompt: prompt => new Promise((resolve, reject) => {
        const pending = prompt.signal ? AbortSignal.any([signal, prompt.signal]) : signal
        pending.throwIfAborted()
        const question = { id: randomUUID(), kind: prompt.kind, message: prompt.message, options: prompt.options }
        const settle = (fn, value) => {
          pending.removeEventListener('abort', abort)
          delete attempt.state.question
          delete attempt.reply
          fn(value)
        }
        const abort = () => settle(reject, pending.reason)
        pending.addEventListener('abort', abort, { once: true })
        attempt.state.question = question
        attempt.reply = value => settle(resolve, value)
      }),
    }
    const finish = phase => { attempt.state = { phase }; delete attempt.reply }
    void this.authorization.begin({ key, method: 'oauth', interaction, signal }).then(
      result => finish(result.status),
      () => finish(signal.aborted ? 'cancelled' : 'failed'),
    )
    return attempt.state
  }

  handle({ op, id, question, answer }) {
    const attempt = this.active
    if (!attempt || attempt.id !== id) throw new Error('expired')
    if (op === 'cancel') attempt.controller.abort()
    if (op === 'answer') {
      const q = attempt.state.question
      if (!q || question !== q.id || !answer || typeof answer !== 'string' || answer.length > 8192 ||
        (q.kind === 'select' && !q.options.some(o => o.id === answer))) throw new Error('stale')
      attempt.reply(answer)
    }
    return attempt.state
  }

  dispose() { this.active?.controller.abort() }
}
