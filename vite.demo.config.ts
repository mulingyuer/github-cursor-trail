import { defineConfig, type Plugin } from "vite";

const devEntry = `<script type="module">
  import * as cursorTrail from "/src/index.ts";
  window["github-cursor-trail"] = cursorTrail;
  window.dispatchEvent(new Event("cursor-trail-ready"));
</script>`;

function rewriteRoot(req: unknown, next: () => void): void {
	const request = req as { url?: string };
	const pathname = request.url?.split("?")[0];
	if (pathname === "/" || pathname === "/index.html") request.url = "/demo.html";
	next();
}

const cursorTrailDemoPlugin: Plugin = {
	name: "cursor-trail-demo-entry",
	transformIndexHtml(html: string) {
		if (!html.includes("<!-- CURSOR_TRAIL_ENTRY -->")) return html;
		return html.replace("<!-- CURSOR_TRAIL_ENTRY -->", devEntry);
	},
	configureServer(server) {
		server.middlewares.use((req, _res, next) => rewriteRoot(req, next));
	},
	configurePreviewServer(server) {
		server.middlewares.use((req, _res, next) => rewriteRoot(req, next));
	},
};

export default defineConfig({
	plugins: [cursorTrailDemoPlugin],
	server: {
		open: "/demo.html",
	},
	preview: {
		open: "/demo.html",
	},
	build: {
		outDir: "dist",
		emptyOutDir: false,
	},
});
