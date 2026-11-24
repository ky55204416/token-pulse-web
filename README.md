# 智脉 · TOKEN PULSE

[**打开智脉网页版**](https://ky55204416.github.io/token-pulse-web/)

在一张看板里查看 Codex、Claude Code 和 Workbuddy 的 Token 用量、模型分布与推理强度。每一次 Token 消耗，都是 AI 的一次心跳。

## 自动查看本机用量

1. 下载 [Windows 版](https://ky55204416.github.io/token-pulse-web/token-pulse-windows.zip) 或 [Mac 版](https://ky55204416.github.io/token-pulse-web/token-pulse-mac.zip)，解压后双击启动文件。Windows 使用「Start Token Pulse.cmd」，Mac 使用「打开我的算力看板.command」。两版均需 Node.js 22.15 或更新版本。更新时先退出正在运行的旧版。
2. 保持本机版运行，在网页点击「刷新本机数据」，再在本机页面选择「允许并打开网页版」。也可以在本机看板点击「连接网页版」。
3. 授权后，在网页版点击「刷新本机数据」，自动加载近 30 天用量。如浏览器询问是否允许连接本机网络，选择允许。

## 备份与导入

Windows 和 Mac 本机看板均可从「历史与备份」创建轻量或完整备份、选择保存位置、导入智脉备份文件并恢复已归档的附件。备份使用相同的 `.compute-backup` 格式。已有加密备份用原密码打开。

原始日志、对话内容、项目名称和文件路径保留在本机。公开网页可体验示例、读取已授权的本机用量汇总或手动导入已有的智脉摘要。

段位体系参考 [TokenBurn](https://github.com/yibeigen/tokenburn)。上游许可见 [TokenBurn-LICENSE.txt](./TokenBurn-LICENSE.txt)。
