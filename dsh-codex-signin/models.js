import { key } from './login.js'

export const provider = 'openai-codex'
const catalogURL = 'https://chatgpt.com/backend-api/codex/models?client_version=0.169.0'
const supported = new Set(['minimal', 'low', 'medium', 'high', 'xhigh', 'max'])

/** Keep the provider's wire spelling and only advertise efforts supported by Harness. */
export function accountModels(payload) {
  if (!Array.isArray(payload?.models)) throw new Error('catalog')
  const rows = new Map()
  for (const item of payload.models) {
    if (item?.visibility !== 'list' || typeof item.slug !== 'string' || !item.slug) continue
    const map = {}
    for (const level of item.supported_reasoning_levels ?? []) {
      if (supported.has(level?.effort)) map[level.effort] = level.effort
      else if (level?.effort === 'none') map.off = 'none'
    }
    const modalities = item.input_modalities?.filter(v => v === 'text' || v === 'image')
    const window = Number.isSafeInteger(item.context_window) && item.context_window > 0 ? item.context_window : null
    rows.set(item.slug, {
      id: item.slug, name: item.display_name || item.slug,
      ...(window ? { contextWindow: window } : {}),
      ...(modalities?.length ? { inputModalities: modalities } : {}),
      ...(Array.isArray(item.supported_reasoning_levels) ? {
        reasoningEfforts: Object.keys(map).some(k => k !== 'off') ? map : false,
      } : {}),
    })
  }
  return [...rows.values()]
}

export async function fetchAccountModels(credentials, signal, request = fetch) {
  const record = await credentials.readRecord(key)
  const grant = record?.kind === 'grant' && record.payload
  if (typeof grant?.access !== 'string' || !grant.access) throw new Error('signin')
  const response = await request(catalogURL, {
    headers: { Authorization: 'Bearer ' + grant.access,
      ...(grant.accountId ? { 'ChatGPT-Account-Id': grant.accountId } : {}) },
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]), redirect: 'error',
  })
  if (response.status === 401) throw new Error('signin')
  if (response.status === 403) throw new Error('forbidden')
  if (!response.ok) throw new Error('catalog')
  return accountModels(await response.json())
}
