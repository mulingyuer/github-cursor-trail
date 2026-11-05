import { access, readFile, writeFile } from "node:fs/promises";

const placeholder = "<!-- CURSOR_TRAIL_ENTRY -->";
const umdPath = new URL("../dist/cursor-trail.umd.js", import.meta.url);
const demoPath = new URL("../demo.html", import.meta.url);
const outputPath = new URL("../dist/demo.html", import.meta.url);

try {
	await access(umdPath);
} catch {
	console.error("dist/cursor-trail.umd.js 不存在，请先运行 pnpm run build:lib");
	process.exit(1);
}

const html = await readFile(demoPath, "utf8");
if (!html.includes(placeholder)) {
	console.error("demo.html 缺少 CURSOR_TRAIL_ENTRY 占位标记");
	process.exit(1);
}

const output = html
	.replace(/\r\n/g, "\n")
	.replace(placeholder, '<script src="./cursor-trail.umd.js"></script>');

await writeFile(outputPath, output, "utf8");
console.log("已生成 dist/demo.html");
