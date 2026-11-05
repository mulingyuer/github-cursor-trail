(function(global, factory) {
	typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global["github-cursor-trail"] = {}));
})(this, function(exports) {
	Object.defineProperties(exports, {
		__esModule: { value: true },
		[Symbol.toStringTag]: { value: "Module" }
	});
	// src/index.ts
	/** 原站的响应式网格：窄屏 67 列，宽屏 94 列。 */
	var defaultGridColumns = (viewportWidth) => viewportWidth <= 1011 ? 67 : 94;
	/** 原站的 6 个 Universe 品牌色。 */
	var DEFAULT_COLORS = [
		"#ae85ff",
		"#f73678",
		"#c05200",
		"#583af7",
		"#5fed83",
		"#bba00a"
	];
	/** 原站的 ASCII 符号池。 */
	var DEFAULT_GLYPHS = [
		"-",
		"/",
		")",
		".",
		"+",
		"=",
		">",
		"<",
		"*",
		"&",
		"("
	];
	/** 黑名单默认值：在原站基础上补齐了表单控件与 ARIA 按钮。 */
	var DEFAULT_IGNORE_SELECTOR = [
		".trailAnimationIgnore",
		"button",
		"a",
		"input",
		"textarea",
		"select",
		"[role=\"button\"]",
		"[contenteditable=\"true\"]"
	].join(", ");
	var ACTIVE_CLASS = "is-active";
	/** 从数组里随机取一项。调用前保证数组非空（见 `resolveOptions`）。 */
	function pick(list) {
		return list[Math.floor(Math.random() * list.length)];
	}
	/** 合并默认值并做参数校验。SSR 环境下 `document` 不存在，容器保持 null。 */
	function resolveOptions(input) {
		const poolSize = input.poolSize ?? 40;
		const colors = input.colors ?? DEFAULT_COLORS;
		const glyphs = input.glyphs ?? DEFAULT_GLYPHS;
		const columns = input.gridColumns ?? defaultGridColumns;
		const lifetimeMs = input.lifetimeMs ?? [100, 400];
		if (!Number.isFinite(poolSize) || poolSize < 1) throw new RangeError("[CursorTrail] poolSize 必须是 >= 1 的整数");
		if (colors.length === 0 || glyphs.length === 0) throw new RangeError("[CursorTrail] colors / glyphs 不能为空");
		if (lifetimeMs[0] < 0 || lifetimeMs[1] < lifetimeMs[0]) throw new RangeError("[CursorTrail] lifetimeMs 需满足 0 <= min <= max");
		return {
			areaSelector: input.areaSelector ?? ".trailAnimationArea",
			extraAreaSelector: input.extraAreaSelector ?? "",
			ignoreSelector: input.ignoreSelector ?? DEFAULT_IGNORE_SELECTOR,
			poolSize: Math.floor(poolSize),
			colors,
			glyphs,
			blankProbability: Math.min(1, Math.max(0, input.blankProbability ?? .3)),
			lifetimeMs,
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
			onSpawn: input.onSpawn
		};
	}
	/**
	* 生成内置样式。
	*
	* 注意：root 上**不能**出现 `transform` / `filter` / `perspective` / `contain`，
	* 否则会变成 `position: fixed` 子元素的包含块，方块就不再相对视口定位了。
	*/
	function buildStyles(o) {
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
	/**
	* 网格吸附式鼠标拖尾。
	*
	* 生命周期：`new CursorTrail()` → （自动启用）→ `disable()` / `enable()` → `destroy()`。
	* 同一个容器重复 `new` 时会自动销毁旧实例，不会叠加监听器和 DOM 节点。
	*/
	var CursorTrail = class CursorTrail {
		static {
			this.instances = /* @__PURE__ */ new WeakMap();
		}
		constructor(options = {}) {
			this.root = null;
			this.styleEl = null;
			this.host = null;
			this.motionQuery = null;
			this.blocks = [];
			this.inners = [];
			this.cells = [];
			this.timers = /* @__PURE__ */ new Map();
			this.cursor = 0;
			this.lastX = NaN;
			this.lastY = NaN;
			this.running = false;
			this.destroyed = false;
			this.manualOverride = null;
			this.handleMotionChange = (event) => {
				if (this.manualOverride !== null || this.destroyed) return;
				if (event.matches) this.suspend();
				else this.resume();
			};
			this.handleMove = (event) => {
				if (!this.running || this.destroyed) return;
				const target = event.target;
				if (!(target instanceof Element)) return;
				const areaSelector = this.opts.extraAreaSelector ? `${this.opts.areaSelector}, ${this.opts.extraAreaSelector}` : this.opts.areaSelector;
				const area = target.closest(areaSelector);
				if (!area) return;
				if (this.opts.ignoreSelector && target.closest(this.opts.ignoreSelector)) return;
				const { clientX, clientY } = event;
				const bounds = area.getBoundingClientRect();
				if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) return;
				const grid = target.closest(this.opts.gridSelector) ?? document.querySelector(this.opts.gridSelector);
				const gridWidth = grid instanceof HTMLElement ? grid.clientWidth : 0;
				const columns = Math.max(1, this.opts.gridColumns(window.innerWidth));
				const size = gridWidth > 0 ? gridWidth / columns : this.opts.fallbackCellSize;
				if (!Number.isFinite(size) || size <= 0) return;
				const origin = gridWidth > 0 && grid ? grid.getBoundingClientRect() : {
					left: 0,
					top: 0
				};
				const x = origin.left + Math.floor((clientX - origin.left) / size) * size;
				const y = origin.top + Math.floor((clientY - origin.top) / size) * size;
				if (x === this.lastX && y === this.lastY) return;
				if (this.cells.some((c) => c.active && c.x === x && c.y === y && c.size === size)) return;
				if (this.opts.skipTextLeaves && this.isPlainTextLeaf(target)) return;
				this.lastX = x;
				this.lastY = y;
				this.spawn(x, y, size);
			};
			this.opts = resolveOptions(options);
			if (typeof window === "undefined" || typeof document === "undefined") {
				this.destroyed = true;
				return;
			}
			const host = this.opts.container ?? document.body;
			this.host = host;
			CursorTrail.instances.get(host)?.destroy();
			const p = this.opts.classPrefix;
			if (this.opts.injectStyles) {
				const style = document.createElement("style");
				style.dataset.cursorTrail = p;
				style.textContent = buildStyles(this.opts);
				document.head.appendChild(style);
				this.styleEl = style;
			}
			const root = document.createElement("div");
			root.className = `${p}-root`;
			root.setAttribute("aria-hidden", "true");
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
				this.cells.push({
					x: 0,
					y: 0,
					size: 0,
					active: false
				});
			}
			host.appendChild(root);
			if (this.opts.respectReducedMotion && typeof window.matchMedia === "function") {
				this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
				if (typeof this.motionQuery.addEventListener === "function") this.motionQuery.addEventListener("change", this.handleMotionChange);
				else this.motionQuery.addListener(this.handleMotionChange);
			}
			CursorTrail.instances.set(host, this);
			if (this.prefersReducedMotion()) this.suspend();
			else this.resume();
		}
		/** 当前是否正在监听鼠标事件。 */
		get isEnabled() {
			return this.running;
		}
		/** 手动启用。调用后系统动效偏好不再自动覆盖用户意图。 */
		enable() {
			this.manualOverride = false;
			this.resume();
		}
		/** 手动停用：移除监听、清空所有正在显示的方块。 */
		disable() {
			this.manualOverride = true;
			this.suspend();
		}
		/**
		* 彻底销毁：解绑事件、清除全部定时器、移除注入的样式与 DOM。
		* 组件卸载 / 路由切换时务必调用，否则会残留 document 级监听。
		*/
		destroy() {
			if (this.destroyed) return;
			this.destroyed = true;
			this.suspend();
			if (this.motionQuery) {
				if (typeof this.motionQuery.removeEventListener === "function") this.motionQuery.removeEventListener("change", this.handleMotionChange);
				else this.motionQuery.removeListener(this.handleMotionChange);
			}
			this.styleEl?.remove();
			this.root?.remove();
			this.blocks.length = 0;
			this.inners.length = 0;
			this.cells.length = 0;
			if (this.host) CursorTrail.instances.delete(this.host);
		}
		prefersReducedMotion() {
			return this.motionQuery?.matches ?? false;
		}
		resume() {
			if (this.destroyed || this.running || !this.root) return;
			this.running = true;
			this.root.hidden = false;
			document.addEventListener(this.opts.eventName, this.handleMove, { passive: true });
		}
		suspend() {
			if (!this.running) {
				if (this.root) this.root.hidden = true;
				return;
			}
			this.running = false;
			document.removeEventListener(this.opts.eventName, this.handleMove);
			this.clearAllCells();
			if (this.root) this.root.hidden = true;
		}
		/**
		* 判断是否为「承载正文的纯文本叶子」。
		* 原站条件 `(children.length !== 0 || text === '') && tag !== 'BUTTON' && tag !== 'A'`
		* 取反后正是这里：无子元素 + 有文字 + 非按钮/链接 → 应跳过。
		*/
		isPlainTextLeaf(el) {
			if (el.tagName === "BUTTON" || el.tagName === "A") return false;
			return el.children.length === 0 && (el.textContent?.trim() ?? "") !== "";
		}
		/** 环形复用一个槽位并点亮它。 */
		spawn(x, y, size) {
			const index = this.cursor = (this.cursor + 1) % this.opts.poolSize;
			const previous = this.timers.get(index);
			if (previous !== void 0) clearTimeout(previous);
			const color = pick(this.opts.colors);
			const glyph = Math.random() < this.opts.blankProbability ? " " : pick(this.opts.glyphs);
			const block = this.blocks[index];
			const inner = this.inners[index];
			const cell = this.cells[index];
			cell.x = x;
			cell.y = y;
			cell.size = size;
			cell.active = true;
			block.style.transform = `translate(${x}px, ${y}px)`;
			block.style.width = `${size}px`;
			block.style.height = `${size}px`;
			block.style.fontSize = `${size * .45}px`;
			inner.style.backgroundColor = color;
			inner.textContent = glyph;
			block.classList.add(ACTIVE_CLASS);
			const [min, max] = this.opts.lifetimeMs;
			const ttl = min + Math.random() * (max - min);
			const timer = setTimeout(() => this.despawn(index), ttl);
			this.timers.set(index, timer);
			this.opts.onSpawn?.({
				index,
				x,
				y,
				size,
				color,
				glyph
			});
		}
		/** 熄灭单个槽位（移除 active，CSS 负责 scale(1) → scale(0) 的动画）。 */
		despawn(index) {
			const timer = this.timers.get(index);
			if (timer !== void 0) clearTimeout(timer);
			this.timers.delete(index);
			this.cells[index].active = false;
			this.blocks[index].classList.remove(ACTIVE_CLASS);
		}
		/** 停用时清空所有方块与定时器，避免残留半截拖尾。 */
		clearAllCells() {
			for (const timer of this.timers.values()) clearTimeout(timer);
			this.timers.clear();
			for (let i = 0; i < this.blocks.length; i += 1) {
				this.cells[i].active = false;
				this.blocks[i].classList.remove(ACTIVE_CLASS);
			}
			this.lastX = NaN;
			this.lastY = NaN;
		}
	};
	/** 便捷工厂，等价于 `new CursorTrail(options)`。 */
	function createCursorTrail(options) {
		return new CursorTrail(options);
	}
	exports.CursorTrail = CursorTrail;
	exports.default = CursorTrail;
	exports.createCursorTrail = createCursorTrail;
});

//# sourceMappingURL=cursor-trail.umd.js.map