import { readFile } from "node:fs/promises";

export const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));
