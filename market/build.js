import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMarketIndex } from '@deepseek-ai/dsh-plugin-market-index'
import semver from 'semver'

const root = fileURLToPath(new URL('../', import.meta.url))
const repository = 'https://github.com/Zephor5/dsh-plugins'
const baseUrl = new URL(process.env.MARKET_BASE_URL || 'https://zephor5.github.io/dsh-plugins/')
const archiveBaseUrl = new URL('registry/-/', baseUrl)
const site = fileURLToPath(new URL('./site/', import.meta.url))
const archives = join(site, 'registry', '-')
mkdirSync(archives, { recursive: true })
const plugins = [
  {
    directory: 'dsh-codex-signin',
    title: { zh: 'Codex 登录', en: 'Codex Sign-in' },
    description: {
      zh: '通过 ChatGPT 账号登录，在 DSH 中配置和切换 Codex 模型与思考强度。',
      en: 'Sign in with ChatGPT and switch Codex models and reasoning effort in DSH.',
    },
  },
  {
    directory: 'fixup-patches',
    title: { zh: 'Fixup 补丁集', en: 'Fixup Patches' },
    description: {
      zh: '按 DSH profile 单独启停补丁，例如提示模型复用已加载的技能。',
      en: 'Toggle patches per DSH profile, including a prompt to reuse loaded skills.',
    },
  },
]

function archivePrefix(name, version) {
  return `${name.replace(/^@/, '').replace('/', '-')}-${version}-`
}

function pack(directory) {
  const cwd = join(root, directory)
  const manifest = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  if (!manifest.dsh?.bundle) throw new Error(`Missing dsh.bundle in ${directory}/package.json`)
  const timestamp = Number(execFileSync('git', ['log', '-1', '--format=%ct', 'HEAD', '--', directory], { cwd: root, encoding: 'utf8' }).trim())
  const [archive] = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', archives], { cwd, encoding: 'utf8' }))
  for (const name of manifest.bundleDependencies ?? []) {
    if (!archive.bundled.includes(name)) throw new Error(`Missing bundled dependency ${name} in ${archive.filename}`)
  }
  const filename = archivePrefix(manifest.name, manifest.version) + archive.shasum + '.tgz'
  renameSync(join(archives, archive.filename), join(archives, filename))
  return { manifest, timestamp, filename, integrity: archive.integrity, shasum: archive.shasum }
}

function releasedPackage(directory, releases) {
  const { name } = JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8'))
  const prefix = name + '@'
  const candidates = releases.filter(r => !r.draft && r.tag_name.startsWith(prefix) && semver.valid(r.tag_name.slice(prefix.length)))
  candidates.sort((a, b) => semver.rcompare(a.tag_name.slice(prefix.length), b.tag_name.slice(prefix.length)))
  const release = candidates[0]
  if (!release) return null

  const version = release.tag_name.slice(prefix.length)
  const asset = release.assets.find(a => a.name.startsWith(archivePrefix(name, version)) && a.name.endsWith('.tgz'))
  if (!asset) throw new Error(`Missing package archive in ${release.tag_name}`)
  const archive = join(archives, asset.name)
  execFileSync('gh', ['release', 'download', release.tag_name, '--pattern', asset.name, '--output', archive, '--clobber'])
  const bytes = readFileSync(archive)
  if ('sha256:' + createHash('sha256').update(bytes).digest('hex') !== asset.digest) throw new Error(`Asset digest mismatch for ${asset.name}`)
  const manifest = JSON.parse(execFileSync('tar', ['-xOzf', archive, 'package/package.json'], { encoding: 'utf8' }))
  if (manifest.name !== name || manifest.version !== version) throw new Error(`Archive and release disagree for ${release.tag_name}`)
  return {
    manifest, filename: asset.name, timestamp: Math.floor(Date.parse(release.published_at) / 1000),
    integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64'),
    shasum: createHash('sha1').update(bytes).digest('hex'),
  }
}

function pluginEntry({ directory, title, description }, { manifest, timestamp, filename, integrity, shasum }) {
  const dist = { tarball: new URL(filename, archiveBaseUrl).href, integrity, shasum }
  const metadata = {
    name: manifest.name,
    'dist-tags': { latest: manifest.version },
    versions: { [manifest.version]: { ...manifest, dist } },
    time: { [manifest.version]: new Date(timestamp * 1000).toISOString() },
  }
  const metadataPath = join(site, 'registry', manifest.name)
  mkdirSync(dirname(metadataPath), { recursive: true })
  writeFileSync(metadataPath, JSON.stringify(metadata) + '\n')
  const compatibility = manifest.engines?.dsh ?? manifest.dsh.compatibility?.dsh
  return {
    name: manifest.name,
    title,
    description,
    homepage: `${repository}/tree/main/${directory}#readme`,
    repository: { url: repository, directory },
    versions: [{
      version: manifest.version,
      publishTimestamp: timestamp,
      source: { type: 'npm' },
      ...(compatibility && { engines: { dsh: compatibility } }),
    }],
  }
}

const released = process.argv.includes('--released')
const releases = released ? JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', 'repos/{owner}/{repo}/releases?per_page=100'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })).flat() : []
const selected = process.env.RELEASE_PLUGINS ? JSON.parse(process.env.RELEASE_PLUGINS) : plugins.map(p => p.directory)
const entries = []
for (const plugin of plugins) {
  if (!released && !selected.includes(plugin.directory)) continue
  const archive = released ? releasedPackage(plugin.directory, releases) : pack(plugin.directory)
  if (archive) entries.push(pluginEntry(plugin, archive))
}
// Agent Context is released by its own repository. Full indexes discover the
// installable npm version; package publication jobs only process local archives.
if (released || !process.env.RELEASE_PLUGINS) {
  const name = '@zephor/dsh-agent-context'
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`)
  if (!response.ok) throw new Error(`Cannot read ${name} metadata: HTTP ${response.status}`)
  const metadata = await response.json()
  const version = metadata['dist-tags'].latest
  const manifest = metadata.versions[version]
  if (manifest?.name !== name || !manifest.dsh?.bundle) throw new Error(`Invalid DSH bundle: ${name}@${version}`)
  entries.push({
    name,
    title: { zh: 'Agent Context · 个人知识库', en: 'Agent Context · Personal wiki' },
    description: {
      zh: '在 DSH 中检索知识、追加记录并共享本机黑板。首次使用会初始化知识库，已有配置会优先复用。',
      en: 'Search your knowledge, capture notes, and share a local blackboard in DSH. Existing settings take priority; first-time users get a new vault.',
    },
    homepage: 'https://github.com/Zephor5/agent-context/tree/main/integrations/dsh#readme',
    repository: { url: 'https://github.com/Zephor5/agent-context', directory: 'integrations/dsh' },
    versions: [{
      version, publishTimestamp: Math.floor(Date.parse(metadata.time[version]) / 1000),
      source: { type: 'npm' }, engines: { dsh: manifest.engines.dsh },
    }],
  })
}
const index = {
  format: 1,
  title: { zh: 'Zephor5 的 DSH 插件', en: 'DSH plugins by Zephor5' },
  plugins: entries,
}
parseMarketIndex(index, new URL('index.json', baseUrl).href)
writeFileSync(join(site, 'index.json'), JSON.stringify(index, null, 2) + '\n')
