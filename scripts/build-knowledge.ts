import fs from "node:fs";
import path from "node:path";
import { buildKnowledge } from "../src/agent/knowledge-builder";

const target = path.join(process.cwd(), "src/agent/knowledge.md");
const text = buildKnowledge();
fs.writeFileSync(target, text);
console.log(`knowledge.md: ${text.length} chars, ~${Math.ceil(text.length / 4)} tokens`);
