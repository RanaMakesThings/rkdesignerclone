import { readFile } from "node:fs/promises";

export const readMarkdown = async (filePath) => readFile(filePath, "utf8");
