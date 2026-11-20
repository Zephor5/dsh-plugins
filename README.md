# dsh-plugins

[English](README.en.md)

这里汇集了 DeepSeek Harness（DSH）的插件。各插件可独立安装，安装步骤见下表中的项目文档。

| 插件 | 用途 |
| --- | --- |
| [dsh-acp-one](https://github.com/Zephor5/dsh-acp-one/blob/4e22e553b4c8d71103b92bc5f270c74ddea61f0c/README.md) | 以 `dsh-acp-resume` 包发布，让 DSH 与同一个外部子代理持续多轮对话，并在进程重启后恢复会话。 |
| [dsh-codex-signin](dsh-codex-signin/README.md) | 使用 ChatGPT 账号登录，在 DSH 中配置可用的 Codex 模型，并在聊天时切换模型和思考强度。 |
| [fixup-patches](fixup-patches/README.md) | 可为每个 DSH profile 单独启停补丁，例如提示模型复用上下文中已加载的技能。 |

## 获取源码

`dsh-acp-one` 以 Git 子模块引入。克隆时加上 `--recurse-submodules` 即可一次获取三个项目的源码。

```sh
git clone --recurse-submodules https://github.com/Zephor5/dsh-plugins.git
```

## 许可证

[MIT](LICENSE)
