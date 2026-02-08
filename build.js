// build.js
import fs from "fs";
import { minify } from "terser";

const files = [
  "src/library/settings.js",
  "src/library/utils.js",
  "src/library/config.js",
  "src/library/agent.js",
  "src/library/prompts.js",
  "src/library/contextHook.js",
  "src/library/outputHook.js",
  "src/library/main.js"
];

// ---- CLI flags ----
const args = process.argv.slice(2);
const doMinify = args.includes("--minify");

const formatArg = args.find(a => a.startsWith("--format="));
const format = formatArg ? formatArg.split("=")[1] : "pretty";

async function build() {
  const combined = files
    .map(f => fs.readFileSync(f, "utf8"))
    .join("\n");

  const result = await minify(combined, {
    ecma: 2022,

    compress: doMinify
      ? {
          defaults: true,
          unsafe: false,
          passes: 1
        }
      : false,

    mangle: doMinify
      ? {
          toplevel: false
        }
      : false,

    format:
      format === "minified"
        ? {
            comments: false
          }
        : {
            comments: true,
            beautify: true,
            indent_level: 2,
            max_line_len: 1000
          }
  });

  if (!result.code) {
    throw new Error("Minification failed");
  }

  fs.writeFileSync("src/library.js", result.code);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
