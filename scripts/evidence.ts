// Evidence coverage for aby: what is sourced, what is inherited, what is guessed.
// Read-only, no store access, no model. Run inside nix develop:
//   node scripts/evidence.ts
import { renderCoverage } from "../src/evidence/report.ts";

for (const line of renderCoverage(process.stdout.columns ?? 80)) console.log(line);
