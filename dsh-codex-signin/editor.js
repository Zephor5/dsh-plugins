import { key } from './login.js'
import { fetchAccountModels, provider } from './models.js'

const ns = 'llm-pi-ai'

/**
 * DSH rc.5 has one discovery owner per settings namespace. Decorate only this Host
 * instance and keep the native receiver and disposer semantics for all other calls.
 */
export function decorate(ctx, service, method, make) {
  ctx.effect(() => {
    const own = Object.getOwnPropertyDescriptor(service, method)
    let original = own
    for (let base = Object.getPrototypeOf(service); !original && base; base = Object.getPrototypeOf(base)) {
      original = Object.getOwnPropertyDescriptor(base, method)
    }
    if (typeof original?.value !== 'function') throw new Error('Missing Harness service method: ' + method)
    const previous = original.value
    const run = make(previous)
    let mounted = true
    function dispatch(...args) {
      return (mounted ? run : previous).apply(this, args)
    }
    Object.defineProperty(service, method, { configurable: true, writable: true, value: dispatch })
    return () => {
      mounted = false
      if (Object.getOwnPropertyDescriptor(service, method)?.value !== dispatch) return
      if (own) Object.defineProperty(service, method, own)
      else Reflect.deleteProperty(service, method)
    }
  })
}

function customRoute(route) {
  return Boolean(route?.apiKeyEnv || route?.api || route?.baseURL)
}

/** rc.5's discovery wire type carries capacities and modalities but omits reasoning capabilities. */
export function withAccountEfforts(ops, capabilities) {
  return ops.map(op => {
    const path = op.path
    if (op.op !== 'set' || path.length !== 3 || path[0] !== 'providers' ||
        path[1] !== provider || path[2] !== 'models' || !Array.isArray(op.value)) return op
    return { ...op, value: op.value.map(row => {
      const efforts = capabilities.get(row?.id)
      if (efforts === undefined || row.reasoningEfforts !== undefined) return row
      return { ...row, reasoningEfforts: efforts }
    }) }
  })
}

export function connectEditor(ctx, signal, load = fetchAccountModels) {
  let capabilities = new Map()
  let accountGeneration = 0
  let latest = 0
  const route = () => ctx.settings.describe({ redactSecrets: true }).find(item => item.ns === ns)?.value?.providers?.[provider]
  ctx.on('credentials/record-updated', changed => {
    if (changed === key) {
      accountGeneration++
      capabilities = new Map()
    }
  })
  decorate(ctx, ctx.llm, 'discoverModels', previous => async function (namespace, probe, requestSignal) {
    if (namespace !== ns || probe?.provider !== provider || probe.api || probe.apiKey || probe.baseURL || customRoute(route())) {
      return previous.apply(this, arguments)
    }
    const generation = accountGeneration
    const number = ++latest
    const scoped = requestSignal ? AbortSignal.any([signal, requestSignal]) : signal
    let models
    try {
      models = await load(ctx.credentials, scoped)
    } catch (error) {
      scoped.throwIfAborted()
      if (error.message === 'signin') throw new Error('请先登录 ChatGPT 或重新授权 / Sign in to ChatGPT')
      if (error.message === 'forbidden') throw new Error('当前账号无法访问模型目录 / Account access denied')
      throw new Error('未能获取账号模型，请重试 / Could not fetch account models')
    }
    scoped.throwIfAborted()
    if (generation !== accountGeneration) throw new Error('账号已变更，请重新获取模型 / Account changed')
    if (number === latest) capabilities = new Map(models.map(row => [row.id, row.reasoningEfforts]))
    return models.map(({ reasoningEfforts, ...candidate }) => candidate)
  })

  decorate(ctx, ctx.settings, 'mutate', previous => function (namespace, ops, revision) {
    if (namespace !== ns || !capabilities.size || customRoute(route())) return previous.apply(this, arguments)
    return previous.call(this, namespace, withAccountEfforts(ops, capabilities), revision)
  })
  return model => capabilities.get(model)
}
