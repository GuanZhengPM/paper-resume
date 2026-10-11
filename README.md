# 纸页简历 / Paper Resume

> Local Markdown resume editor with deterministic one-page layout and agent collaboration.  
> 本地 Markdown 简历编辑器与单页排版工具：双栏实时预览真实 PDF 分页，自适应排版收敛至单页，支持 Agent 通过 CLI 协同润色与调整。

[简体中文](#简体中文) · [English](#english)

---

<a id="简体中文"></a>

## 简体中文

### 背景与解决的问题

制作高质量技术简历时，求职者通常面临两个突出的排版与协作问题：

1. **版面微调耗时且容易溢出**：在传统排版软件中，内容稍多两行就会溢出到第二页，手动反复缩减字号、微调行距与边距十分繁琐；
2. **缺乏与 AI Agent 协同的标准化接口**：借助大模型优化经历时，通常需要将内容反复在聊天窗口与编辑器之间复制粘贴，无法让 Agent 直接基于排版反馈进行结构化润色与原子级调整。

**纸页简历**（“纸页”谐音“职业”）通过以下设计解决上述问题：
* **结构与版面分离**：经历正文使用纯 Markdown 编写，右侧实时通过内置无头浏览器渲染**真实打印分页**的 PDF；
* **一键压成一页**：在预设的字号与边距安全边界内，通过确定性算法自适应压缩多余留白，将长经历规范收敛为单页纸简历；
* **原生面向 Agent 设计**：提供配套的 CLI 与 Agent Skill，支持 Codex / Claude 等 Agent 直接读取简历、诊断目标岗位匹配度、润色文字并协同微调排版。

---

### 快速开始

#### 环境要求
* Node.js 22.13+
* 系统安装有 Chrome 或 Edge 浏览器（用于精准 PDF 打印排版渲染）

#### 安装与本地运行

```sh
git clone https://github.com/GuanZhengPM/paper-resume.git
cd paper-resume
npm install
npm start
```

服务启动后，浏览器打开 `http://127.0.0.1:8765/index.html`。所有数据均保存在本地，无需注册账号。

---

### 与 Agent（Codex / Claude）协同使用

纸页简历提供了结构化的 Agent Skill 接口，实现“页面人工编辑”与“Agent 自动润色”无冲突协作：

#### 1. 安装 Agent 技能

在项目目录中运行：

```sh
node cli.js install-agent
```

#### 2. 典型协同场景

在 Codex 或对应 Agent 中上传原简历或直接对话：

* **导入并规整**：发送原简历并说明“*导入纸页简历并套用项目经理模板*”，Agent 会自动解析章节、整理经历结构并完成初版排版；
* **岗位诊断与润色**：发送目标岗位 JD 并说明“*结合该 JD 优化工作经历的成果表达，重点突出数据指标*”，Agent 会直接就地修改 Markdown 正文并保留版本草稿；
* **排版微调**：告知 Agent“*内容略微超出一页，帮我压缩到单页内*”，Agent 将调用 CLI 调整排版参数。

---

### Markdown 语法扩展说明

除支持标准 Markdown（标题、列表、加粗、斜体、超链接）外，纸页简历提供了专门的排版指令：

| 语法指令 | 用途说明 | 示例 |
| :--- | :--- | :--- |
| `::: center` / `::: right` | 块级对齐控制，以单独一行的 `:::` 结尾 | `::: center` ... `:::` |
| `::: row` | 经历分列排版，用 ` \|\| ` 分隔两列或三列 | `公司名 \|\| 岗位 \|\| 2024.01 - 至今` |
| `::: row 1:2:1` | 自定义三列宽度比例 | 控制公司、岗位、日期的宽度比 |
| `{size=10.5}` | 局部调整当前行字号（单位：pt） | `## 姓名 {size=14}` |
| `{rule=off}` | 关闭章节标题下方的分割横线 | `### 工作经历 {rule=off}` |
| `::: gap 2mm` | 手动在特定段落间插入固定空白 | 精细控制模块间距 |
| `::: keep` ... `:::` | 保护块内内容，避免在导出 PDF 时被硬性截断分页 | 保护重要经历完整留在同一页 |

#### 典型经历书写示例

```markdown
::: center
## 张三 {size=16}
138-0000-0000 | zhangsan@example.com | [GitHub](https://github.com/example)
:::

### 工作经历 {rule=on}

#### 示例公司
::: row
技术研发部 || 软件工程师 || 2024.01 - 至今
:::
- **系统性能优化**：负责核心业务链路优化，通过并发调度提升系统处理吞吐；
- **工程质量保障**：搭建自动化测试与验证流水线，降低回归异常率。
```

---

### 排版样式配置项

| 参数字段 | 可选范围 | 默认值 | 作用说明 |
| :--- | :--- | :--- | :--- |
| `fontFamily` | `serif` (宋体), `sans` (黑体), `times`, `arial` 等 | `sans` | 全局字体预设 |
| `fontSize` | 8–36 pt | 10.5 pt | 正文字号大小 |
| `lineHeight` | 1.0–2.0 | 1.35 | 正文行高倍数 |
| `marginVertical` | 6–30 mm | 12 mm | 页面上下边距 |
| `marginHorizontal` | 8–30 mm | 15 mm | 页面左右边距 |
| `experienceGap` | 0–15 mm | 3 mm | 不同公司经历之间的垂直间距 |
| `roleGap` | 0–10 mm | 1 mm | 同一公司内不同岗位的间距 |

---

### 致谢与版本贡献

纸页简历核心由 [GuanZhengPM](https://github.com/GuanZhengPM/paper-resume) 设计开发；v1.1.0 模板导入增强与双向编辑协同功能由 [Zhoeyi / zaozhiyi](https://github.com/zaozhiyi) 贡献合入。

### License

[MIT](LICENSE)

---

<a id="english"></a>

## English

### Overview

`Paper Resume` is a local-first Markdown resume editor designed for deterministic one-page auto-formatting and native AI agent collaboration. It renders exact PDF print previews in real-time, shrinks text margins adaptively to guarantee a single-page fit, and provides a structured CLI for LLM agents (Codex, Claude) to edit, diagnose, and polish resumes in-place.

### Problem Statement & Background

When crafting technical resumes, job seekers frequently face two frustrating workflow hurdles:

1. **Fragile Page-Overflow Formatting**: In standard word processors, an extra sentence often causes awkward overflow onto a second page. Manually tweaking font sizes, line heights, and margins to fit exactly one page is tedious and time-consuming.
2. **Lack of Standardized AI Collaboration**: While developers increasingly use LLMs (Codex, Claude) to polish resume bullet points, copying text back and forth between chat windows and formatting tools is disjointed. Agents cannot inspect layout constraints or make atomic, structured edits directly to the rendered document.

**Paper Resume** (named after the Chinese pun "纸页 / 职业" — transforming a career into a single page) solves these challenges:
* **Separation of Content and Layout**: Write content in pure Markdown while previewing **exact PDF print pagination** rendered live via headless Chromium.
* **Deterministic Single-Page Compression**: Within configurable safety bounds, automated layout algorithms adaptively compress margins and paragraph gaps to guarantee an elegant single-page fit without arbitrarily deleting content.
* **Native AI Agent Collaboration**: Bundles a structured CLI and Agent Skill allowing Codex / Claude to inspect structure, diagnose JD alignment, polish bullet points, and adjust layout atomically.

---

### Quick Start

#### Requirements
* Node.js 22.13+
* Chrome or Edge installed locally (used for pixel-perfect PDF print rendering)

#### Installation & Local Server

```sh
git clone https://github.com/GuanZhengPM/paper-resume.git
cd paper-resume
npm install
npm start
```

Open `http://127.0.0.1:8765/index.html` in your browser. All documents are stored locally with zero account requirements.

---

### Collaborating with Agents (Codex / Claude)

Paper Resume provides a structured Agent Skill interface, enabling seamless collaboration between manual browser edits and agent-driven adjustments:

#### 1. Install Agent Skill

Inside the repository root:

```sh
node cli.js install-agent
```

#### 2. Common Collaboration Scenarios

In Codex or compatible agent environments:

* **Ingest & Format**: Upload an existing resume and prompt: *"Import into Paper Resume and apply the software engineer template."* The agent parses sections, organizes structured experiences, and prepares the PDF layout.
* **Job Description Optimization**: Provide a target Job Description and prompt: *"Optimize the work experience bullet points for this JD, emphasizing measurable metrics."* The agent modifies the Markdown document directly, maintaining draft revisions.
* **Layout Compression**: Instruct the agent: *"The content slightly exceeds one page; compress margins to fit into a single page."* The agent adjusts layout properties via CLI.

---

### Custom Markdown Directives

In addition to standard Markdown (headings, lists, bold, italics, links), Paper Resume introduces specialized layout directives:

| Directive | Purpose | Example |
| :--- | :--- | :--- |
| `::: center` / `::: right` | Block alignment controls (closed with a standalone `:::`) | `::: center` ... `:::` |
| `::: row` | Multi-column experience row separated by ` \|\| ` | `Company \|\| Role \|\| 2024.01 - Present` |
| `::: row 1:2:1` | Custom column width ratios | Controls company, role, and date width ratios |
| `{size=10.5}` | Inline font size adjustment (in pt) | `## Name {size=14}` |
| `{rule=off}` | Disables horizontal divider beneath headings | `### Experience {rule=off}` |
| `::: gap 2mm` | Inserts fixed vertical whitespace between sections | Fine-grained section spacing |
| `::: keep` ... `:::` | Prevents block content from being broken across page splits | Keeps key experiences intact on one page |

#### Example Usage

```markdown
::: center
## Zhang San {size=16}
138-0000-0000 | zhangsan@example.com | [GitHub](https://github.com/example)
:::

### Experience {rule=on}

#### Example Tech Corp
::: row
Engineering Team || Software Engineer || 2024.01 - Present
:::
- **Performance Optimization**: Spearheaded core pipeline optimizations, improving concurrency throughput;
- **Quality Assurance**: Established end-to-end regression testing suites, minimizing production incidents.
```

---

### Style Configuration Properties

| Property | Values / Range | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `fontFamily` | `serif`, `sans`, `times`, `arial`, etc. | `sans` | Global typography preset |
| `fontSize` | 8–36 pt | 10.5 pt | Base font size |
| `lineHeight` | 1.0–2.0 | 1.35 | Body text line-height multiplier |
| `marginVertical` | 6–30 mm | 12 mm | Top and bottom page margins |
| `marginHorizontal` | 8–30 mm | 15 mm | Left and right page margins |
| `experienceGap` | 0–15 mm | 3 mm | Vertical gap between different companies |
| `roleGap` | 0–10 mm | 1 mm | Vertical gap between roles within the same company |

---

### Acknowledgements

Paper Resume was originally created by [GuanZhengPM](https://github.com/GuanZhengPM/paper-resume); v1.1.0 template ingestion enhancements and bi-directional editing workflows were contributed by [Zhoeyi / zaozhiyi](https://github.com/zaozhiyi).

### License

[MIT](LICENSE)
