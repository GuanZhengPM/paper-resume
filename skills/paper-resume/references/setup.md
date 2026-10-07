# 首次安装 CLI

skill 需要本机运行的 paper-resume 项目。已有 `installation.json` 时读取其中的 root，并确认该目录含 `cli.js`；路径失效时先寻找用户已安装的项目。不要重新创建简历库。

仅安装了独立 skill、尚无 CLI 时，在用户的本地应用目录安装 v1.1.0。需要 Node.js 22.13+、Git，以及用于预览和 PDF 的 Chrome 或 Edge。先检查这些依赖，不主动更改全局设置。下面是 macOS/Linux 示例；Windows 使用用户指定的本地目录，运行相同的 git/npm/node 命令。

```sh
git clone --branch v1.1.0 --depth 1 https://github.com/GuanZhengPM/paper-resume.git ~/.local/share/paper-resume
cd ~/.local/share/paper-resume
npm ci
node cli.js install-agent
node cli.js serve --port 8765
```

目录已存在时，先检查是否为本项目；不要覆盖或删除已有目录。其他用途的目录应换一个安装位置。已有项目需要升级时，先保留本地改动和简历，按用户的升级请求处理；不要直接 reset。`install-agent` 报告技能版本不同时，核对差异后使用 `--force` 更新，旧文件会备份。

安装完成后，CLI 会在 skill 目录写入仅属于本机的 `installation.json`。该文件不要打包或发布。回到 SKILL.md 继续用户原来的导入或内容优化请求，不停留在安装成功。
