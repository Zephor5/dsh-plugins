import { execFileSync } from 'node:child_process'
import semver from 'semver'

function versionAt(ref, path) {
  if (!execFileSync('git', ['ls-tree', '--name-only', ref, '--', path], { encoding: 'utf8' }).trim()) return null
  const { version } = JSON.parse(execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' }))
  if (!semver.valid(version)) throw new Error(`Invalid version in ${ref}:${path}`)
  return version
}

const before = process.argv[2]
if (!/^[0-9a-f]{40}$/.test(before)) throw new Error('Expected the commit SHA before the push')
const changed = ['dsh-codex-signin', 'fixup-patches'].filter(directory => {
  const path = `${directory}/package.json`
  const current = versionAt('HEAD', path)
  const previous = /^0+$/.test(before) ? null : versionAt(before, path)
  return current !== null && (previous === null || semver.gt(current, previous))
})
console.log(JSON.stringify(changed))
