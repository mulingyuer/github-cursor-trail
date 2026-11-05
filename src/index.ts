/**
 * CursorTrail —— 网格吸附式鼠标拖尾（TypeScript，零依赖，框架无关）
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 来源
 * ────────────────────────────────────────────────────────────────────────────
 * 逆向自 githubuniverse.com 首页的 `CursorTrailAnimation` 组件
 * （Next.js chunk `2834.*.js` 的模块 2834，样式 `2965825f79450fa2.css`）。
 *
 * 原站实现是 React + CSS Modules，本文件把它改写成不依赖任何框架、任何第三方
 * 库的纯 TypeScript 类：直接操作 DOM，可直接用于原生页面，也可以包一层
 * `useEffect` 用在 React / Vue 里（见 README）。
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 原理（四句话）
 * ────────────────────────────────────────────────────────────────────────────
 * 1. 预先创建 N 个（默认 40）常驻的 `position: fixed` 方块，默认 `scale(0)` 不可见；
 * 2. `document` 上只挂一个 `mousemove` 监听（事件委托），用 `closest()` 做
 *    「白名单区域 + 黑名单元素」判定，交互元素上直接 return，根本不生成方块；
 * 3. 把鼠标坐标 **量化（snap）到网格**：`floor((x - left) / cell) * cell`，
 *    所以拖尾是一串对齐网格的彩色 ASCII 方块，而不是平滑的丝带；
 * 4. 用一个环形游标 `(i + 1) % N` 复用槽位，每个方块 100~400ms 后被移除
 *    `active` 类，`scale(1) → scale(0)` 缩回消失，先后亮灭即形成拖尾。
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 为什么不影响页面使用（本实现最值得复用的部分）
 * ────────────────────────────────────────────────────────────────────────────
 * - `pointer-events: none`：方块完全不参与命中测试，不拦截点击 / hover；
 * - 黑名单从源头拦截：`a` / `button` / 表单控件 / `.trailAnimationIgnore`；
 * - 白名单 + `getBoundingClientRect()` 二次校验：只在装饰性留白区域生效；
 * - 跳过纯文本叶子节点：避免彩色方块盖住正文；
 * - `aria-hidden` + `prefers-reduced-motion`：无障碍，系统要求减弱动效时整体停用。
 *
 * @example
 * ```ts
 * import { CursorTrail } from "github-cursor-trail";
 * const trail = new CursorTrail();
 * // 页面卸载时：trail.destroy();
 * ```
 */

/* ══════════════════════════════════════════════════════════════════════════
 * 一、公开类型
 * ══════════════════════════════════════════════════════════════════════════ */

/** 一个槽位被点亮时的快照，用于 `onSpawn` 回调与调试。 */
export interface TrailCellSnapshot {
	/** 环形缓冲中的槽位下标，范围 `[0, poolSize)`。 */
	readonly index: number;
	/** 量化后方块左上角的视口 X 坐标（px）。 */
	readonly x: number;
	/** 量化后方块左上角的视口 Y 坐标（px）。 */
	readonly y: number;
	/** 本帧的格子边长（px）。 */
	readonly size: number;
	/** 随机选中的背景色。 */
	readonly color: string;
	/** 随机选中的符号，可能是单个空格。 */
	readonly glyph: string;
}

/** `CursorTrail` 构造参数，全部可选。 */
export interface CursorTrailOptions {
	/**
	 * 允许触发的「区域」选择器（白名单）。只有鼠标所在元素能 `closest()` 到它时才生效。
	 * 原站叫 `.trailAnimationArea`，只挂在 hero / 视频区 / footer 等装饰性 section 上。
	 * @default '.trailAnimationArea'
	 */
	areaSelector?: string;

	/**
	 * 追加的白名单选择器，会与 `areaSelector` 拼成 `a, b` 形式。
	 * 原站额外允许 `[class^='Primer_Brand__river-shared-module__River__heading']`。
	 * @default ''（不追加）
	 */
	extraAreaSelector?: string;

	/**
	 * 忽略选择器（黑名单）。命中即 `return`，**不生成**方块。
	 * 默认值比原站更完整，补上了表单控件与 `role="button"`。
	 * @default '.trailAnimationIgnore, button, a, input, textarea, select, [role="button"], [contenteditable="true"]'
	 */
	ignoreSelector?: string;

	/**
	 * 常驻 DOM 方块数量（环形缓冲容量）。数量越大，快速滑动时拖尾越长、越不容易
	 * 出现「方块被提前复用而瞬移」；40 是原站的取值。
	 * @default 40
	 */
	poolSize?: number;

	/** 随机背景色池，对应原站的 6 个 Universe 品牌色。 */
	colors?: readonly string[];

	/** 随机符号池，对应原站的 ASCII 字符数组。 */
	glyphs?: readonly string[];

	/**
	 * 符号为空格的概率，用来让拖尾有「疏密」节奏，不是每格都有字。
	 * @default 0.3
	 */
	blankProbability?: number;

	/**
	 * 单个方块的存活时间区间 `[min, max]`（ms），每次在区间内随机取值。
	 * 随机化是为了让方块不会整齐地一起熄灭。
	 * @default [100, 400]
	 */
	lifetimeMs?: readonly [number, number];

	/**
	 * 网格列数。传数字则固定；传函数可按视口宽度动态返回。
	 * 默认复刻原站：`innerWidth <= 1011 ? 67 : 94`。
	 */
	gridColumns?: number | ((viewportWidth: number) => number);

	/**
	 * 用来取「网格容器宽度」的选择器。格子边长 = 容器 clientWidth / 列数。
	 * 原站用 `[data-super-mona-grid]`（Super Mona 小游戏的容器），本实现默认用
	 * 更通用的 `[data-grid]`。若页面没有该容器，退化为 `fallbackCellSize`。
	 * @default '[data-grid]'
	 */
	gridSelector?: string;

	/** 找不到网格容器时的格子边长兜底值（px）。 @default 17 */
	fallbackCellSize?: number;

	/**
	 * 是否跳过「纯文本叶子节点」（没有子元素、且 textContent 非空的标签）。
	 * 开启后鼠标划过正文段落不会弹方块，避免遮挡文字；容器型元素仍然生效。
	 * @default true
	 */
	skipTextLeaves?: boolean;

	/**
	 * 是否跟随系统 `prefers-reduced-motion` 自动启停。
	 * @default true
	 */
	respectReducedMotion?: boolean;

	/**
	 * 监听的事件名。`pointermove` 可覆盖触屏/触控笔，但要注意触屏会产生大量事件。
	 * 原站使用 `mousemove`。
	 * @default 'mousemove'
	 */
	eventName?: "mousemove" | "pointermove";

	/** 方块挂载到的容器。 @default document.body */
	container?: HTMLElement;

	/** CSS 类名前缀，用于避免样式冲突。 @default 'ct' */
	classPrefix?: string;

	/**
	 * 是否自动向 `<head>` 注入内置样式。
	 * 设为 `false` 时需自行在项目中编写 `.ct-*` 样式（见 README）。
	 * @default true
	 */
	injectStyles?: boolean;

	/** 方块的 `z-index`。 @default 2 */
	zIndex?: number;

	/** `scale(0) ↔ scale(1)` 过渡时长（ms）。 @default 100 */
	transitionMs?: number;

	/** 过渡缓动曲线。 @default 'cubic-bezier(.3,.41,.04,1.01)' */
	transitionEasing?: string;

	/**
	 * 方块内符号的颜色。原站不设置该属性，直接继承页面文字色。
	 * @default 'inherit'
	 */
	glyphColor?: string;

	/** 每点亮一个方块时回调，便于埋点或调试。 */
	onSpawn?: (cell: TrailCellSnapshot) => void;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 二、内部类型与默认值
 * ══════════════════════════════════════════════════════════════════════════ */

/** 单个槽位的可变状态。DOM 节点常驻，这里只记录逻辑状态。 */
interface CellState {
	x: number;
	y: number;
	size: number;
	active: boolean;
}

/** 所有配置解析完毕后的形态：`gridColumns` 统一成函数，容器可能为 null（SSR）。 */
interface ResolvedOptions {
	areaSelector: string;
	extraAreaSelector: string;
	ignoreSelector: string;
	poolSize: number;
	colors: readonly string[];
	glyphs: readonly string[];
	blankProbability: number;
	lifetimeMs: readonly [number, number];
	gridColumns: (viewportWidth: number) => number;
	gridSelector: string;
	fallbackCellSize: number;
	skipTextLeaves: boolean;
	respectReducedMotion: boolean;
	eventName: "mousemove" | "pointermove";
	container: HTMLElement | null;
	classPrefix: string;
	injectStyles: boolean;
	zIndex: number;
	transitionMs: number;
	transitionEasing: string;
	glyphColor: string;
	onSpawn?: (cell: TrailCellSnapshot) => void;
}

/** 原站的响应式网格：窄屏 67 列，宽屏 94 列。 */
const defaultGridColumns = (viewportWidth: number): number => (viewportWidth <= 1011 ? 67 : 94);

/** 原站的 6 个 Universe 品牌色。 */
const DEFAULT_COLORS = ["#ae85ff", "#f73678", "#c05200", "#583af7", "#5fed83", "#bba00a"] as const;

/** 原站的 ASCII 符号池。 */
const DEFAULT_GLYPHS = ["-", "/", ")", ".", "+", "=", ">", "<", "*", "&", "("] as const;

/** 黑名单默认值：在原站基础上补齐了表单控件与 ARIA 按钮。 */
const DEFAULT_IGNORE_SELECTOR = [
	".trailAnimationIgnore",
	"button",
	"a",
	"input",
	"textarea",
	"select",
	'[role="button"]',
	'[contenteditable="true"]',
].join(", ");

const ACTIVE_CLASS = "is-active";

/** 从数组里随机取一项。调用前保证数组非空（见 `resolveOptions`）。 */
function pick<T>(list: readonly T[]): T {
	return list[Math.floor(Math.random() * list.length)] as T;
}

/** 合并默认值并做参数校验。SSR 环境下 `document` 不存在，容器保持 null。 */
function resolveOptions(input: CursorTrailOptions): ResolvedOptions {
	const poolSize = input.poolSize ?? 40;
	const colors = input.colors ?? DEFAULT_COLORS;
	const glyphs = input.glyphs ?? DEFAULT_GLYPHS;
	const columns = input.gridColumns ?? defaultGridColumns;
	const lifetimeMs = input.lifetimeMs ?? ([100, 400] as const);

	if (!Number.isFinite(poolSize) || poolSize < 1) {
		throw new RangeError("[CursorTrail] poolSize 必须是 >= 1 的整数");
	}
	if (colors.length === 0 || glyphs.length === 0) {
		throw new RangeError("[CursorTrail] colors / glyphs 不能为空");
	}
	if (lifetimeMs[0] < 0 || lifetimeMs[1] < lifetimeMs[0]) {
		throw new RangeError("[CursorTrail] lifetimeMs 需满足 0 <= min <= max");
	}

	return {
		areaSelector: input.areaSelector ?? ".trailAnimationArea",
		extraAreaSelector: input.extraAreaSelector ?? "",
		ignoreSelector: input.ignoreSelector ?? DEFAULT_IGNORE_SELECTOR,
		poolSize: Math.floor(poolSize),
		colors,
		glyphs,
		blankProbability: Math.min(1, Math.max(0, input.blankProbability ?? 0.3)),
		lifetimeMs,
		// 数字配置统一包装成函数，运行时只需调用一次，不必分支判断。
		gridColumns: typeof columns === "number" ? () => columns : columns,
		gridSelector: input.gridSelector ?? "[data-grid]",
		fallbackCellSize: input.fallbackCellSize ?? 17,
		skipTextLeaves: input.skipTextLeaves ?? true,
		respectReducedMotion: input.respectReducedMotion ?? true,
		eventName: input.eventName ?? "mousemove",
		container: input.container ?? (typeof document === "undefined" ? null : document.body),
		classPrefix: input.classPrefix ?? "ct",
		injectStyles: input.injectStyles ?? true,
		zIndex: input.zIndex ?? 2,
		transitionMs: input.transitionMs ?? 100,
		transitionEasing: input.transitionEasing ?? "cubic-bezier(.3,.41,.04,1.01)",
		glyphColor: input.glyphColor ?? "inherit",
		onSpawn: input.onSpawn,
	};
}

/**
 * 生成内置样式。
 *
 * 注意：root 上**不能**出现 `transform` / `filter` / `perspective` / `contain`，
 * 否则会变成 `position: fixed` 子元素的包含块，方块就不再相对视口定位了。
 */
function buildStyles(o: ResolvedOptions): string {
	const p = o.classPrefix;
	return `
.${p}-root { pointer-events: none; }
.${p}-root[hidden] { display: none; }
.${p}-block {
  position: fixed;
  top: 0;
  left: 0;
  z-index: ${o.zIndex};
  text-align: center;
  line-height: 1.5;
  pointer-events: none;
}
.${p}-color {
  display: block;
  width: 100%;
  height: 100%;
  color: ${o.glyphColor};
  transform: scale(0);
  transition: transform ${o.transitionMs}ms ${o.transitionEasing};
}
.${p}-block.${ACTIVE_CLASS} .${p}-color { transform: scale(1); }
`.trim();
}

/* ══════════════════════════════════════════════════════════════════════════
 * 三、主体
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * 网格吸附式鼠标拖尾。
 *
 * 生命周期：`new CursorTrail()` → （自动启用）→ `disable()` / `enable()` → `destroy()`。
 * 同一个容器重复 `new` 时会自动销毁旧实例，不会叠加监听器和 DOM 节点。
 */
export class CursorTrail {
	/** 容器 → 实例，防止重复实例化造成内存泄漏。 */
	private static readonly instances = new WeakMap<HTMLElement, CursorTrail>();

	private readonly opts: ResolvedOptions;
	private readonly root: HTMLElement | null = null;
	private readonly styleEl: HTMLStyleElement | null = null;
	private readonly host: HTMLElement | null = null;
	private readonly motionQuery: MediaQueryList | null = null;

	/** 与 `blocks[i]` / `inners[i]` / `cells[i]` 一一对应，长度恒为 poolSize。 */
	private readonly blocks: HTMLElement[] = [];
	private readonly inners: HTMLElement[] = [];
	private readonly cells: CellState[] = [];

	/** 槽位下标 → 该槽位的消失定时器。复用槽位前必须先清掉旧定时器。 */
	private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

	/** 环形游标，指向「上一个被使用」的槽位。 */
	private cursor = 0;

	/** 上一次命中的网格坐标，用于「同一格不重复触发」节流。 */
	private lastX = Number.NaN;
	private lastY = Number.NaN;

	private running = false;
	private destroyed = false;

	/**
	 * 用户是否显式调用过 `enable()` / `disable()`。
	 * 为 `null` 表示完全交给系统动效偏好自动控制；非 null 时用户意图优先。
	 */
	private manualOverride: boolean | null = null;

	constructor(options: CursorTrailOptions = {}) {
		this.opts = resolveOptions(options);

		// SSR / Node 环境：安静地退化为空实例，不访问 window / document。
		if (typeof window === "undefined" || typeof document === "undefined") {
			this.destroyed = true;
			return;
		}

		const host = this.opts.container ?? document.body;
		this.host = host;
		CursorTrail.instances.get(host)?.destroy();

		const p = this.opts.classPrefix;

		// ① 注入样式（只注入自己那一份，destroy 时精确移除）。
		if (this.opts.injectStyles) {
			const style = document.createElement("style");
			style.dataset.cursorTrail = p;
			style.textContent = buildStyles(this.opts);
			document.head.appendChild(style);
			this.styleEl = style;
		}

		// ② 一次性创建 poolSize 个常驻方块；之后只改 style / class，不再增删 DOM。
		const root = document.createElement("div");
		root.className = `${p}-root`;
		root.setAttribute("aria-hidden", "true"); // 随机符号不该被屏幕阅读器念出来
		this.root = root;

		for (let i = 0; i < this.opts.poolSize; i += 1) {
			const block = document.createElement("div");
			block.className = `${p}-block`;
			block.setAttribute("aria-hidden", "true");

			const inner = document.createElement("div");
			inner.className = `${p}-color`;
			block.appendChild(inner);
			root.appendChild(block);

			this.blocks.push(block);
			this.inners.push(inner);
			this.cells.push({ x: 0, y: 0, size: 0, active: false });
		}
		host.appendChild(root);

		// ③ 无障碍：监听系统「减弱动效」偏好，运行时变化也能立即生效。
		if (this.opts.respectReducedMotion && typeof window.matchMedia === "function") {
			this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
			if (typeof this.motionQuery.addEventListener === "function") {
				this.motionQuery.addEventListener("change", this.handleMotionChange);
			} else {
				// 兼容旧版 Safari（addListener 已废弃，但类型定义仍存在）。
				this.motionQuery.addListener(this.handleMotionChange);
			}
		}

		CursorTrail.instances.set(host, this);

		// ④ 初次启用：系统要求减弱动效则保持停用。
		if (this.prefersReducedMotion()) this.suspend();
		else this.resume();
	}

	/** 当前是否正在监听鼠标事件。 */
	public get isEnabled(): boolean {
		return this.running;
	}

	/** 手动启用。调用后系统动效偏好不再自动覆盖用户意图。 */
	public enable(): void {
		this.manualOverride = false;
		this.resume();
	}

	/** 手动停用：移除监听、清空所有正在显示的方块。 */
	public disable(): void {
		this.manualOverride = true;
		this.suspend();
	}

	/**
	 * 彻底销毁：解绑事件、清除全部定时器、移除注入的样式与 DOM。
	 * 组件卸载 / 路由切换时务必调用，否则会残留 document 级监听。
	 */
	public destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.suspend();

		if (this.motionQuery) {
			if (typeof this.motionQuery.removeEventListener === "function") {
				this.motionQuery.removeEventListener("change", this.handleMotionChange);
			} else {
				this.motionQuery.removeListener(this.handleMotionChange);
			}
		}

		this.styleEl?.remove();
		this.root?.remove();
		this.blocks.length = 0;
		this.inners.length = 0;
		this.cells.length = 0;

		if (this.host) CursorTrail.instances.delete(this.host);
	}

	/* ── 内部：启停 ────────────────────────────────────────────────────────── */

	private prefersReducedMotion(): boolean {
		return this.motionQuery?.matches ?? false;
	}

	private resume(): void {
		if (this.destroyed || this.running || !this.root) return;
		this.running = true;
		this.root.hidden = false;
		// passive: 明确声明不调用 preventDefault，浏览器可优化滚动性能。
		document.addEventListener(this.opts.eventName, this.handleMove as EventListener, {
			passive: true,
		});
	}

	private suspend(): void {
		if (!this.running) {
			if (this.root) this.root.hidden = true;
			return;
		}
		this.running = false;
		document.removeEventListener(this.opts.eventName, this.handleMove as EventListener);
		this.clearAllCells();
		if (this.root) this.root.hidden = true;
	}

	private readonly handleMotionChange = (event: MediaQueryListEvent): void => {
		if (this.manualOverride !== null || this.destroyed) return;
		if (event.matches) this.suspend();
		else this.resume();
	};

	/* ── 内部：mousemove 主逻辑 ───────────────────────────────────────────── */

	/**
	 * 用箭头函数绑定 this，保证 add/removeEventListener 传入的是同一个引用。
	 *
	 * 对应原站 chunk 2834 里那个 `l = (r) => {...}` 监听器，步骤编号保持一致。
	 */
	private readonly handleMove = (event: MouseEvent): void => {
		if (!this.running || this.destroyed) return;

		const target = event.target;
		// 事件目标可能是 document / window / 文本节点，必须收敛到 Element 才能 closest()。
		if (!(target instanceof Element)) return;

		// ① 白名单：必须落在标记为「允许」的区域内。
		const areaSelector = this.opts.extraAreaSelector
			? `${this.opts.areaSelector}, ${this.opts.extraAreaSelector}`
			: this.opts.areaSelector;
		const area = target.closest(areaSelector);
		if (!area) return;

		// ② 黑名单：交互元素（及其任意子元素）命中即返回 —— 从源头不生成方块。
		//    这是「不影响页面使用」最关键的一行，配合 CSS 的 pointer-events: none 双保险。
		if (this.opts.ignoreSelector && target.closest(this.opts.ignoreSelector)) return;

		const { clientX, clientY } = event;

		// ③ 二次校验：鼠标必须真的在区域矩形内（防止嵌套区域 / 溢出内容误触）。
		const bounds = area.getBoundingClientRect();
		if (
			clientX < bounds.left ||
			clientX > bounds.right ||
			clientY < bounds.top ||
			clientY > bounds.bottom
		) {
			return;
		}

		// ④ 计算本帧的格子边长。
		//    优先取鼠标所在的最近网格容器，取不到就用页面上第一个（与原站一致）。
		const grid =
			target.closest(this.opts.gridSelector) ?? document.querySelector(this.opts.gridSelector);
		const gridWidth = grid instanceof HTMLElement ? grid.clientWidth : 0;
		const columns = Math.max(1, this.opts.gridColumns(window.innerWidth));
		const size = gridWidth > 0 ? gridWidth / columns : this.opts.fallbackCellSize;
		if (!Number.isFinite(size) || size <= 0) return;

		// ⑤ 网格量化：把连续坐标吸附到格子左上角。
		//    这就是拖尾看起来是「规整像素块」而不是平滑曲线的原因。
		const origin = gridWidth > 0 && grid ? grid.getBoundingClientRect() : { left: 0, top: 0 };
		const x = origin.left + Math.floor((clientX - origin.left) / size) * size;
		const y = origin.top + Math.floor((clientY - origin.top) / size) * size;

		// ⑥ 节流：同一格不重复触发；该格已有活跃方块时也跳过。
		if (x === this.lastX && y === this.lastY) return;
		if (this.cells.some((c) => c.active && c.x === x && c.y === y && c.size === size)) {
			return;
		}

		// ⑦ 跳过纯文本叶子节点，避免彩色方块压住正文。
		if (this.opts.skipTextLeaves && this.isPlainTextLeaf(target)) return;

		this.lastX = x;
		this.lastY = y;
		this.spawn(x, y, size);
	};

	/**
	 * 判断是否为「承载正文的纯文本叶子」。
	 * 原站条件 `(children.length !== 0 || text === '') && tag !== 'BUTTON' && tag !== 'A'`
	 * 取反后正是这里：无子元素 + 有文字 + 非按钮/链接 → 应跳过。
	 */
	private isPlainTextLeaf(el: Element): boolean {
		if (el.tagName === "BUTTON" || el.tagName === "A") return false;
		return el.children.length === 0 && (el.textContent?.trim() ?? "") !== "";
	}

	/* ── 内部：生成与回收 ─────────────────────────────────────────────────── */

	/** 环形复用一个槽位并点亮它。 */
	private spawn(x: number, y: number, size: number): void {
		const index = (this.cursor = (this.cursor + 1) % this.opts.poolSize);

		// 槽位可能仍有一个「待熄灭」的旧方块，先取消它的定时器，
		// 否则旧回调会在新方块刚亮起时把它关掉。
		const previous = this.timers.get(index);
		if (previous !== undefined) clearTimeout(previous);

		const color = pick(this.opts.colors);
		const glyph = Math.random() < this.opts.blankProbability ? " " : pick(this.opts.glyphs);

		const block = this.blocks[index];
		const inner = this.inners[index];
		const cell = this.cells[index];

		cell.x = x;
		cell.y = y;
		cell.size = size;
		cell.active = true;

		// 只改 transform / 尺寸 / 颜色 / 文本：全部走合成层或局部样式，不触发整页重排。
		block.style.transform = `translate(${x}px, ${y}px)`;
		block.style.width = `${size}px`;
		block.style.height = `${size}px`;
		block.style.fontSize = `${size * 0.45}px`; // 原站的字号比例
		inner.style.backgroundColor = color;
		inner.textContent = glyph;
		block.classList.add(ACTIVE_CLASS);

		// 随机存活时间：让方块错峰熄灭，拖尾才有自然的衰减感。
		const [min, max] = this.opts.lifetimeMs;
		const ttl = min + Math.random() * (max - min);
		const timer = setTimeout(() => this.despawn(index), ttl);
		this.timers.set(index, timer);

		this.opts.onSpawn?.({ index, x, y, size, color, glyph });
	}

	/** 熄灭单个槽位（移除 active，CSS 负责 scale(1) → scale(0) 的动画）。 */
	private despawn(index: number): void {
		const timer = this.timers.get(index);
		if (timer !== undefined) clearTimeout(timer);
		this.timers.delete(index);
		this.cells[index].active = false;
		this.blocks[index].classList.remove(ACTIVE_CLASS);
	}

	/** 停用时清空所有方块与定时器，避免残留半截拖尾。 */
	private clearAllCells(): void {
		for (const timer of this.timers.values()) clearTimeout(timer);
		this.timers.clear();
		for (let i = 0; i < this.blocks.length; i += 1) {
			this.cells[i].active = false;
			this.blocks[i].classList.remove(ACTIVE_CLASS);
		}
		this.lastX = Number.NaN;
		this.lastY = Number.NaN;
	}
}

/** 便捷工厂，等价于 `new CursorTrail(options)`。 */
export function createCursorTrail(options?: CursorTrailOptions): CursorTrail {
	return new CursorTrail(options);
}

export default CursorTrail;
