# dsh-plugins

[English](README.en.md)

这里汇集了 DeepSeek Harness（DSH）的插件。各插件可独立安装，安装步骤见下表中的项目文档。

| 插件 | 用途 |
| --- | --- |
| [dsh-acp-one](https://github.com/Zephor5/dsh-acp-one/blob/4e22e553b4c8d71103b92bc5f270c74ddea61f0c/README.md) | 以 `dsh-acp-resume` 包发布，让 DSH 与同一个外部子代理持续多轮对话，并在进程重启后恢复会话。 |
| [@zephor/dsh-codex-signin](dsh-codex-signin/README.md) | 使用 ChatGPT 账号登录，在 DSH 中配置可用的 Codex 模型，并在聊天时切换模型和思考强度。 |
| [@zephor/dsh-fixup-patches](fixup-patches/README.md) | 可为每个 DSH profile 单独启停补丁，例如提示模型复用上下文中已加载的技能。 |
| [@zephor/dsh-agent-context](https://github.com/Zephor5/agent-context/tree/main/integrations/dsh) | 在 DSH 中管理个人知识库和黑板。安装包自带 CLI，复用已有知识库或在首次启用时创建。 |

## 在 DSH 中添加插件索引

在「插件 → 实验性插件」启用「自定义插件索引」，然后在「发现 → 添加索引源」填入以下地址。部署后可从这个源安装 **Codex 登录**、**Fixup 补丁集**和 **Agent Context**。

```text
https://zephor5.github.io/dsh-plugins/index.json
```

首次部署时，在仓库的 **Settings → Pages → Source** 选择 **GitHub Actions**。DSH 从 Pages 读取索引，按当前 profile 选择的 npm 安装源获取插件和依赖，支持用户配置的镜像。每次正式发布后，工作流会校验并更新索引。仅修订索引时，可运行 `gh workflow run plugin-index.yml --ref main`，从已有 Release 重建 Pages。

Agent Context 在其源码仓库独立发布。正式版本在公共 npm 可下载后，发布工作流会主动触发本仓库的索引刷新。也可随时手动运行上述工作流。

### 插件发布

将插件的 `package.json` 版本号提高并推送或合并到 `main` 即可发版。有锁文件的插件需同步更新锁文件。工作流比较整次推送前后的 SemVer，只打包、测试并发布版本提高的插件。例如，只有 `dsh-codex-signin` 从 `0.3.0` 升到 `0.3.1` 时，只发布 `@zephor/dsh-codex-signin@0.3.1`。仅修改包描述或依赖时，版本检查后即结束。

每个版本对应一个以 `包名@版本` 为标签的 [GitHub Release](https://github.com/Zephor5/dsh-plugins/releases)，附带通过安装检查的 `.tgz`。npm 发布成功后，Pages 从两个插件各自的最高已发布 GitHub Release 重建索引，沿用其他插件原有的安装包。首次上线工作流后，现有插件从下一次升版开始发布。发布中断时可在 Actions 里重跑原来的运行。

### 发布到公共 npm

同一次工作流还会把本次升版的 Release 安装包原样发布到 `registry.npmjs.org`。正式版本使用 `latest`，预发布版本使用 `next`。重跑时，CI 对比已发布版本的 SHA-512，内容相同就跳过，内容有变化则要求更新版本号。

1. **首次发布**前，在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 添加 `NPM_BOOTSTRAP_TOKEN`。使用短期 npm granular access token，将包读写和发布权限限定到 `@zephor` 作用域，并启用发布时绕过 2FA。也可以用有发布权限的 npm 账号下载对应的 GitHub Release 附件，逐个执行 `npm publish ./文件名.tgz --access public --registry=https://registry.npmjs.org` 完成首发。
2. **后续版本**使用 GitHub Actions OIDC。在 npm 上分别打开两个包的 **Settings → Trusted publishing**，选择 **GitHub Actions**，仓库填 `Zephor5/dsh-plugins`，工作流文件名填 `plugin-index.yml`，允许 `npm publish`，环境名留空。首发完成后删除 GitHub 中的临时 secret 并在 npm 撤销令牌。新建的信任配置需在 npm 规定的有效期内完成首次 OIDC 发布。详见 [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)。

本地构建时，在仓库根目录依次运行以下命令。输出位于 `market/site/`，其中 `index.json` 是 DSH 读取的入口。

```sh
npm ci --prefix market
npm ci --prefix dsh-codex-signin
npm run build --prefix market
```

## 获取源码

`dsh-acp-one` 以 Git 子模块引入。克隆时加上 `--recurse-submodules` 即可一次获取三个项目的源码。

```sh
git clone --recurse-submodules https://github.com/Zephor5/dsh-plugins.git
```

## 许可证

[MIT](LICENSE)
