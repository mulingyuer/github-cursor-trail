import { defineConfig } from "vite";

export default defineConfig({
	build: {
		emptyOutDir: true,
		minify: false,
		sourcemap: true,
		rollupOptions: {
			output: {
				exports: "named",
			},
		},
		lib: {
			entry: "src/index.ts",
			name: "github-cursor-trail",
			formats: ["es", "umd"],
			fileName: (format) => (format === "es" ? "cursor-trail.js" : "cursor-trail.umd.js"),
		},
	},
});
