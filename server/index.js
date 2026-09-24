import { readFileSync } from "node:fs";

try {
  const localEnv = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of localEnv.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_whole, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted);
    process.env[match[1]] = value;
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const port = process.env.PORT || 3001;
const { default: app } = await import("./app.js");
app.listen(port, () => console.log(`LEXORA API server listening on port ${port}`));
