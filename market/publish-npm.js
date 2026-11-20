import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const site = fileURLToPath(new URL('./site/', import.meta.url))
const registry = 'https://registry.npmjs.org'
const index = JSON.parse(readFileSync(join(site, 'index.json'), 'utf8'))

for (const { name, versions: [entry] } of index.plugins) {
  const { version } = entry
  const metadata = JSON.parse(readFileSync(join(site, 'registry', name), 'utf8'))
  const { dist } = metadata.versions[version]
  const archive = join(site, 'registry', '-', basename(new URL(dist.tarball).pathname))
  const integrity = 'sha512-' + createHash('sha512').update(readFileSync(archive)).digest('base64')
  if (integrity !== dist.integrity) throw new Error(`Archive integrity mismatch for ${name}@${version}`)

  const response = await fetch(`${registry}/${encodeURIComponent(name)}`)
  const firstPublish = response.status === 404
  if (!response.ok && !firstPublish) throw new Error(`npm lookup for ${name}: HTTP ${response.status}`)
  if (!firstPublish) {
    const published = (await response.json()).versions[version]
    if (published) {
      if (published.dist.integrity !== integrity) throw new Error(`Different archive already published for ${name}@${version}`)
      console.log(`Already published ${name}@${version}`)
      continue
    }
  }

  const { NPM_BOOTSTRAP_TOKEN, ...env } = process.env
  if (firstPublish) {
    if (!NPM_BOOTSTRAP_TOKEN) throw new Error(`First publication of ${name} needs NPM_BOOTSTRAP_TOKEN or a maintainer to publish the release archive once.`)
    env.NODE_AUTH_TOKEN = NPM_BOOTSTRAP_TOKEN
  }
  const tag = version.split('+')[0].includes('-') ? 'next' : 'latest'
  execFileSync('npm', ['publish', archive, '--registry', registry, '--access', 'public', '--provenance', '--tag', tag, '--ignore-scripts'], { env, stdio: 'inherit' })
}
