// Debug dump: full lessons + quiz history for one roadmap node.
// Read-only, run inside nix develop. Usage: node scripts/dump-node.ts <nodeId>
import * as store from "../src/store.ts";

const node = process.argv[2] ?? "customer-problem-fit";
const lessons = await store.listLessons(node);
console.log("=== LESSONS ===");
for (const l of lessons) console.log(`\n--- ${l.title} (${l.id}) ---\n${l.markdown ?? ""}`);
const quizzes = await store.listQuiz(node);
console.log("\n=== QUIZZES ===");
for (const q of quizzes) {
  console.log(`\nQ: ${q.question}\nKEY: ${q.answerKey}\nA: ${q.response}\nSCORE: ${q.score}`);
}
process.exit(0);
