# github-cursor-trail — 网格吸附式鼠标拖尾

一个**零依赖、框架无关**的 TypeScript 脚本库，复刻 [githubuniverse.com](https://githubuniverse.com/) 首页的鼠标拖尾效果：鼠标滑过页面时，沿轨迹弹出一串对齐网格的彩色 ASCII 方块，100~400ms 后依次缩回消失；而在按钮、链接、正文等可交互 / 需阅读的元素上完全不触发。

与常见猜测不同，原站这个效果**没有用 three.js、GSAP、canvas 或 WebGL**，就是 40 个常驻 `div` + `transform` / `transition` + 一个 `document` 级 `mousemove` 监听。本仓库把它从 React 组件改写成了纯 TypeScript 类，并随构建产物提供可直接打开的演示页。

本项目采用 [MIT 协议](./LICENSE)，可自由使用、修改与分发。

---

## 特性

- **零运行时依赖**：没有独立 CSS 文件，样式由 `buildStyles()` 在构造时注入。
- **框架无关**：原生页面、React、Vue 均可接入；SSR 下安静退化。
- **行为可控**：网格吸附、白名单 / 黑名单、环形槽位、同格节流，交互元素与正文不触发。
- **无障碍**：容器与方块带 `aria-hidden`，支持 `prefers-reduced-motion`，可手动 `enable()` / `disable()` / `destroy()`。
- **一次构建两类产物**：ESM / UMD 脚本库、类型声明、sourcemap，以及引用 UMD 产物的 `dist/demo.html`。

---

## 仓库结构

| 路径 | 说明 |
| --- | --- |
| `src/index.ts` | 唯一源码文件，导出 `CursorTrail`、`createCursorTrail`、类型与默认导出 |
| `demo.html` | dev 入口与 build 模板，保留全部演示布局和交互 |
| `scripts/build-demo.mjs` | 把模板中的占位标记替换成 UMD `<script>`，生成 `dist/demo.html` |
| `vite.lib.config.ts` | 构建 ESM / UMD 脚本库 |
| `vite.demo.config.ts` | dev 时注入源码 ESM，preview 时展示构建产物 |
| `tsconfig.json` / `tsconfig.build.json` | 严格类型检查 / 生成 `.d.ts` 与 `.d.ts.map` |
| `package.json` / `pnpm-lock.yaml` | 工程元数据与锁定依赖 |
| `.oxfmtrc.json` / `.oxlintrc.json` | oxc 格式化与校验配置 |
| `.node-version` / `.gitattributes` / `.gitignore` | Node 版本、换行与忽略规则 |
| `LICENSE` | MIT 协议全文 |

---

## 开发环境

- Node.js `24.22`（仓库提供 `.node-version`）
- Corepack 管理的 `pnpm@12.15.0`（见 `packageManager` 字段）

本机使用 fnm 切换版本：

```bash
fnm install 24.22
fnm use 24.22
corepack enable
corepack prepare pnpm@12.15.0 --activate
corepack pnpm -v  # 12.15.0
```

> 若新终端未自动应用 fnm，按 fnm 文档配置 `--use-on-cd` shell 集成；或在该终端执行 `fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression` 后再 `fnm use 24.22`。

常用命令（以下命令覆盖 `package.json` 中全部 `scripts`；`pnpm install` 为依赖安装）：

```bash
pnpm install             # 安装 devDependencies

# 开发 / 预览
pnpm dev                 # 启动开发服务器并打开 http://localhost:5173/demo.html，调试 src/index.ts
pnpm preview             # 预览 dist/demo.html（构建产物）

# 类型检查 / 校验 / 格式化
pnpm typecheck           # tsc --noEmit，仅检查类型，不输出文件
pnpm lint                # 使用 oxlint 做静态检查
pnpm format              # 使用 oxfmt 按配置写入格式化结果
pnpm run format:check    # 使用 oxfmt 仅检查格式，不写入文件
pnpm check               # 依次执行 typecheck + lint + format:check

# 构建
pnpm run build:lib       # 构建 ESM / UMD 脚本库及 sourcemap
pnpm run build:types     # 生成 .d.ts 与 .d.ts.map
pnpm run build:demo      # 由 demo.html 生成 dist/demo.html（须先执行 build:lib）
pnpm build               # 依次执行 build:lib → build:types → build:demo
```

> 单独执行构建子命令时，请保持 `build:lib → build:types → build:demo` 的顺序；`pnpm build` 会自动串行完成。

> pnpm 12 的 `minimumReleaseAge` 策略偶尔会为新发布的依赖生成 `pnpm-workspace.yaml`。本仓库已提交 `pnpm-lock.yaml`，通常无需处理；若首次安装出现该文件，可删除后改用 `pnpm install --config.minimum-release-age=0`。

---

## 构建产物

`pnpm build` 按 `build:lib → build:types → build:demo` 执行，`dist/` 含且仅含以下 7 个文件：

| 文件 | 说明 |
| --- | --- |
| `dist/cursor-trail.js` | ESM，npm 包主入口 |
| `dist/cursor-trail.js.map` | ESM sourcemap，含 `sourcesContent` |
| `dist/cursor-trail.umd.js` | UMD，普通 `<script>` / CDN 入口，挂载 `window["github-cursor-trail"]` |
| `dist/cursor-trail.umd.js.map` | UMD sourcemap，含 `sourcesContent` |
| `dist/index.d.ts` | 类型声明 |
| `dist/index.d.ts.map` | 声明 map，指向 `../src/index.ts` |
| `dist/demo.html` | 通过相对路径引入 UMD 产物的演示页，无内联库副本 |

`dist/` 被 `.gitignore` 忽略，但 `package.json` 的 `files` 白名单会把它打进 npm tarball。`src/index.ts` 也随包发布：`.d.ts.map` 不含 `sourcesContent`，只有带上真实源码，编辑器「Go to Definition」才能落到 TS 源文件。

---

## 接入方式

### 1. 包管理器安装（ESM）

> 以下安装与 CDN 示例按包发布后的用法书写；当前计划只完成本地工程化，不执行发布。

```bash
pnpm add github-cursor-trail
```

```ts
import { CursorTrail, createCursorTrail } from "github-cursor-trail";
// 默认导出也等价于 CursorTrail：
// import CursorTrail from "github-cursor-trail";

const trail = new CursorTrail();
// 或使用工厂：const trail = createCursorTrail();

// 页面卸载 / 路由离开时务必销毁，否则残留 document 级监听
trail.destroy();
```

包是 ESM-only，不提供 `require` 入口；类型声明会由 TypeScript 自动解析。

### 2. 直接引用构建产物（UMD）

把 `dist/cursor-trail.umd.js` 复制到页面可访问的位置：

```html
<script src="./cursor-trail.umd.js"></script>
<script>
  const { CursorTrail, createCursorTrail } = window["github-cursor-trail"];
  const trail = new CursorTrail();
  // createCursorTrail() 与 new CursorTrail() 等价
  // 默认导出：window["github-cursor-trail"].default
</script>
```

UMD 全局名带连字符，**必须用方括号访问**：点访问形式会被解析成减法表达式。该全局是命名空间对象，不会额外挂载同名的全局类构造器。

### 3. CDN（发布后）

```html
<script src="https://unpkg.com/github-cursor-trail@0.1.0/dist/cursor-trail.umd.js"></script>
<!-- 或 -->
<script src="https://cdn.jsdelivr.net/npm/github-cursor-trail@0.1.0/dist/cursor-trail.umd.js"></script>
<script>
  const { CursorTrail } = window["github-cursor-trail"];
  new CursorTrail();
</script>
```

`dist/demo.html` 使用的就是第 2 种方式：普通脚本 + 相对路径，所以可以直接双击（`file://`）查看，也可以用 `pnpm preview` 或任意静态服务器打开。

---

## 标记页面区域

组件靠两个**纯标记类**划分地盘，它们没有任何 CSS 样式，只供 JS 查询：

```html
<!-- 允许出现拖尾的装饰性区域 -->
<section class="trailAnimationArea" data-grid>
  <h1>Universe 2026</h1>

  <!-- 明确排除：标题、CTA、图片等 -->
  <div class="trailAnimationIgnore">
    <a href="/register">立即注册</a>
    <button>播放视频</button>
  </div>
</section>

<!-- 不标 trailAnimationArea 的区域，鼠标怎么滑都不会有拖尾 -->
<footer>© 2026 GitHub Inc.</footer>
```

- `trailAnimationArea` — 白名单。鼠标所在元素 `closest()` 得到它才继续。
- `trailAnimationIgnore` — 黑名单。命中即 `return`。
- `data-grid` — 可选。组件用这个容器的 `clientWidth` 除以列数得到格子边长；不提供则用 `fallbackCellSize`（默认 17px）。

`a` / `button` / 表单控件 / `[role="button"]` / `[contenteditable]` 默认已在黑名单里，**不需要**额外加类。

---

## 在框架里用

<details>
<summary>React（useEffect）</summary>

```tsx
import { useEffect } from "react";
import { CursorTrail } from "github-cursor-trail";

export function TrailLayer() {
  useEffect(() => {
    const trail = new CursorTrail();
    return () => trail.destroy();   // cleanup 必须写
  }, []);

  return null;                      // 组件自己创建 DOM，不需要渲染任何东西
}
```

如果是 Next.js App Router / SSR，建议用 `next/dynamic` 配 `ssr: false` 懒加载这一层（原站就是这么做的），避免首屏加载无关的交互代码。

</details>

<details>
<summary>Vue 3（onMounted / onBeforeUnmount）</summary>

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import { CursorTrail } from "github-cursor-trail";

let trail: CursorTrail | undefined;
onMounted(() => { trail = new CursorTrail(); });
onBeforeUnmount(() => { trail?.destroy(); });
</script>

<template></template>
```

</details>

---

## 生命周期与无障碍

- `new CursorTrail()` / `createCursorTrail()` 自动启用；同容器重复实例化会先销毁旧实例。
- `disable()` 清空当前方块并停止监听，`enable()` 恢复，`destroy()` 移除 DOM、样式、定时器与 `document` 监听。
- 无 `window` / `document` 的环境（Node / SSR）导入与构造都不会抛错，会退化为空实例。
- `prefers-reduced-motion: reduce` 时起始停用，运行时切换立即生效；手动 `enable()` / `disable()` 后系统偏好不再覆盖用户意图。
- 所有方块 `pointer-events: none` 且带 `aria-hidden`，不拦截点击 / hover，也不会被屏幕阅读器朗读。

---

## 实现原理

一次 `mousemove` 的完整链路：

```
document mousemove（全局唯一监听，事件委托）
  │
  ├─ target 不是 Element                    → return
  ├─ closest('.trailAnimationArea') 为空    → return   ← 白名单
  ├─ closest('.trailAnimationIgnore, a, button, …') 命中 → return ← 黑名单
  ├─ 坐标不在 area.getBoundingClientRect() 内 → return
  │
  ├─ cell = 网格容器 clientWidth / 列数（宽屏 94 / 窄屏 67 / 兜底 17px）
  ├─ x = origin.left + floor((clientX - origin.left) / cell) * cell   ← 网格量化
  │  y = origin.top  + floor((clientY - origin.top ) / cell) * cell
  ├─ 同一格 / 该格已有活跃方块                → return   ← 节流
  ├─ 纯文本叶子节点（正文段落）               → return   ← 不遮挡文字
  │
  └─ 环形复用第 (i+1) % 40 个槽位
       ├─ 写 transform / 尺寸 / 随机色 / 随机符号
       ├─ 加 is-active → CSS scale(0) → scale(1) 弹出
       └─ setTimeout(100~400ms) → 移除 is-active → scale(0) 缩回
```

**为什么看起来是「像素块」而不是「丝带」**：坐标被 `floor` 量化到网格了，方块只能出现在整数格上，且同格只亮一次。

**为什么是「拖尾」**：40 个槽位按环形顺序依次点亮，每个的存活时间在 100~400ms 内随机，于是它们错峰熄灭，形成一条有长度、有衰减的尾巴。

**为什么几乎不耗性能**：DOM 节点数恒定为 40，不随鼠标事件增长；只改 `transform` / `color` / `textContent`，不触发整页重排；没有 `requestAnimationFrame` 循环，鼠标不动就零开销；只有一个 `passive` 的 document 级监听。

---

## 配置项

全部可选，`new CursorTrail(options)` 传入。

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `areaSelector` | `string` | `'.trailAnimationArea'` | 触发区域白名单 |
| `extraAreaSelector` | `string` | `''` | 追加的白名单，拼成 `a, b` |
| `ignoreSelector` | `string` | 见下方 | 黑名单，命中即不生成 |
| `poolSize` | `number` | `40` | 常驻方块数量（环形缓冲容量） |
| `colors` | `readonly string[]` | 6 个 Universe 品牌色 | 随机背景色池 |
| `glyphs` | `readonly string[]` | `- / ) . + = > < * & (` | 随机符号池 |
| `blankProbability` | `number` | `0.3` | 符号为空格的概率，制造疏密 |
| `lifetimeMs` | `[number, number]` | `[100, 400]` | 存活时间随机区间（ms） |
| `gridColumns` | `number \| (w) => number` | `w <= 1011 ? 67 : 94` | 网格列数，可按视口动态 |
| `gridSelector` | `string` | `'[data-grid]'` | 取宽度用的网格容器 |
| `fallbackCellSize` | `number` | `17` | 无网格容器时的格子边长（px） |
| `skipTextLeaves` | `boolean` | `true` | 跳过纯文本叶子节点，避免压住正文 |
| `respectReducedMotion` | `boolean` | `true` | 跟随 `prefers-reduced-motion` |
| `eventName` | `'mousemove' \| 'pointermove'` | `'mousemove'` | 监听的事件名 |
| `container` | `HTMLElement` | `document.body` | 方块挂载容器 |
| `classPrefix` | `string` | `'ct'` | CSS 类名前缀 |
| `injectStyles` | `boolean` | `true` | 是否自动注入内置样式 |
| `zIndex` | `number` | `2` | 方块层级 |
| `transitionMs` | `number` | `100` | 弹出 / 缩回时长（ms） |
| `transitionEasing` | `string` | `cubic-bezier(.3,.41,.04,1.01)` | 缓动曲线 |
| `glyphColor` | `string` | `'inherit'` | 符号颜色，默认继承页面文字色（原站行为） |
| `onSpawn` | `(cell) => void` | — | 每点亮一格时回调，可用来埋点 |

默认黑名单：

```text
.trailAnimationIgnore, button, a, input, textarea, select,
[role="button"], [contenteditable="true"]
```

### 常用实例方法

| 方法 / 属性 | 说明 |
| --- | --- |
| `enable()` | 手动启用；之后系统动效偏好不再覆盖用户意图 |
| `disable()` | 停用并清空当前所有方块 |
| `destroy()` | 解绑监听、清定时器、移除注入的样式与 DOM |
| `isEnabled` | 只读，当前是否在监听 |

### 完全对齐原站的配置

原站的网格容器叫 `[data-super-mona-grid]`（属于 Super Mona 小游戏），并且额外允许 Primer River 的标题区域：

```ts
new CursorTrail({
  gridSelector: '[data-super-mona-grid]',
  extraAreaSelector: "[class^='Primer_Brand__river-shared-module__River__heading']",
});
```

---

## 为什么不会干扰页面使用

这是原站设计里最值得抄的部分，四层保障叠加：

1. **从源头不生成** — `closest(ignoreSelector)` 命中直接 `return`，交互元素上根本不会出现方块，而不是「出现后再隐藏」。
2. **不拦截事件** — 所有方块 `pointer-events: none`，不参与命中测试，点击、hover、文本选中、`cursor` 样式全部不受影响。
3. **区域收敛** — 只有显式标了 `trailAnimationArea` 的装饰性 section 生效，还有 `getBoundingClientRect()` 二次校验。
4. **不遮挡正文** — `skipTextLeaves` 让鼠标划过纯文字段落时不弹方块，容器型留白区域才弹。

无障碍方面：容器与每个方块都带 `aria-hidden="true"`（随机符号不会被屏幕阅读器念出来）；`prefers-reduced-motion: reduce` 时整个效果停用，并监听 `change` 事件，用户中途修改系统设置也会立即生效。

---

## 自定义样式

设 `injectStyles: false` 后需要自己提供样式。下面是内置样式的等价版本，可按需改写：

```css
.ct-root { pointer-events: none; }
.ct-root[hidden] { display: none; }

.ct-block {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2;
  text-align: center;
  line-height: 1.5;
  pointer-events: none;
}

.ct-color {
  display: block;
  width: 100%;
  height: 100%;
  color: inherit;
  transform: scale(0);
  transition: transform 100ms cubic-bezier(.3,.41,.04,1.01);
}

.ct-block.is-active .ct-color { transform: scale(1); }
```

> ⚠️ 挂载容器（`.ct-root` 及其祖先）**不要**设置 `transform` / `filter` / `perspective` / `contain`，否则它会变成 `position: fixed` 的包含块，方块就不再相对视口定位了。

---

## 与原站实现的对照

| 原站（Next.js chunk 2834） | 本实现 |
| --- | --- |
| React `useState` 存 40 个槽位 | 类内部 `CellState[]` + 直接操作 DOM，省去 diff |
| `setTimeout` 到点把 `active` 置 `false` | 同 |
| `prefers-reduced-motion` 时不渲染列表 | 停用监听 + `hidden` 容器，并支持运行时切换 |
| `closest('.trailAnimationArea, …')` / `closest('.trailAnimationIgnore, button, a')` | 同，黑名单补齐表单控件 |
| 网格列数常量 `94 / 67`，断点 `1011` | 同 |
| 6 色 + 11 个 ASCII 符号，30% 空格 | 同，全部可配置 |
| CSS Modules（`.CursorTrailAnimation_Block__…`） | 可配置前缀的普通类名 |
| 方块为 `block` 布局、`line-height: 1.5`，字体与文字色继承页面 | 同，`glyphColor` / `injectStyles: false` 可覆盖 |
| `ssr: false` 懒加载 | 构造时检测 `window` / `document`，SSR 下安静退化为空实例 |
| — | 新增 `enable()` / `disable()` / `destroy()`、同容器防重复实例化、`onSpawn` |

### 两点容易混淆的地方

- 原站确实打包了 **GSAP**（`7265-*.js` 模块 6941），但只用于 eyebrow 打字机动画和 Super Mona 小游戏残影的 tween，**与鼠标拖尾无关**。
- 原站 chunk `4492` 里的 `createTrails()` / `updateTrails()` 是**小游戏角色冲刺时的 sprite 残影**，同样与鼠标拖尾无关。两者唯一的联系是：拖尾组件借它那个 `[data-super-mona-grid]` 容器来取网格宽度。

---

## 常见问题

**Q：方块不出现？**
检查鼠标所在元素能否 `closest('.trailAnimationArea')`；再检查它是否落在 `ignoreSelector` 里。最直接的排查方式是传 `onSpawn: (c) => console.log(c)`，有输出说明逻辑通了、只是样式问题。

**Q：拖尾太密 / 太稀？**
调 `poolSize`（容量）、`lifetimeMs`（寿命）、`blankProbability`（空格率）。想更长的尾巴就增大 `poolSize` 和 `lifetimeMs[1]`。

**Q：方块尺寸不对？**
格子边长 = `[data-grid]` 容器的 `clientWidth / gridColumns`。原站的容器是全宽的 `[data-super-mona-grid]`（约等于视口内容宽），配合 `94 / 67` 列得到约 `12.5px` 的方块（1191px 视口）；demo 因此把 `data-grid` 放在 `<body>` 上并沿用默认列数。想固定尺寸就传 `gridColumns: 具体数字` + 把 `fallbackCellSize` 设为想要的值并去掉 `data-grid` 属性。

**Q：滚动时方块错位？**
方块用 `position: fixed` + `clientX/clientY` 定位，滚动时不会跟着内容移动。但寿命只有 100~400ms，实际几乎不可见。若需要贴合滚动内容，可改用 `pageX/pageY` + `position: absolute`。

**Q：能在 SSR 里直接 new 吗？**
构造时会检测 `window` / `document`，不存在时退化为空实例（`destroyed = true`），不会抛错。但仍建议在 `useEffect` / `onMounted` 里初始化。

---

## 本地验证

```bash
pnpm check
pnpm build
pnpm dev       # 源码调试：http://localhost:5173/demo.html
pnpm preview   # 产物预览：dist/demo.html
npm pack --dry-run   # 仅本地校验 tarball 内容，不执行发布
```

- `pnpm dev` 会把 `src/index.ts` 以 ESM 注入 `demo.html`，修改源码可热更新；`dist/demo.html` 则只引用构建后的 UMD 产物。
- 直接双击 `dist/demo.html`（`file://`）或通过 `pnpm preview` / 任意静态服务器打开，都能看到拖尾；UMD 普通脚本不受模块 CORS 限制。
- 演示页包含按钮、链接、输入框、正文段落、未标记白名单的页脚，可逐一验证黑名单 / 白名单；控制区可查看累计点亮次数、停用 / 启用和销毁实例。
- `npm pack --dry-run` 应显示 `dist/` 7 个产物、`src/index.ts`、`README.md` 与 `LICENSE`；`.gitignore` 忽略 `dist/` 不影响 `files` 白名单打包。
- 建议至少在 Chromium 与一处非 Chromium 浏览器各打开一次 demo，确认拖尾、计数、启停与销毁均正常。
