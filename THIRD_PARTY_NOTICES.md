# 第三方许可证 / Third-party licenses

项目自己的代码使用MIT许可证。以下字体及库保留其原许可证；项目LICENSE不替换它们。商业系统字体不包含在仓库中。

Project code uses MIT. The fonts and libraries below retain their original licenses, which are not replaced by the project LICENSE. Proprietary system fonts are not included.

| Component | Files | License |
| --- | --- | --- |
| Noto Sans SC | `fonts/NotoSansSC.ttf` | SIL Open Font License 1.1: [OFL.txt](fonts/OFL.txt) |
| Noto Serif SC | `fonts/NotoSerifSC.ttf` | SIL Open Font License 1.1: [OFL-serif.txt](fonts/OFL-serif.txt) |
| Marked | `vendor/marked.js` | [Bundled license](vendor/LICENSE-marked.md) |
| PDF.js 6.4.299 | `vendor/pdf.mjs`, `vendor/pdf.worker.mjs` | Apache 2.0: [Bundled license](vendor/pdfjs-LICENSE.txt) |

`npm install`另外安装`playwright-core`（Apache 2.0）、`pdf-lib`（MIT）、`pdfjs-dist`（Apache 2.0）、`@napi-rs/canvas`（MIT）和`jszip`（MIT或GPL 3.0及以后版本双重许可，此项目按MIT使用）。它们的许可证保存在各依赖包内；以安装版本的LICENSE文件为准。`node_modules/`不提交。

`npm install` also installs `playwright-core`, `pdf-lib`, `pdfjs-dist`, `@napi-rs/canvas`, and `jszip`. Consult the license files in the installed packages for their respective versions. `node_modules/` is not committed.
