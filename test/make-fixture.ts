// Usage: node test/make-fixture.ts <dir> <scenario> [owner/repo] [branch]
// Creates a fixture repository and prints its baseline commit (empty when none).
import { createFixture, SCENARIOS, type Scenario } from "./fixtures.ts";

const [dir, scenario, repository, branch] = process.argv.slice(2);
if (!dir || !SCENARIOS.includes(scenario as Scenario)) {
  console.error(`Usage: node test/make-fixture.ts <dir> <${SCENARIOS.join("|")}> [owner/repo] [branch]`);
  process.exit(2);
}
const fixture = createFixture(dir, scenario as Scenario, repository, branch);
console.log(fixture.baseline);
