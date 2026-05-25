const esbuild = require("esbuild");

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const minify = args.includes("--minify");

const buildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node16",
  sourcemap: !minify,
  minify: minify,
  logLevel: "info",
};

async function run() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log("esbuild: watching...");
  } else {
    await esbuild.build(buildOptions);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
