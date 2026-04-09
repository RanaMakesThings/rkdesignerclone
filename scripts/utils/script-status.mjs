#!/usr/bin/env node

import process from "node:process";

const args = process.argv.slice(2);
const ok = args[0] === "--ok";
const message = ok ? args.slice(1).join(" ") : args.join(" ");

if (message) {
  if (ok) {
    console.log(message);
  } else {
    console.error(message);
  }
}

process.exit(ok ? 0 : 1);
