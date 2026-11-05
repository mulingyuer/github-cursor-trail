# github-cursor-trail 项目完善计划

> 状态：M0–M6 已完成 · 更新日期：2026-11-05 · 本文是实施计划与验收依据，完成一项勾选一项。
> 决策记录见 §9；本次范围不含 npm 发布 / CI / Pages（顺延到下一计划，见 §11）。

## 1. 目标与约束

- **目标**：把当前「单文件源码 + 内联编译副本的 demo」原型，改造成可用 pnpm 开发、Vite 构建、可直接下载 / 安装使用的**零依赖 TypeScript 脚本库**，并随构建产物一起生成一份演示页面。
- **保持兼容**：`CursorTrail` 类、`createCursorTrail()` 工厂、`CursorTrailOptions` / `TrailCellSnapshot` 类型、默认导出，以及现有拖尾行为（网格吸附、白名单 / 黑名单、环形槽位、同格节流、`prefers-reduced-motion`、SSR 安静退化、`enable/disable/destroy`）一律不变。
- **不引入**：任何运行时依赖、独立 CSS 文件（样式仍由 `buildStyles()` 在运行时注入）、任何 UI 框架、canvas / WebGL。
- **一次构建两类产物**：`pnpm build` 同时产出「可安装的库」与「引用该库产物的 demo HTML」，`dist/` 可整包分发。
- **开源协议**：`MIT` + 根目录新增 `LICENSE`（纯开源，无附加条款）。
- **本次边界**：只做本地工程化、产物与一次性提交；**不发布 npm、不建 GitHub Actions、不启用 GitHub Pages**（下一计划，见 §11）。
- **收尾**：全部改好后清理不再需要的文件并提交，提交信息带 `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`（见 M6）。

## 2. 现状盘点（2026-11-05）

| 文件 | 现状 | 处理方向 |
| --- | --- | --- |
| `CursorTrail.ts` | 666 行，功能完整、JSDoc 齐全，零依赖，位于仓库根目录 | 迁入 `src/index.ts`，内容不改（仅调整文件顶部 `@example` 的 import 路径） |
| `demo.html` | 28 KB，内联了一份**去 export 的 JS 编译副本**（约 470 行）+ 初始化脚本；含计数 / 停用 / 销毁 / 黑名单验证交互 | 删除内联副本，改为占位标记；**保留全部演示布局与交互** |
| `README.md` | 13 KB，原理与 API 文档完整，但含过时内容：`dist/CursorTrail.js`、`npx tsc` 生成命令、「demo 内联副本需手工同步」说明 | 保留原理 / 配置 / FAQ，重写开头与「快速开始 / 本地验证」 |
| `tsconfig.json` | 严格模式、只 `include: ["CursorTrail.ts"]`、`noEmit` | 扩展 include，另加 `tsconfig.build.json` 生成 `.d.ts` |
| `package.json` / lockfile / Vite / oxc 配置 / git 配置 | **全部缺失** | 新建 |
| Git | 仅 `460d0ab Initial commit`；`README.md` 已修改未提交，其余 4 个文件未跟踪 | 全部改好后随 M6 一次性提交；工程化后可删除不再需要的文件 / 内容 |
| 本机环境（实施前须处理） | `node v26.3.0`、**无 `corepack` 命令**、全局 `pnpm 11.10.0` | 与 `.node-version=24.22` / `pnpm@12.15.0` 不一致：先用版本管理器切到 Node 24.22（该版本自带 Corepack），或单独安装 `corepack`；**禁止**直接用全局 pnpm 11.10.0 生成 lockfile |

**工具版本已校验**（npm registry / nodejs.org，2026-11-05）：

- `pnpm@12.15.0` 存在；Node `v24.22.0` 存在。
- `vite@8.3.6`（`engines.node = ^20.19.0 || >=22.12.0`，与 Node 24.22 兼容）、`oxlint@1.91.0`、`oxfmt@0.76.0`、`typescript@7.0.2`（TS 7，`inlineSources` 单独使用会报 `TS5051`，见 §6）。
- 以 `package.json` 锁定版本为准；安装后核对实际版本，`pnpm-lock.yaml` 随 M6 一起提交。

**已实测的关键结论**（临时工程验证，2026-11-05）：

- Vite 8 的 `name: "github-cursor-trail"` 会输出 `globalThis["github-cursor-trail"] = {}`，带连字符的全局名可用，但**必须用方括号访问**（`window["github-cursor-trail"]`，`window.github-cursor-trail` 会被解析成减法）。
- `build.sourcemap: true` 会为 ESM / UMD 各产一份 `.map`，且 `sourcesContent` 内嵌原始源码，产物尾部自动加 `//# sourceMappingURL=...`；**JS 侧**即使不发布 `src/` 也能在用户 devtools 里映射回 TS（`src/` 仍要随包发布，但那是为 `.d.ts.map` 服务）。
- `tsc` 的 `declarationMap` 产出的 `index.d.ts.map` **不含** `sourcesContent`，指向 `../src/index.ts`；要让编辑器「Go to Definition」落地，需把 `src/` 一并放进 npm 包。单独加 `inlineSources` 会触发 `TS5051`（要求同时有 `sourceMap` / `inlineSourceMap`）。

## 3. 关键决策（M0 已确认，决策记录见 §9）

| # | 决策 | 理由 / 注意点 |
| --- | --- | --- |
| D1 | 包名 / 仓库名 / 产物名统一为 `github-cursor-trail`；源码入口 `src/index.ts` 作为**唯一 TS 文件**，根目录 `CursorTrail.ts` 迁入后删除（不保留 shim）；类名仍是 `CursorTrail` | 满足「只引入一个 ts 文件即可使用」；npm 包入口用 `index.ts` 更符合惯例；消除根目录 PascalCase 文件与项目名不一致的问题 |
| D2 | 库产物：ESM `dist/cursor-trail.js` + UMD `dist/cursor-trail.umd.js` + 类型 `dist/index.d.ts`，另附各产物的 sourcemap（见 D8）；**UMD 全局名改为 `github-cursor-trail`**（与项目名一致，避免 `CursorTrail` 这种通用名冲突） | ESM 供打包器 / `<script type="module">`，UMD 供普通 `<script>` 与 CDN。UMD 全局仍是**命名空间对象**，且因名字带连字符**只能用方括号访问**：`const { CursorTrail } = window["github-cursor-trail"]`（`window.github-cursor-trail` 是减法表达式，会报错）；Vite 8 实测会输出 `globalThis["github-cursor-trail"] = {}`。文件名显式取 `.umd.js`（不用 Vite 默认 `.cjs`）：demo 用 `<script>` 引用，`.cjs` 在部分静态服务器上 MIME 不是 JS；本库不产 CJS，npm 入口 ESM-only |
| D3 | demo 一份 HTML 双模式：`demo.html` 内放占位 `<!-- CURSOR_TRAIL_ENTRY -->`；dev 时 Vite 插件注入 `/src/index.ts` 的 ESM 并挂到 `window["github-cursor-trail"]`；build 时脚本替换为 `<script src="./cursor-trail.umd.js"></script>`，初始化统一 `const { CursorTrail } = window["github-cursor-trail"]` | 同时满足「调试源码」与「引入打包生成的脚本库」。**必须走 UMD 普通脚本**：`file://` 下 ESM 会被 CORS 拦截，用户双击 `dist/demo.html` 就看不到效果。dev 注入的是 `type="module"`（延迟执行），赋值后必须派发 `cursor-trail-ready` 事件；demo 初始化用「`window["github-cursor-trail"]` 已存在则立即启动，否则监听该事件」的就绪握手，否则 dev 下会先于模块执行 |
| D4 | 构建顺序 `build:lib` → `build:types` → `build:demo`；`build:demo` 用 Node 脚本生成 HTML，不做二次打包；`build:lib` 负责 `emptyOutDir: true`，后续步骤**必须** `emptyOutDir: false` 或完全不调用 Vite 清空 | 避免 Vite 清空先生成的库产物（最常见的坑）；保证 `dist/demo.html` 中不再出现第二份库代码副本 |
| D5 | 类型声明用 `tsc -p tsconfig.build.json`（`emitDeclarationOnly`），不引入 `vite-plugin-dts` | 保持 devDependencies 精简；主 `tsconfig.json` 继续 `noEmit` 供 `typecheck` |
| D6 | `.node-version=24.22`、`packageManager: pnpm@12.15.0`、`engines.node: ">=24.22"`，README 写明 `corepack enable` | 开发环境一致；Corepack 不依赖全局 pnpm 安装。**实施前必须先切到 Node 24.22**：本机是 Node 26.3.0 且无 `corepack`，全局 pnpm 为 11.10.0；用版本管理器切换，或在 24.22 下执行 `corepack enable` → `corepack prepare pnpm@12.15.0 --activate`，并用 `corepack pnpm -v` 确认后再安装 |
| D7 | **`license: MIT` + 新增根目录 `LICENSE`（纯开源）**；`sideEffects: false`（模块顶层无副作用，样式只在构造时注入） | 便于 tree-shaking；`package.json` 的 `license` 字段与 `files` 列表都要包含 `LICENSE`，README 顶部加协议说明 |
| D8 | **开启 sourcemap**：`build.sourcemap: true`（ESM / UMD 各 1 份 `.map`，`sourcesContent` 内嵌），`tsconfig.build.json` 加 `declarationMap: true`（产 `index.d.ts.map`），并把 `src/index.ts` 纳入 `files` | 详见 §6「为什么开启 sourcemap」：作为 npm 库，用户 devtools / 打包器需要映射回 TS 源码与 `.d.ts`；`index.d.ts.map` 不含 `sourcesContent`，所以必须随包发布 `src/`，否则编辑器「Go to Definition」会断链。代价是 `dist/` 从 4 个文件变成 7 个、包体积略增；纯开源项目无源码泄露顾虑 |
| D9 | **本次不发布 npm、不建 CI、不上 GitHub Pages**；`npm pack --dry-run` 仅作本地打包内容自检 | 顺延到下一计划（§11）；但产物、元数据和文档按「随时可发布」的标准做，避免下一计划返工 |
| D10 | M6 收尾：**删除工程化后不再需要的文件 / 内容**，然后一次性提交全部变更 | 当前是随意源码阶段，允许清理：删根目录 `CursorTrail.ts`（迁入 `src/index.ts`）、删 `demo.html` 里的内联编译副本、清 Vite 模板残留与临时文件；最终树严格等于 §4。提交信息带 `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` |

## 4. 目标结构与产物

```text
github-cursor-trail/
├── src/
│   └── index.ts                 # 唯一源码文件（现 CursorTrail.ts 迁入，导出不变）
├── scripts/
│   └── build-demo.mjs           # 读 demo.html → 替换占位 → 写 dist/demo.html
├── demo.html                    # Vite dev 入口 + build 模板（保留现有交互）
├── vite.lib.config.ts           # build.lib：ESM + UMD
├── vite.demo.config.ts          # dev server + HTML 注入插件 + preview
├── tsconfig.json                # typecheck（noEmit）
├── tsconfig.build.json          # 仅生成 dist/index.d.ts
├── package.json
├── pnpm-lock.yaml
├── .oxfmtrc.json / .oxlintrc.json
├── .node-version / .gitattributes / .gitignore
├── LICENSE                      # MIT，纯开源
├── README.md
└── todo.md
```

```text
dist/                            # .gitignore 忽略，作为构建产物分发；恰好 7 个文件
├── cursor-trail.js              # ESM
├── cursor-trail.js.map          # ESM sourcemap（sourcesContent 内嵌源码）
├── cursor-trail.umd.js         # UMD，全局 window["github-cursor-trail"]
├── cursor-trail.umd.js.map     # UMD sourcemap
├── index.d.ts                   # 类型声明
├── index.d.ts.map               # 声明 map，指向随包发布的 ../src/index.ts
└── demo.html                    # 普通 <script src="./cursor-trail.umd.js">，无内联库副本
```

> `files: ["dist", "src", "README.md", "LICENSE"]`：`src/index.ts` 随包发布是为了让 `index.d.ts.map` 能落到真实 TS 源码（D8）。

## 5. 分阶段任务

### M0 · 基线与决策确认（已完成 2026-11-05）

- [x] 确认 §3 全部决策与 §9 决策记录（MIT + `LICENSE`、不发 npm / CI / Pages、UMD 全局改为 `github-cursor-trail`、不保留 shim、开启 sourcemap、oxc 严格度、收尾提交）。
- [x] 确认现有未提交文件的处理方式；记录 `demo.html` 中必须保留的交互（生成计数、停用 / 启用、销毁、白名单 / 黑名单 / 正文 / 页脚验证区）。

### M1 · 工程脚手架（原需求 1、3、4、5、6、7、10、11）

- [x] 用 Vite 8（当前 latest `8.3.6`）搭建工程：以 `pnpm create vite@latest` 生成的 vanilla-ts 骨架为参考，或直接手写最小 library 工程（推荐，官方模板不含 library 模式）；最终只保留 §4 结构，清除模板自带的 `index.html` / `src/main.ts` / `src/style.css` / `public/`，避免与 `demo.html` / `src/index.ts` 冲突。
- [x] **先切环境**：用版本管理器切到 Node 24.22（`node -v` 应为 `v24.22.x`），执行 `corepack enable` → `corepack prepare pnpm@12.15.0 --activate`，`corepack pnpm -v` 输出 `12.15.0`；不要用本机全局 pnpm 11.10.0 / Node 26.3.0 装依赖。
- [x] 新建 `package.json`：`name: github-cursor-trail`、`version: 0.1.0`、`type: module`、`author: mulingyuer`、`license: "MIT"`、`repository` / `homepage` / `bugs` 指向 `https://github.com/mulingyuer/github-cursor-trail`、`packageManager: "pnpm@12.15.0"`、`engines`、`main` / `module` / `types` / `exports` / `unpkg` / `jsdelivr` / `files: ["dist", "src", "README.md", "LICENSE"]` / `keywords` / `sideEffects: false`。
- [x] **新增 `LICENSE`**：MIT 全文，版权行 `Copyright (c) 2026 mulingyuer`；纯开源，无额外限制。
- [x] 配置 scripts（见 §6 表格），至少提供 `dev` 与 `build`。
- [x] 安装 devDependencies：`vite`、`typescript`、`oxlint`、`oxfmt`（不装运行时依赖）；**锁定 `typescript` 到实测可用版本**（registry latest 为 `7.0.2`，已验证其 `declarationMap` + `moduleResolution: Bundler` 可用；若 TS 7 与现有 `tsconfig` 组合出现差异，回退到 5.9.x 并写进 lockfile）；用 `corepack pnpm install` 生成 `pnpm-lock.yaml`（M6 统一提交）。
- [x] 新建 `.oxfmtrc.json` / `.oxlintrc.json`（以 §8 原始需求中的示例为基础，按 §6 修正）；不启用需类型信息的规则。
- [x] 新建 `.node-version`（`24.22`）、`.gitattributes`（`* text=auto eol=lf` 起头）、`.gitignore`（`node_modules` / `dist` / `build` 等）。
- [x] 调整 `tsconfig.json`（include 覆盖 `src`、`vite.*.config.ts`；保留 strict 系列），新建 `tsconfig.build.json`（`declarationMap: true`，见 §6）。
- [x] 验收：`pnpm typecheck` / `pnpm lint` / `pnpm format:check` 可执行且无配置报错；oxlint 无 `error`。

### M2 · 源码与 demo 重构（原需求 2、8）

- [x] `CursorTrail.ts` → `src/index.ts`，仅把头部 `@example` 的 import 路径改为 `from "github-cursor-trail"`；**不改动任何实现与公开 API**。
- [x] `demo.html` 删除内联编译副本（约 470 行），在 `</body>` 前保留占位 `<!-- CURSOR_TRAIL_ENTRY -->` 与一个普通 `<script>` 初始化块（计数 / 停用 / 销毁逻辑原样保留，改用 `window["github-cursor-trail"]` 方括号解构，并用 `cursor-trail-ready` 就绪握手包装启动逻辑）。
- [x] `vite.demo.config.ts`：dev 时 `transformIndexHtml` 把占位替换为 ESM 注入（`import * as ns from "/src/index.ts"; window["github-cursor-trail"] = ns; window.dispatchEvent(new Event("cursor-trail-ready"));`），并配置 `server` / `preview.outDir = dist`。
- [x] 验收：`pnpm dev` 打开页面，拖尾只在 `.trailAnimationArea` 留白区出现；按钮 / 链接 / 输入框 / 正文 / 页脚不触发；计数、停用、启用、销毁按钮均有效；控制台无报错。

### M3 · 构建与产物（原需求 9）

- [x] `vite.lib.config.ts`：`build.lib` 指向 `src/index.ts`，`formats: ["es", "umd"]`，**`name: "github-cursor-trail"`**，`fileName: (format) => format === "es" ? "cursor-trail.js" : "cursor-trail.umd.js"`（显式 `.js`，不要默认的 `.cjs`），**`sourcemap: true`**，`emptyOutDir: true`。
- [x] `tsconfig.build.json`：`declaration + declarationMap + emitDeclarationOnly + outDir: dist + rootDir: src`，产出 `dist/index.d.ts` 与 `dist/index.d.ts.map`；**不要**单独加 `inlineSources`（TS 7 会报 `TS5051`，它要求同时有 `sourceMap` / `inlineSourceMap`），改为随包发布 `src/index.ts`（D8）。
- [x] `scripts/build-demo.mjs`：校验 UMD 产物存在 → 读 `demo.html` → 占位替换为 `<script src="./cursor-trail.umd.js"></script>` → 写 `dist/demo.html`；产物存在性校验失败时非零退出。
- [x] `build` 脚本按 `build:lib && build:types && build:demo` 串联；确认 demo 步骤**不清空** `dist`（否则会删掉 4 份 `.map` / `.d.ts`）。
- [x] 验收：`pnpm build` 后 `dist/` 恰好包含 §4 列出的 **7 个文件**；`dist/demo.html` 中不含库源码副本。

### M4 · 文档（原需求 12）

- [x] README 开头：项目名、功能简介、特性（零依赖 / 框架无关 / 网格吸附 / 无障碍）、**MIT 协议说明**、环境要求（Node 24.22 + Corepack pnpm 12.15.0，含 `corepack enable`）、`pnpm install` / `pnpm dev` / `pnpm build` / `pnpm check` 用法、产物清单（7 个文件 + `src/index.ts` 随包发布的原因）。
- [x] README 后半：三种接入方式示例 —— ① npm / pnpm 安装后 ESM `import { CursorTrail } from "github-cursor-trail"`；② `<script src="…/cursor-trail.umd.js"></script>` + `const { CursorTrail } = window["github-cursor-trail"]; new CursorTrail()`（**必须方括号**，并在示例中说明原因）；③ CDN（unpkg / jsdelivr，同样用 `window["github-cursor-trail"]`）；`dist/demo.html` 双击或起静态服务器查看效果；`destroy()` 清理与 SSR / reduced-motion 说明。**本次不写 `npm publish` / CI / Pages 的操作说明**（下一计划再加）。
- [x] 保留现有「实现原理 / 配置项 / 为什么不会干扰页面使用 / 自定义样式 / 原站对照 / FAQ」章节；修正过时内容：`dist/CursorTrail.js` 路径、`npx tsc --ignoreConfig` 生成命令、「demo 内联副本需手工同步」说明、文件清单表；更新「本地验证」段为 `pnpm build` / `pnpm preview`。
- [x] 验收：README 中出现的每个路径、命令、导出名、全局名都能在实际项目中复现；全篇不再出现 `window.CursorTrail` / `new CursorTrail.CursorTrail()` 这类旧写法。

### M5 · 全量验证（不含发布）

- [x] 执行 §7 全部验收项；`npm pack --dry-run` **仅本地校验 tarball 内容**（含 `LICENSE` / `src/index.ts` / 7 个 `dist` 文件），不执行 `npm publish`、不创建任何 CI / Pages 配置。
- [x] 确认 `dist/` 被 `.gitignore` 忽略；产物分发方式留到下一计划决定。

### M6 · 清理与提交

- [x] **清理**：删除根目录 `CursorTrail.ts`（已迁入 `src/index.ts`）、`demo.html` 内联编译副本、Vite 模板残留（`index.html` / `src/main.ts` / `src/style.css` / `public/`）、临时探针 / 调试文件；最终目录严格等于 §4。当前是随意源码阶段，允许直接删除不再需要的内容。
- [x] 复核 `git status --short`：只保留应提交的新增 / 修改 / 删除，无 `node_modules/` / `dist/` / 临时文件混入。
- [x] 一次性提交全部变更（含 `README.md` 既有修改、4 个原未跟踪文件的最终形态、`LICENSE`、`pnpm-lock.yaml` 与所有新配置），提交信息正文末尾带 `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`。
- [x] 提交后 `git status --short` 为空；`git log -1` 可看到完整工程化变更。

## 6. 配置清单与修正要点

`package.json` scripts：

| 脚本 | 命令 | 说明 |
| --- | --- | --- |
| `dev` | `vite --config vite.demo.config.ts` | 开发调试 demo |
| `build` | `pnpm run build:lib && pnpm run build:types && pnpm run build:demo` | 一次产出库 + 类型 + demo |
| `build:lib` | `vite build --config vite.lib.config.ts` | ESM + UMD（含 2 份 `.map`） |
| `build:types` | `tsc -p tsconfig.build.json` | `dist/index.d.ts` + `dist/index.d.ts.map` |
| `build:demo` | `node scripts/build-demo.mjs` | 生成 `dist/demo.html` |
| `typecheck` | `tsc --noEmit -p tsconfig.json` | 严格类型检查（类型安全的唯一闸门，见下方 oxc 说明） |
| `lint` | `oxlint .` | 代码校验 |
| `format` | `oxfmt --write .` | 格式化 |
| `format:check` | `oxfmt --check .` | 校验格式 |
| `check` | `pnpm run typecheck && pnpm run lint && pnpm run format:check` | 提交前检查（M6 提交前必须通过） |
| `preview` | `vite preview --config vite.demo.config.ts` | 预览 dist |

对 §8 原始需求中两份 oxc 示例的**必要修正**：

- `.oxlintrc.json`：移除 `vue` 插件（纯 TS 项目）；保留 `typescript` / `unicorn` / `oxc`；`@typescript-eslint/no-floating-promises` 不是 oxlint 规则名，改为 oxlint 实际支持的规则或删除；确认 `typescript/no-extraneous-class` 不会误报 `CursorTrail`（该类有实例字段与方法）；`unicorn/filename-case` 允许 `src/index.ts`；忽略 `dist/**`、`*.umd.js`（若锁定版本不支持配置内 `ignorePatterns`，改用 `.oxlintignore`）。运行 `pnpm lint` 后按真实告警校准，**禁止大范围 disable 掩盖问题**。
- `.oxfmtrc.json`：沿用示例（`semi` / `useTabs` / `singleQuote: false` / `trailingComma: all` / `printWidth: 100` / `endOfLine: lf`）；格式化范围排除 `dist` / `node_modules`（不支持配置内忽略时改用 `.oxfmtignore`）；提交前 `pnpm format` 一次，保证 `format:check` 通过。
- 首次安装后确认 `oxfmt` 的 `--check` / `--write` 与 `oxlint .` 的实际 CLI 参数名（以锁定版本为准），再固化进 scripts；用 `pnpm lint` 的真实输出校准规则，禁止大范围 disable 掩盖问题。
- **严格度（Q6 已确认）**：允许残留合理 `warn`，但 `pnpm lint` 不得有 `error`；**不启用需类型信息的 oxlint 规则**（需要额外 tsconfig / 类型检查流程，拖慢 `lint`），类型安全统一由 `pnpm typecheck`（TS strict）保证；若某条规则产生大量误报，逐条说明理由后关闭，不做全局降级。
- `.node-version`：单行 `24.22`。
- `.gitattributes`：`* text=auto eol=lf` 必填；补充常见二进制扩展名 `binary`、`pnpm-lock.yaml linguist-generated=true`（按需）。
- `.gitignore`：`node_modules/`、`dist/`、`build/`、`coverage/`、`.vite/`、`*.log`、`.DS_Store`、`.idea/`、`*.local`；是否忽略 `.vscode/` 按实际决定。
- `tsconfig.json`：`include` 覆盖 `src/**/*.ts` 与 `vite.*.config.ts`；保留 `target ES2020` / `lib DOM` / `moduleResolution Bundler` / `strict` / `noUnused*` / `isolatedModules` / `noEmit`。
- `tsconfig.build.json`：继承后覆盖 `noEmit: false`、`declaration: true`、**`declarationMap: true`**、`emitDeclarationOnly: true`、`outDir: "dist"`、`rootDir: "src"`、`include: ["src/**/*.ts"]`；**不加 `inlineSources`**（TS 7 单独使用报 `TS5051`；`index.d.ts.map` 靠随包发布的 `src/` 解析）。
- `vite.lib.config.ts`：`build.sourcemap: true`、`sourcemap` 产物名由 `fileName` 自动派生（`cursor-trail.js.map` / `cursor-trail.umd.js.map`）；`build.lib.name: "github-cursor-trail"`；`emptyOutDir: true`。
- `package.json`：`license: "MIT"`；`exports` 字段：`"." → { types: "./dist/index.d.ts", import: "./dist/cursor-trail.js", default: "./dist/cursor-trail.js" }`；`main` / `module` 均指向 `./dist/cursor-trail.js`（**不提供 `require` 入口**：ESM-only 包，避免 `"type": "module"` 下 CJS 扩展名歧义）；`unpkg` / `jsdelivr` → `./dist/cursor-trail.umd.js`；`files: ["dist", "src", "README.md", "LICENSE"]`。
- **UMD 全局名带连字符**：Vite 8 实测输出 `globalThis["github-cursor-trail"] = {}`；所有 HTML / 文档 / 验证脚本一律用 `window["github-cursor-trail"]`，禁止写成 `window.github-cursor-trail`。

### 为什么开启 sourcemap（回答 Q5）

作为 npm 库，**建议开启**，这也是最终决定：

1. **用户侧可调试**：消费方打包后，浏览器 devtools / 错误堆栈能映射回 `src/index.ts` 的 TS 源码，而不是只显示 `cursor-trail.js` 的行号；本库仍有 `closest()` / 定时器 / reduced-motion 等运行时逻辑，报错定位很依赖它。
2. **不额外发布源码也能生效**：Vite 的 `build.sourcemap: true` 默认把 `sourcesContent` 内嵌进 `.map`（已实测），因此 JS 侧映射不依赖包里有 `src/`。
3. **类型跳转同样需要**：`declarationMap: true` 让编辑器从 `CursorTrailOptions` 等声明「Go to Definition」跳到 TS 源码；但 `.d.ts.map` **不含** `sourcesContent`（已实测），只写 `../src/index.ts`，所以必须把 `src/index.ts` 放进 `files`，否则跳转断链。
4. **代价可接受**：`dist/` 由 4 个文件增至 7 个、tarball 略大；纯开源 MIT 项目无需隐藏源码，`file://` 下 devtools 取不到 `.map` 也只是少一层调试信息，不影响运行。
5. **不做的事**：不压缩（ESM / UMD 都保持可读）、不产 IIFE、不用 `sourcemap: "hidden"`（hidden 会去掉 `sourceMappingURL`，适合错误监控平台私有上传，不适合开源库给用户调试）。

## 7. 验收清单

**环境 / 静态检查**

- [x] `node -v` 为 `v24.22.x`，`corepack pnpm -v` 为 `12.15.0`，仓库存在 `pnpm-lock.yaml`（不是全局 pnpm 11.10.0 生成的）。
- [x] `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm check` 全部通过；oxlint **无 `error`**（允许合理 `warn`），且无「规则不存在 / schema 无效」类配置告警。
- [x] `.gitattributes`、`.gitignore` 生效：文本文件为 LF，`node_modules/` 与 `dist/` 不被跟踪；根目录存在 `LICENSE`（MIT）。

**构建产物**

- [x] `pnpm build` 一次成功；`dist/` **含且仅含 7 个文件**：`cursor-trail.js`、`cursor-trail.js.map`、`cursor-trail.umd.js`、`cursor-trail.umd.js.map`、`index.d.ts`、`index.d.ts.map`、`demo.html`。
- [x] 两份 JS 产物尾部有 `//# sourceMappingURL=...`，`.js.map` 内含 `sourcesContent`（能映射回 TS 源码）；`index.d.ts.map` 指向的 `../src/index.ts` 在包内真实存在；浏览器 devtools 与编辑器「Go to Definition」都能落到 TS 源码。
- [x] `dist/demo.html` 通过相对路径 `./cursor-trail.umd.js` 引入库，且**不含任何库源码副本**；整目录拷贝到别处后 `.map` 相对路径仍可解析。
- [x] 直接双击 `dist/demo.html`（`file://`）与通过静态服务器打开均能看到拖尾。
- [x] ESM 产物 `import { CursorTrail, createCursorTrail } from "github-cursor-trail"` 可用；UMD 产物在普通 `<script>` 下挂载 **`window["github-cursor-trail"]`**（含 `CursorTrail` / `createCursorTrail` / `default`），且与 ESM 导出一致；**不产生 `window.CursorTrail`**；`.d.ts` 能被 TS 解析出全部选项类型。
- [x] `pnpm dev` 修改 `src/index.ts` 后热更新生效（dev 下就绪握手不报错）；`pnpm preview` 展示的是构建产物而非源码。

**行为回归（不得因工程化改动而退化）**

- [x] 拖尾只在 `.trailAnimationArea` 留白内出现，吸附网格；按钮 / 链接 / 输入框 / `[role="button"]` / 纯文本段落 / 页脚均不触发。
- [x] `onSpawn` 计数随方块递增；同一格不重复触发；40 个槽位环形复用；100~400ms 内错峰熄灭。
- [x] `disable()` 清空当前方块并停止监听，`enable()` 恢复，`destroy()` 后无残留 DOM / 样式 / 定时器 / document 监听；同容器重复 `new` 不叠加节点。
- [x] `prefers-reduced-motion: reduce` 起始停用、运行时切换立即生效；手动 `enable()` / `disable()` 后系统偏好不再覆盖用户意图。
- [x] 无 `window` / `document` 环境（Node 中 import）不抛错；点击穿透正常（`pointer-events: none`）。

**文档 / 包元数据 / 提交**

- [x] README 中的每个命令、路径、导出名、CDN 地址均可复现；无 `dist/CursorTrail.js`、`npx tsc --ignoreConfig`、「demo 内联副本」、`window.CursorTrail` / `new CursorTrail.CursorTrail()` 等过时写法；含 MIT 说明。
- [x] `npm pack --dry-run` 只包含预期发布文件（`dist/` 7 个、`src/index.ts`、`README.md`、`LICENSE`）；`package.json` 的 `license` / `exports` / `unpkg` / `jsdelivr` / `engines` / `repository` / `files` 字段齐全；**没有**任何 CI 配置、发布脚本或 Pages 配置。注意：`dist/` 虽被 `.gitignore` 忽略，但 `files` 白名单优先，仍会打进 tarball。
- [x] 桌面 Chrome / Edge / Firefox 各打开一次 demo（至少覆盖 Chromium 与一处非 Chromium）。
- [x] M6：`git status --short` 只剩预期变更，清理后目录严格等于 §4；提交后工作区干净，提交信息含 `Co-authored-by` trailer。

## 8. 原始需求（逐条保留，编号沿用原文）

### 项目架构补全（原文）

项目是一个纯前端项目，主要是通过`CursorTrail.ts`来实现源码逻辑，不依赖单独的css文件，目的是只需要引入一个ts文件就可以直接使用。

1. 使用最新的vite初始化项目，目的是构建供大家直接下载安装使用的脚本库。
2. 项目名为：`github-cursor-trail`，看看目前的项目中的文件是否需要重新命名，确保与项目名一致。
3. package.json 中的开发者为`mulingyuer`，github仓库地址为`https://github.com/mulingyuer/github-cursor-trail`
4. package.json 中的脚本要提供一个dev和build命令，方便开发和打包使用。
5. 代码格式化和校验统一使用oxc系列，项目中需要配置好对应的配置文件。

    可以参考一下配置，但是要按照目前项目的实际需求进行调整。

    .oxfmtrc.json

    ```json
    {
      "$schema": "./node_modules/oxfmt/configuration_schema.json",
      "semi": true,
      "useTabs": true,
      "tabWidth": 2,
      "singleQuote": false,
      "trailingComma": "all",
      "printWidth": 100,
      "endOfLine": "lf"
    }
    ```

    .oxlintrc.json

    ```json
    {
    "$schema": "./node_modules/oxlint/configuration_schema.json",
    "plugins": ["typescript", "unicorn", "oxc", "vue"],
    "categories": {
    "correctness": "error",
    "suspicious": "warn"
    },
    "rules": {
    "no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ],
    "typescript/no-explicit-any": "off",
    "typescript/no-extraneous-class": [
      "error",
      {
        "allowWithDecorator": true
      }
    ],
    "unicorn/filename-case": [
      "warn",
      {
        "cases": {
          "kebabCase": true,
          "camelCase": true,
          "pascalCase": true
        }
      }
    ],
    "@typescript-eslint/no-floating-promises": "warn"
    },
    "ignorePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.output/**",
    "**/.nuxt/**",
    "**/*.min.js",
    "pnpm-lock.yaml"
    ]
    }


    ```
6. 配置`.node-version`文件，指定项目使用的Node.js版本，确保开发环境一致。目前定义为`24.22`
7. 使用`pnpm`作为包管理工具，确保依赖安装和管理的一致性。启用 Corepack，配置pnpm版本为`12.15.0`
8. 我们需要通过一个html网页来查看鼠标轨迹效果，方便调试和展示。
9. 打包构建时，需要生成两份内容：

    1. 一份是用于用户直接安装使用的脚本库，通常会打包成UMD或ESM格式，方便在网页中直接引入。
    2. 另一份就是一个html文件，它引入打包生成的脚本库，用于展示和调试鼠标轨迹效果。也就是demo页面。
10. 配置`.gitattributes`文件，要求`* text=auto eol=lf`，其它的按照项目实际需求进行配置。
11. 配置`.gitignore`文件，忽略`node_modules`、`dist`、`build`等不需要提交到版本控制的文件和目录。
12. 更新README.md文件，开头部分说明项目的基本信息，包括项目名称、功能简介、以及开发环境和使用方法。后半部分则是具体的使用方式示例，包括如何在网页中引入脚本库以及如何查看鼠标轨迹效果。目前README.md已经写了一部分，可以继续完善示例和使用说明，使其更加清晰易懂。

## 9. 决策记录（M0 已拍板，2026-11-05）

| # | 问题 | 最终决定 |
| --- | --- | --- |
| Q1 | 开源协议与是否新增 `LICENSE` 文件 | **新增，MIT，纯开源**：根目录建 `LICENSE`（`Copyright (c) 2026 mulingyuer`），`package.json` 加 `license: "MIT"`，`files` 含 `LICENSE`，README 顶部注明 |
| Q2 | 是否发布到 npm、是否需要 CI（`install → check → build → 上传 dist`）与 GitHub Pages 托管 demo | **本次全不做，下一计划实现**（§11）；但产物 / 元数据 / 文档按「随时可发布」标准准备，`npm pack --dry-run` 只作本地自检 |
| Q3 | UMD 全局名 | **改为 `github-cursor-trail`**，与项目名一致，避免 `CursorTrail` 通用名冲突；仍是命名空间对象。Vite 8 实测输出 `globalThis["github-cursor-trail"]`，因此**一律用方括号**：`const { CursorTrail } = window["github-cursor-trail"]`（已同步 D2 / D3 / M2 / M3 / M4 / §6 / §7）。若日后觉得方括号不便，可换成 `GitHubCursorTrail` 驼峰名，但需同步改全部示例 |
| Q4 | 是否保留根目录 `CursorTrail.ts` 兼容 shim | **不保留**，迁入 `src/index.ts` 后删除；M6 清理时一并移除 |
| Q5 | 版本号 / 压缩 / sourcemap / IIFE | **`0.1.0`；ESM 与 UMD 都不压缩；不产 IIFE；开启 sourcemap**（用户提出「作为 npm 库是否需要」，结论：需要，详见 §6「为什么开启 sourcemap」）→ `build.sourcemap: true` + `declarationMap: true` + 随包发布 `src/index.ts`；`dist/` 由 4 个文件变为 **7 个**（§4 / §7 已同步） |
| Q6 | oxc 严格度 / 是否启用需类型信息的规则 | **允许合理 `warn`，但 `pnpm lint` 不得有 `error`；不启用需类型信息的规则**，类型安全交给 `pnpm typecheck`（TS strict）；误报规则逐条说明后关闭，不做全局降级 |
| Q7 | 未提交的 `README.md` 修改与 4 个未跟踪文件如何处理 | **全部改好后随 M6 一次性提交**；工程化阶段允许删除不再需要的文件 / 内容（根目录 `CursorTrail.ts`、`demo.html` 内联副本、模板残留等），最终树严格等于 §4；提交信息带 `Co-authored-by` trailer |

## 10. 实施顺序与依赖

```mermaid
flowchart LR
  M0[M0 决策确认 ✅] --> M1[M1 脚手架 / 配置]
  M1 --> M2[M2 源码与 demo 重构]
  M1 --> M3[M3 构建产物]
  M2 --> M3
  M3 --> M4[M4 README]
  M2 --> M5[M5 全量验证]
  M3 --> M5
  M4 --> M5
  M5 --> M6[M6 清理与提交]
```

- M2 与 M3 可并行编写，但 `build` 串联验证必须在两者都完成后进行。
- M4 依赖 M3 的最终产物文件名、7 文件清单与 UMD 全局名（D2 / D3 / D8），否则文档会写错路径。
- M6 必须是最后一步：`pnpm check`、`pnpm build`、§7 全部通过后才清理并提交；清理删除的文件也要进同一个提交。
- 任一阶段验收不通过，先修复再进入下一阶段；不把未解决问题带入 `pnpm build` 或提交。

## 11. 下一计划（本次明确不做，仅登记）

- 发布到 npm：`npm publish` / provenance、版本号与 tag 策略、`prepublishOnly` 钩子。
- GitHub Actions：`install → check → build → 上传 dist artifact`，PR 与 tag 触发规则。
- GitHub Pages 托管 `dist/demo.html`，以及 CDN（unpkg / jsdelivr）链接的正式验证。
- 可选：为 sourcemap 接入错误监控平台；评估是否把 UMD 全局名改成无连字符写法以便点访问。

