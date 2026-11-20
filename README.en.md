# dsh-plugins

[简体中文](README.md)

A collection of plugins for DeepSeek Harness (DSH). Each plugin can be installed independently. The project guides below include installation instructions.

| Plugin | What it does |
| --- | --- |
| [dsh-acp-one](https://github.com/Zephor5/dsh-acp-one/blob/4e22e553b4c8d71103b92bc5f270c74ddea61f0c/README.en.md) | Published as `dsh-acp-resume`. It lets DSH work with the same external subagent across turns and resume the session after a process restart. |
| [@zephor/dsh-codex-signin](dsh-codex-signin/README.md) | Sign in with your ChatGPT account, configure available Codex models in DSH, and switch models or reasoning effort during a chat. Guide in Chinese. |
| [@zephor/dsh-fixup-patches](fixup-patches/README.md) | Toggle individual patches per DSH profile, including a patch that prompts agents to reuse skills already loaded in context. Guide in Chinese. |

## Add the index to DSH

Under **Plugins → Experimental plugins**, enable **Custom Plugin Index**. Open **Discover → Add index source** and paste the URL below. Once deployed, the index offers **Codex Sign-in** and **Fixup Patches**.

```text
https://zephor5.github.io/dsh-plugins/index.json
```

For the first deployment, select **GitHub Actions** under **Settings → Pages → Source** in the repository. Each release run checks the index with the DSH validator and deploys the index and installable archives to Pages.

### Plugin releases

Bump a plugin’s `package.json` version and push or merge the change to `main`. Update its lockfile if present. The workflow compares SemVer values before and after the entire push and packages, tests, and releases only the plugins whose versions increased. For example, bumping only `dsh-codex-signin` from `0.3.0` to `0.3.1` releases only `@zephor/dsh-codex-signin@0.3.1`. An edit to a description or dependency alone ends after the version check.

Each version gets a [GitHub Release](https://github.com/Zephor5/dsh-plugins/releases) tagged `package-name@version` with the tested `.tgz` attached. After npm publication succeeds, Pages rebuilds the index from each plugin’s highest published GitHub Release, reusing the existing archives. Once the workflow is in place, the next version bump triggers each existing plugin’s first release. An interrupted release can be retried by rerunning the original Actions run.

### Publish to the public npm registry

The same workflow publishes the tested archives for the selected versions to `registry.npmjs.org`. Stable versions use the `latest` tag and prereleases use `next`. A rerun checks the published SHA-512 digest, skips matching versions, and requires a version bump if the archive differs.

1. **First publication.** Add `NPM_BOOTSTRAP_TOKEN` under **Settings → Secrets and variables → Actions** in the GitHub repository. Use a short-lived npm granular access token with read and publish access to the `@zephor` scope and a publishing 2FA bypass. Alternatively, sign in to npm as a publisher, download the corresponding GitHub Release assets, and run `npm publish ./filename.tgz --access public --registry=https://registry.npmjs.org` once per archive.
2. **Subsequent versions** use GitHub Actions OIDC. For each npm package, open **Settings → Trusted publishing**, select **GitHub Actions**, enter repository `Zephor5/dsh-plugins` and workflow filename `plugin-index.yml`, allow `npm publish`, and leave the environment blank. After bootstrapping, remove the temporary GitHub secret and revoke the token on npm. Complete the first OIDC publish within npm’s activation window. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

To build locally, run the following commands from the repository root. The output is in `market/site/`, with `index.json` as the DSH entry point.

```sh
npm ci --prefix market
npm ci --prefix dsh-codex-signin
npm run build --prefix market
```

## Get the source

This repository includes `dsh-acp-one` as a Git submodule. Clone with `--recurse-submodules` to fetch all three projects.

```sh
git clone --recurse-submodules https://github.com/Zephor5/dsh-plugins.git
```

## License

[MIT](LICENSE)
