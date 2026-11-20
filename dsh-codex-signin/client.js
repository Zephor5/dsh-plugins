window.__ModuleLoader__.load({
  id: 'dsh-codex-signin',
  factory(require) {
    const R = require('react')
    const { Button, Input, Modal, StateDot } = require('@deepseek-ai/dsh-client-ui-primitives')
    const { createPortal } = require('react-dom')
    const h = R.createElement
    const zh = {
      title: '登录 ChatGPT', login: '登录 ChatGPT', again: '重新授权', grant: 'ChatGPT 已授权',
      cancel: '取消', close: '关闭', open: '打开授权页面', submit: '提交', wait: '等待账号授权…',
      ok: '授权成功', cancelled: '已取消登录', failed: '操作失败，请重试',
      busy: '另一个登录正在进行', expired: '登录已过期，请重试', stale: '请回答最新的登录提示',
      unavailable: '当前 Harness 未提供 Codex 登录服务', invalid: '当前选项不可用',
      code: '设备码', method: '选择登录方式', browser: '浏览器登录', device: '设备码登录',
      callback: '授权码或回调地址', effort: '默认思考等级', auto: '跟随提供方',
      autosave: '自动保存', saving: '正在保存…', retry: '重试', noLevels: '无可选档位',
    }
    const en = {
      title: 'Sign in with ChatGPT', login: 'Sign in with ChatGPT', again: 'Reauthorize', grant: 'ChatGPT authorized',
      cancel: 'Cancel', close: 'Close', open: 'Open authorization page', submit: 'Submit', wait: 'Waiting for authorization…',
      ok: 'Authorized', cancelled: 'Sign-in cancelled', failed: 'Operation failed. Try again.',
      busy: 'A sign-in is already in progress', expired: 'Sign-in expired. Try again.', stale: 'Answer the current prompt.',
      unavailable: 'Codex sign-in is unavailable in this Harness', invalid: 'Selection unavailable',
      code: 'Device code', method: 'Choose a sign-in method', browser: 'Browser sign-in', device: 'Device code',
      callback: 'Authorization code or callback URL', effort: 'Default reasoning effort', auto: 'Provider default',
      autosave: 'Autosaved', saving: 'Saving…', retry: 'Retry', noLevels: 'No selectable levels',
    }
    const line = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }
    async function api(body, signal) {
      const response = await fetch(new URL('api/codex-signin', document.baseURI), {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || 'failed')
      return value
    }
    // rc.5 gives the plugin a provider-card slot. Portal into the expanded native
    // row using its row key and capacity field, within this provider card only.
    function useExpandedRows(anchor) {
      const [rows, setRows] = R.useState([])
      R.useLayoutEffect(() => {
        const scope = anchor.current?.closest('li') ?? anchor.current?.parentElement
        if (!scope) return
        let visible = []
        let frame = 0
        function scan() {
          frame = 0
          const next = []
          for (const row of scope.querySelectorAll('[data-row-key] > [data-expanded]')) {
            const id = row.querySelector(':scope > label input[type="text"]')
            const capacity = row.querySelector('input[inputmode="numeric"]')
            const label = capacity?.closest('label')
            if (!id?.value.trim() || !label?.parentElement) continue
            next.push({ model: id.value, key: row.parentElement.dataset.rowKey, target: label.parentElement,
              disabled: id.disabled, labelClass: label.className, captionClass: label.firstElementChild?.className,
              fieldClass: capacity.className })
          }
          if (visible.length === next.length && visible.every((item, i) =>
            item.target === next[i].target && item.model === next[i].model && item.disabled === next[i].disabled)) return
          visible = next
          setRows(next)
        }
        function schedule() {
          if (!frame) frame = requestAnimationFrame(scan)
        }
        const observer = new MutationObserver(schedule)
        observer.observe(scope, {subtree:true, childList:true, attributes:true, attributeFilter:['data-expanded','value','disabled']})
        scope.addEventListener('input',schedule)
        scan()
        return () => {
          observer.disconnect()
          cancelAnimationFrame(frame)
          scope.removeEventListener('input',schedule)
        }
      }, [anchor])
      return rows
    }

    function EffortField({ row, t }) {
      const [data, setData] = R.useState(null)
      const [pending, setPending] = R.useState(false)
      const [failed, setFailed] = R.useState(false)
      const [retry, setRetry] = R.useState(0)
      const live = R.useRef(false)
      R.useEffect(() => {
        live.current = true
        const controller = new AbortController()
        setFailed(false)
        api({op:'effort',model:row.model}, controller.signal).then(setData, () => {
          if (!controller.signal.aborted) setFailed(true)
        })
        return () => { live.current = false; controller.abort() }
      }, [row.model, retry])
      async function change(value) {
        setPending(true)
        setFailed(false)
        try {
          const saved = await api({op:'set-effort',model:row.model,value})
          if (live.current) setData(saved)
        } catch {
          if (live.current) setFailed(true)
        } finally {
          if (live.current) setPending(false)
        }
      }
      return h('div', {className:row.labelClass},
        h('label', {className:row.labelClass},
          h('span', {className:row.captionClass}, t('effort'), ' · ', t(pending ? 'saving' : 'autosave')),
          h('select', {className:row.fieldClass, value:data?.value ?? 'auto', disabled:row.disabled || pending || !data?.choices.length,
            'aria-label':t('effort') + ' · ' + row.model, onChange:e => void change(e.target.value)},
            h('option', {value:'auto'}, t(data && !data.choices.length ? 'noLevels' : 'auto')),
            data?.choices.map(id => h('option',{key:id,value:id},id)))),
        failed && h('span',{role:'alert'},t('failed'),' ',h(Button,{size:'sm',onClick:()=>setRetry(n=>n+1)},t('retry'))))
    }

    function Card({ provider, t }) {
      return provider.provider === 'openai-codex' ? h(Controls, { t }) : null
    }
    function Controls({ t }) {
      const anchor = R.useRef(null)
      const expanded = useExpandedRows(anchor)
      const [status, setStatus] = R.useState(null)
      const [flow, setFlow] = R.useState(null)
      const [input, setInput] = R.useState('')
      const [open, setOpen] = R.useState(false)
      const [message, setMessage] = R.useState('')
      const [busy, setBusy] = R.useState(false)
      const active = R.useRef(null)
      const dismissed = R.useRef(false)
      const lifetime = R.useRef(null)
      function failure(e) { setMessage(Object.hasOwn(en, e.message) ? e.message : 'failed') }
      R.useEffect(() => {
        const controller = new AbortController()
        lifetime.current = controller
        api({ op: 'status' }, controller.signal).then(setStatus, e => { if (!controller.signal.aborted) failure(e) })
        return () => {
          controller.abort()
          if (active.current) void api({ op: 'cancel', id: active.current }).catch(() => {})
          active.current = null
        }
      }, [])
      async function run(action) {
        const signal = lifetime.current.signal
        setBusy(true)
        setMessage('')
        try { await action(signal) } catch (e) { if (!signal.aborted) failure(e) }
        finally { if (!signal.aborted) setBusy(false) }
      }
      async function start(signal) {
        const id = crypto.randomUUID()
        active.current = id
        dismissed.current = false
        setInput('')
        try {
          let state = await api({ op: 'start', id }, signal)
          while (state.phase === 'waiting') {
            if (dismissed.current || signal.aborted) return
            setFlow(state)
            await new Promise(resolve => setTimeout(resolve, 500))
            if (signal.aborted) return
            state = await api({ op: 'poll', id }, signal)
          }
          setMessage(state.phase === 'authorized' ? 'ok' : state.phase === 'cancelled' ? 'cancelled' : 'failed')
          setStatus(await api({ op: 'status' }, signal))
          if (state.phase === 'authorized' || state.phase === 'cancelled') setOpen(false)
        } finally {
          void api({ op: 'cancel', id }).catch(() => {})
          if (active.current === id) {
            active.current = null
            setFlow(null)
          }
        }
      }
      async function reply(answer) {
        const q = flow?.question
        if (!q || !answer) return
        try {
          await api({ op: 'answer', id: active.current, question: q.id, answer }, lifetime.current.signal)
          setInput('')
        } catch (e) { failure(e) }
      }
      function close() {
        dismissed.current = true
        if (active.current) {
          void api({ op: 'cancel', id: active.current }).catch(failure)
        }
        setOpen(false)
      }
      const q = flow?.question
      const signed = status?.signedIn === true
      const launch = () => { setOpen(true); void run(start) }
      const options = q?.options ?? []
      const methodPicker = q?.kind === 'select' && options.every(o => ['browser', 'device_code'].includes(o.id))
      return h('div', { ref: anchor, 'aria-label': t('title'), style: line },
        expanded.map(row => createPortal(h(EffortField, {row, t, key:row.model}),row.target,row.key + '/' + row.model)),
        signed && h('span', { style: { ...line, fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } },
          h(StateDot, { state: 'done', size: 7 }), t('grant')),
        h(Button, { size: 'sm', variant: signed ? 'ghost' : 'outline', disabled: busy, onClick: launch },
          t(signed ? 'again' : 'login')),
        !open && message && !['ok', 'cancelled'].includes(message) && h('span', { role: 'status' }, t(message)),
        h(Modal, { open, title: t('title'), closeLabel: t('close'), onClose: close,
          footer: h(Button, { size: 'sm', onClick: close }, t(busy ? 'cancel' : 'close')) },
          flow?.notice && h('p', null, h('a', { href: flow.notice.url, target: '_blank', rel: 'noreferrer' }, t('open')),
            flow.notice.code && h('span', null, ' · ', t('code'), ' ', h('code', null, flow.notice.code))),
          q ? h('div', { key: q.id }, h('p', null, methodPicker ? t('method') : q.kind === 'select' ? q.message : t('callback')),
            q.kind === 'select' ? h('div', { style: line }, options.map((o, i) => h(Button, {
              key: o.id, size: 'sm', variant: i === 0 ? 'primary' : 'outline', onClick: () => reply(o.id),
            }, methodPicker ? t(o.id === 'browser' ? 'browser' : 'device') : o.label))) :
            h('form', { style: line, onSubmit: e => { e.preventDefault(); void reply(input) } },
              h(Input, { type: 'password', autoComplete: 'off', 'aria-label': t('callback'), value: input, onChange: e => setInput(e.target.value) }),
              h(Button, { type: 'submit', size: 'sm', variant: 'primary', disabled: !input }, t('submit')))) :
            h('div', { role: 'status' }, message ? t(message) : t('wait'))))
    }
    return { inject: ['slots', 'locale'], apply(ctx) {
      ctx.effect(() => ctx.locale.register('codexSignin', { en, zh }))
      ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
        name: 'settings.models.provider-card', key: 'llm-pi-ai', locale: 'codexSignin',
      }, Card))
    } }
  },
})
