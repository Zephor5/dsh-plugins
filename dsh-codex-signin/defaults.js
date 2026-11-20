import { decorate } from './editor.js'
import { provider } from './models.js'

/** Apply the model preference at the metadata step shared by discovery, call preparation, and direct streams. */
export function preferredInfo(info, preference) {
  if (info.provider !== provider || !preference || !info.reasoning?.efforts.some(e => e.id === preference)) return info
  return { ...info, reasoning: { ...info.reasoning, defaultEffort: preference } }
}

export function modelDefaults(ctx, config, discoveredEfforts) {
  const namespace = ctx.fiber.entry.options.id
  const get = model => {
    const stored = config.modelDefaults.get()
    return Object.hasOwn(stored, model) ? stored[model] : 'auto'
  }
  // In rc.5, all three runtime paths call this method on the same LLM service instance.
  decorate(ctx, ctx.llm, 'normalizeModelInfo', previous => function (registration, model, resolved) {
    const info = previous.apply(this, arguments)
    return info.provider === provider ? preferredInfo(info, get(model)) : info
  })

  async function describe(model) {
    if (typeof model !== 'string' || !model.trim() || model.length > 256 ||
        ['__proto__','constructor','prototype'].includes(model)) throw new Error('invalid')
    let choices
    if (ctx.llm.listProviders().some(item => item.id === provider) &&
        (await ctx.llm.listModels(provider)).some(item => item.id === model)) {
      const info = await ctx.llm.resolveModelInfo(provider, model)
      choices = info.reasoning?.efforts.map(e => e.id) ?? []
    } else {
      // Fetched account models can be selected in a catalog draft before the native Save.
      choices = Object.keys(discoveredEfforts(model) || {})
    }
    const stored = get(model)
    return { choices, value: choices.includes(stored) ? stored : 'auto' }
  }

  async function save(model, value) {
    const { choices } = await describe(model)
    if (value !== 'auto' && !choices.includes(value)) throw new Error('invalid')
    await ctx.settings.mutate(namespace, [{ op: 'set', path: ['modelDefaults', model], value }])
    ctx.emit('llm/adapters-updated')
    return describe(model)
  }
  return { describe, save }
}
