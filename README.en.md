# dsh-plugins

[简体中文](README.md)

A collection of plugins for DeepSeek Harness (DSH). Each plugin can be installed independently. The project guides below include installation instructions.

| Plugin | What it does |
| --- | --- |
| [dsh-acp-one](https://github.com/Zephor5/dsh-acp-one/blob/4e22e553b4c8d71103b92bc5f270c74ddea61f0c/README.en.md) | Published as `dsh-acp-resume`. It lets DSH work with the same external subagent across turns and resume the session after a process restart. |
| [dsh-codex-signin](dsh-codex-signin/README.md) | Sign in with your ChatGPT account, configure available Codex models in DSH, and switch models or reasoning effort during a chat. Guide in Chinese. |
| [fixup-patches](fixup-patches/README.md) | Toggle individual patches per DSH profile, including a patch that prompts agents to reuse skills already loaded in context. Guide in Chinese. |

## Get the source

This repository includes `dsh-acp-one` as a Git submodule. Clone with `--recurse-submodules` to fetch all three projects.

```sh
git clone --recurse-submodules https://github.com/Zephor5/dsh-plugins.git
```

## License

[MIT](LICENSE)
