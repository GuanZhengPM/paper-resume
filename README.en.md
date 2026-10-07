# Paper Resume / 纸页简历

[中文](README.md)

## Changes in this fork

Maintained by [Zhoeyi / zaozhiyi](https://github.com/zaozhiyi), based on [GuanZhengPM/paper-resume](https://github.com/GuanZhengPM/paper-resume). This fork connects structured template imports, crisp PDF previews with direct image dragging/resizing, and role-aware Codex content consultation on the same editable resume. It adds revision-checked CLI operations and an installable companion skill.

The pre-change baseline is `e59799b`; the implementation is authored by this account and was also contributed upstream through [PR #1](https://github.com/GuanZhengPM/paper-resume/pull/1). The original project documentation and license are retained below.


Paper Resume is a local resume editor. Content is stored as Markdown. Edit it in the browser or ask your own agent to use the CLI. The preview shows actual PDF pages and uses the same PDF as the download.

The Chinese name, 纸页 (zhiye, “a sheet of paper”), sounds like 职业 (zhiye, “career”). It represents a career story on a one-page resume.

When writing a resume, focus on explaining your experience and results. Your agent can choose a template that suits the content, use the CLI to adjust its layout, and fit it onto one page when needed. Let the agent handle template customization so you can spend your attention on what the resume says.

![Four resume examples](docs/resume-examples.png)

The image shows design examples. See the current template styles and actual pagination in these PDFs: [work and projects](docs/templates/projects.pdf), [internships and campus](docs/templates/internship.pdf), [research and publications](docs/templates/academic.pdf), [Chinese/English](docs/templates/bilingual.pdf). The portrait is a generated fictional character.

## Getting started

Install Node.js 22.13 or later and Chrome or Edge. PDF generation and layout tests require a browser; basic CLI editing does not. Download or clone this repository, then run from its directory:

```sh
npm install
npm start
```

Open [the local page](http://127.0.0.1:8765/index.html). No account is needed. The server listens only on localhost and shows the template gallery when no resume exists. A document is saved after creating or uploading a resume. To use another port:

```sh
node cli.js serve --file resume.paper.json --port 8766
```

The tool searches for Chrome or Edge on Windows and macOS and common Chromium paths on Linux. Set `PAPER_BROWSER_PATH` for a different location, or pass it when rendering:

```sh
node cli.js render --browser-path "/path/to/chrome" --output output/preview
```

## Using Codex

[Download v1.1.0 and the standalone skill](https://github.com/GuanZhengPM/paper-resume/releases/tag/v1.1.0). The skill archive includes first-use instructions for installing the companion CLI. If you already have the project, use the command below.

Run `node cli.js install-agent` in this repository to install the `paper-resume` skill. New Codex conversations can discover it; an existing conversation can read `skills/paper-resume/SKILL.md` directly.

Upload a resume and ask to import it. The host agent reviews the source, repairs reading order and broken paragraphs, maps experience fields, applies a chosen template, verifies the PDF, and opens the editable document. The CLI exposes `intake`, `import --structure`, `show --structured`, and revision-checked block edits. Manual and AI edits share the current Markdown document. No additional model API is needed.

Browser uploads automatically repair common line breaks and apply template presets, but do not invoke the host model. Use Codex for scans, complex columns, and image text. Templates allow natural pagination; one-page fitting is explicit. Originals and previous versions remain local.

## Content optimization

Ask Codex to improve a resume for a target role or JD, or request conservative wording only. The installed skill reads the current resume, diagnoses specific gaps, asks about missing responsibilities and results, and produces before/after suggestions with reasons and source references. It supports role-specific guidance and a `plain` mode without forced quantification. The host agent performs the reasoning; no separate model API is required.

```bash
node cli.js content --id ID --target 'Product manager' --role product --mode impact --output tmp/content-input.json
node cli.js content --id ID --action preview --plan tmp/content-plan.json --output tmp/content-review.md
node cli.js content --id ID --action apply --plan tmp/content-plan.json --select c1,c3 --dry-run
node cli.js content --id ID --action apply --plan tmp/content-plan.json --select c1,c3
node cli.js render --id ID --output output/content-updated
```

Optional `--jd` and `--brief` accept UTF-8 text files. The proposal schema is returned by `schema` and the preparation command. Preview does not mutate the resume; apply checks its revision, saves a backup, and preserves unrelated text and settings. Unresolved suggestions, example placeholders, and unsupported new numbers cannot be applied. Quote and number checks do not establish factual truth; the agent must verify meaning, ownership and user-supplied facts. Content consultation happens in the Codex conversation, while manual editing and PDF preview remain in the browser.

Uploading in the browser imports and lays out the resume; it does not automatically rewrite content. In Codex, name the uploaded resume and ask to optimize it for a target role. Ask for suggestions only if you do not want edits applied. Both interfaces use the same document.

## Using the page

With no resumes, the app opens the home page. Otherwise a link without a resume ID restores the last edited resume. The brand and logo return to home from the editor and are inactive on home. Starting the server does not create a sample resume.

The gallery offers work/projects, internships/campus activities, research/publications, and Chinese/English samples. Select a template and start with the sample or upload an existing resume. Each creation makes a separate document. Templates arrange real sections and apply typography, margins, and entry layout; manual customization remains available.

Uploads accept text-based PDF, DOCX, Markdown, TXT, and this tool's JSON documents, up to 25MB. Convert older `.doc` files to `.docx` first. Check imported content, especially multi-column reading order and Word text boxes. There is no built-in OCR; an agent or user must transcribe scans. An unambiguous small header portrait is imported automatically from PDF or DOCX; other images and ambiguous layouts need review.

The editor is on the left and the PDF on the right. One Enter inserts a line break; two leave a blank line. Select text to apply bold, italic, underline, or a link, or use Markdown. Images can be PNG, JPEG, or WebP up to 2MB. Portraits go at the top right; logos can be attached to a heading.

The style panel adjusts fonts, line height, margins, and spacing. Automatic layout removes excess blank lines and adjusts type size and spacing, including on short documents. A one-page compression button appears when the resume exceeds one page. If it cannot fit within the minimum sizes and margins, the operation reports failure and keeps the original content.

The document name defaults to its first heading, normally the person's name. Click the top name to rename a version. Explicit names remain unchanged when the content's name changes. The header, sidebar, and PDF download share the same name. Use the sidebar to switch or create versions.

Changes save automatically; browser drafts are restored after refresh. Concurrent CLI/browser edits are checked for conflicts and unsaved drafts are retained. The first PDF starts a background browser; later requests reuse its page and cached results.

## Markdown layout

Standard headings, lists, bold, and italic are supported. Underline uses `++text++`; `---` inserts a horizontal rule. A heading's rule can be controlled separately.

```markdown
::: center
## Example Name {size=16 rule=off}
Phone | Email | [GitHub](https://github.com/example)
:::

### **Experience** {size=12 rule=on}
#### **Example Company**
::: row
Department A || Product Manager || 2024.01 - 2025.01
:::
Description and achievements.
::: row
Department B || Senior Product Manager || 2025.02 - Present
:::
- **Result**: Describe the actual work here.
```

| Syntax | Accepted values and behavior |
| --- | --- |
| `::: left`, `::: center`, `::: right` | Alignment blocks; close with `:::` on its own line |
| `::: row` | Two or three columns, separated by `space + \|\| + space`; two align left/right, three align left/center/right |
| `::: row 1:2:1` | Three-column width ratios; each integer is 1–9 |
| `{size=10.5}` | Local size, 8–36pt; decimals accepted |
| `{align=center}` | `left`, `center`, or `right` |
| `{rule=off}` | Heading rule: `on` or `off` |
| `{underline=on}` | Text underline: `on` or `off` |
| `::: gap 2mm` | Extra space, value 0–40; also accepts `pt` and `px` |
| `::: page` | Start a new page |
| `::: page-spacing 1mm` | Extra spacing for this page, 0–20mm; resets at the next page break and is recalculated by automatic layout |
| `::: keep`…`:::` | Try to keep the block on one page |

Put attributes at the end of a line, for example `{size=11 align=center rule=off}`. Multiple spaces are preserved. HTML and scripts are not executed; unsupported attributes appear as text.

Each nonempty row-block line must have two or three columns. Keep descriptions outside row blocks. For several departments in one company, use one company heading and one row block per department. Later department rows use role spacing; the next company uses company spacing. Extra blank lines add space.


Company, team, and role can share a line, with the date aligned right:

```md
### **Example Company** · Product Team · Product Manager | 2024.01 - Present
```

Alternatively, put the city beside the company and the role and date on the next line:

```md
### **Example Company** | Beijing
::: row
Product Team · Product Manager || 2024.01 - Present
:::
```

The CLI can create two or three columns atomically. Each cell supports its own alignment and size. A city is ordinary text and can be placed in any cell:

```json
{"op":"row","target":{"text":"Unique entry title"},"cells":["**Example Company**","Product Team · Product Manager","2024.01 - Present · Beijing"],"widths":"2:3:2"}
```

## Settings and accepted values

Enum fields accept only listed values. Numeric fields accept decimals within their ranges, regardless of the browser input's step size. Global font size uses listed sizes; local text size accepts decimals from 8 to 36.

| Field | Values or range | Meaning |
| --- | --- | --- |
| `fontFamily` | `serif`, `sans`, `yahei`, `times`, `arial`, `calibri`, `simsun`, `kaiti`, `fangsong` | Preset or installed font name; see below |
| `fontSize` | 8–36, decimals accepted | Body size, pt |
| `lineHeight` | 1–2 or `""` | Line-height multiplier; empty inherits density |
| `experienceInner` | 0–6 | Paragraph spacing within an entry, mm |
| `roleGap` | 0–10 or `""` | Department/role spacing within a company, mm; defaults to 1mm |
| `experienceGap` | 0–15 | Space between companies, mm |
| `marginVertical` | 6–30 | Default top/bottom margins, mm |
| `marginTop`, `marginBottom` | 6–30 or `""` | Override each margin; empty inherits `marginVertical` |
| `marginHorizontal` | 8–30 | Left/right margins, mm |
| `pageSpacing` | 0–20 or `""` | Extra space from automatic layout, mm; empty removes it |
| `density` | `compact`, `normal`, `airy` | Default line/list spacing; explicit `lineHeight` takes precedence |
| `theme` | `ink`, `forest`, `navy` | Black, green, or blue accent |
| `targetPages` | 1, 2, 3 | Target in CLI reports; does not force pagination |
| `showGuides` | `true`, `false` | Legacy field; no visible effect in the current UI |

| Font value | Typeface |
| --- | --- |
| `serif` | Noto Serif SC, with Times New Roman preferred for Latin |
| `sans` | Noto Sans SC |
| `yahei` | Microsoft YaHei |
| `times` | Times New Roman |
| `arial` | Arial |
| `calibri` | Calibri |
| `simsun` | SimSun |
| `kaiti` | KaiTi |
| `fangsong` | FangSong |

Noto Chinese fonts are bundled. Other fonts must be installed locally; missing fonts fall back to bundled ones. A different computer may change line breaks. PDFs embed the fonts used. Proprietary fonts are not distributed.

Save settings as `settings.json` to avoid shell-specific JSON quoting:

```json
{
  "fontFamily": "yahei",
  "fontSize": 10.5,
  "lineHeight": 1.31,
  "experienceInner": 0.5,
  "roleGap": 0.75,
  "experienceGap": 2,
  "marginTop": 10,
  "marginBottom": 10
}
```

```sh
node cli.js settings --file resume.paper.json --patch settings.json
```

## CLI and agents

The CLI does not call a model. Give natural-language instructions to your own agent, which reads the document and runs commands. Start with [AGENT_GUIDE.md](AGENT_GUIDE.md), read the revision, apply a batch, then render and inspect the result. Computer Use can inspect page interactions; normal editing can use the CLI. The detailed agent and CLI guides are currently in Chinese.

```sh
node cli.js list
node cli.js create --template projects
node cli.js show --id DOCUMENT_ID --summary
node cli.js show --id DOCUMENT_ID --lines
node cli.js rename --id DOCUMENT_ID --name "Example Name - Product role"
```

Replace `DOCUMENT_ID` with an ID from `create` or `list`. Without `--id`, commands use `resume.paper.json`. Use `--file` for another path. Omitting the name in `create` uses the person's name.

Obtain `revision` with `show` and copy it into `expectedRevision`. Save this as `changes.json`, replacing the heading and old text with content from your document:

```json
{
  "expectedRevision": "COPY_REVISION_FROM_SHOW",
  "operations": [
    {"op":"style","target":{"heading":"Experience"},"style":{"level":3,"bold":true,"rule":"on"}},
    {"op":"settings","values":{"roleGap":0.75,"experienceGap":2}},
    {"op":"replace","from":"Old text","to":"New text"}
  ]
}
```

```sh
node cli.js apply --id DOCUMENT_ID --patch changes.json --dry-run
node cli.js apply --id DOCUMENT_ID --patch changes.json
node cli.js render --id DOCUMENT_ID --output output/preview
```

Operations run in order and write once after all succeed. The response includes changes and a backup path. On a revision conflict, read again rather than overwrite document JSON. `render` creates PDF, PNG, and `.report.json` with actual page count and overflow information. `check` returns a report without writing artifacts.

| Command | Use |
| --- | --- |
| `init --input resume.md` | Create the primary document; no overwrite by default |
| `import --input resume.pdf --dry-run` | Inspect extraction; normal import creates a new document and lays it out; use `--structure` for reviewed content |
| `templates` / `template --name projects` | List templates / rearrange real sections and apply template styling |
| `style` / `row` / `replace` | Edit local style / columns / exact text |
| `normalize-spaces` | Remove single Chinese/Latin/digit spaces, preserving syntax and multiple spaces |
| `image --input photo.png --kind photo` | Add a portrait; use `--kind logo --heading HEADING` for a logo |
| `layout --dry-run` | Preview automatic layout; remove `--dry-run` to apply |
| `fit --dry-run --output output/candidate` | Preview one-page compression; remove `--dry-run` to apply |
| `export --output output/resume.md` | Export Markdown, `.json`, or `.html`; use `render` for PDF |
| `schema` / `help` | Current settings and operations / command help |

`fit` preserves content with a minimum body size of 9pt, top/bottom margins of 6mm, and left/right margins of 8mm. Failure leaves the document unchanged and exits with code 2. Use `layout` for bilingual documents with page breaks; `fit` tries to combine them into one page.

CLI stdout is JSON. Exit codes are 0 for success, 1 for errors, and 2 for unsuccessful compression. `node cli.js schema` is the current field reference.

## Templates and translation

| Template ID | Content |
| --- | --- |
| `projects` | Work, personal projects, education, skills |
| `internship` | Education, internships, campus, projects; sample portrait |
| `academic` | English education, research, publications, projects |
| `bilingual` | Separate language pages with natural continuation |
| `research` | Chinese research/publications; CLI only, no separate gallery card |
| `preserve` | Import without additional headings |

Gallery previews use full samples from `templates/examples/`; starter content is in `templates/*.md`. Sample companies, schools, and experience are fictional and should be replaced.

Existing bilingual content is arranged on separate language pages. Importing a single-language resume into the bilingual template requires a translation service. Without one, the tool requests agent translation rather than creating an incomplete document. Configure these variables and restart:

| Variable | Value |
| --- | --- |
| `PAPER_TRANSLATION_URL` | Full compatible Chat Completions URL, such as `https://…/chat/completions` |
| `PAPER_TRANSLATION_MODEL` | A model name supported by the service |
| `PAPER_TRANSLATION_KEY` | Optional API key, sent in a Bearer header |
| `PAPER_BROWSER_PATH` | Chrome, Edge, or Chromium executable path |

Ordinary editing, importing, and PDF generation run locally. Bilingual translation sends resume text to the configured provider. Alternatively, your own agent can translate and write the result through the CLI.

## Images and local fonts

Browser portraits default to the top right; company or school logos default to the top left. Neither requires a name or heading lookup. CLI logos without `--heading` go to the top left; specifying `--heading` places the logo inline beside that heading. For CLI portraits, use `node cli.js image --input photo.png --kind photo --position left`. `position` accepts `left` or `right`; the CLI defaults to the right.

Logos default to the top left. In the image dialog, you can explicitly choose a heading for inline placement, such as a company or university name. The app does not infer a section heading as the insertion target.

You can add several different corner logos. Uploading the same logo again does not duplicate it. Corner logos scale and wrap to share the available space; a portrait on the same side keeps its own space. Uploading a new portrait replaces the existing one. An inline logo replaces the previous logo on that heading. To remove an image, delete its image reference from the Markdown text.

Corner images shrink to the available header height when necessary, so they do not cover the first section or move the text.

Cropping and proportions: `node cli.js image --input logo.png --kind logo --crop auto` trims white or transparent margins in the display viewport. `--crop none` keeps the full image and is the CLI default. Both values also work with portraits. The original file stays unchanged, and scaling preserves its aspect ratio. Corner images must fit above the first section without covering or moving text. Browser logo uploads trim margins automatically; portrait uploads keep the full image by default.

Use `--crop x,y,width,height` for an explicit crop rectangle in original-image pixels, for example `--crop 20,30,200,160`. The rectangle must stay within the original image and have positive width and height. This can isolate a brand symbol from a wordmark. Display scaling keeps its aspect ratio and does not move text.

QR images: `node cli.js image --input qr.png --kind qr --position right`. Choose `left` or `right`; the default is top right. A QR image can stand alone or sit beside a portrait or logo on the same side. Uploading again replaces the QR image on that side. QR images keep their aspect ratio and surrounding quiet zone, and cannot be cropped. Corner images share header space without covering text. The browser image dialog also offers QR images with left/right placement.

You can also enter an installed font name, such as `Segoe UI`, `Georgia`, or `华文楷体`. Select “本地字体…” in the interface or set `fontFamily` through the CLI. Names can contain up to 80 characters. Missing fonts use a fallback. HTML requires the font on the receiving computer; PDF uses the font available during export.

```sh
node cli.js settings --json '{"fontFamily":"Segoe UI"}'
```

## Files and development

`resume.paper.json` stores the primary document. `.paper-library/` stores other versions and names, `.paper-assets/` images, `.paper-imports/` originals, `.paper-backups/` previous versions, and `.paper-previews/` and `output/` generated results. The browser also holds unsynced drafts. Keep documents with their image directories when moving them.

Private files are ignored by Git. Do not put personal resumes in public templates or `docs/`. HTML export creates a matching `.assets` directory; distribute it with the HTML file.

`app.js` contains UI logic, `resume-renderer.js` parses Markdown, `resume.css` styles the resume, `cli.js` provides commands, and `lib/` handles storage, import, rendering, and layout.

```sh
npm test
```

Tests require dependencies and a browser and write fixtures under `tmp/tests/`. Code uses the [MIT license](LICENSE). Fonts and bundled libraries retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Images in the PDF preview can be dragged and resized proportionally using their corner handles. PDF export preserves the saved placement and dimensions. Manual placement may overlap text. Reset restores automatic placement and size. Standalone HTML export uses automatic layout; use PDF to preserve manual image placement.
