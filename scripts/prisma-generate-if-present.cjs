#!/usr/bin/env node
const { existsSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

const generatedClientDir = "node_modules/.prisma/client";
const schemaEngineBinary = process.platform === "win32"
  ? `${generatedClientDir}/schema-engine-windows.exe`
  : `${generatedClientDir}/schema-engine`;

if (!existsSync(generatedClientDir)) {
  console.log(`[prisma:generate:if-present] Skipping: ${generatedClientDir} is missing.`);
  console.log("[prisma:generate:if-present] Run `npm run prisma:generate` in a networked environment first.");
  process.exit(0);
}

if (!existsSync(schemaEngineBinary)) {
  console.log(`[prisma:generate:if-present] Skipping: Prisma engine binary not found at ${schemaEngineBinary}.`);
  console.log("[prisma:generate:if-present] Existing generated client can still be used offline.");
  process.exit(0);
}

const prismaBin = process.platform === "win32" ? "prisma.cmd" : "prisma";
const result = spawnSync(prismaBin, ["generate"], { stdio: "inherit" });
process.exit(result.status ?? 1);
