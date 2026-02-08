// build.js
import fs from "fs";

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

fs.writeFileSync(
  "src/library.js",
  files.map(f => fs.readFileSync(f, "utf8")).join("\n\n")
);
