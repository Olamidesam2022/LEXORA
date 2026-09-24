import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const [, , command, platform] = process.argv;

const shouldBuild = ["sync", "copy", "run"].includes(command);
const capBin = join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "cap.cmd" : "cap",
);

function run(label, executable, args) {
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(`${label} failed: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runCapacitor(args) {
  if (process.platform === "win32") {
    run("capacitor", "cmd.exe", ["/d", "/s", "/c", capBin, ...args]);
    return;
  }

  run("capacitor", capBin, args);
}

if (!command) {
  console.error("Usage: node scripts/capacitor-workflow.mjs <sync|copy|run|open> [android|ios]");
  process.exit(1);
}

if (!existsSync(capBin)) {
  console.error("Capacitor CLI not found. Run npm install first.");
  process.exit(1);
}

if (shouldBuild) {
  run("vite build", process.execPath, ["./node_modules/vite/bin/vite.js", "build"]);
}

runCapacitor([command, platform].filter(Boolean));
