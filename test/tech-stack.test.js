import test from "node:test";
import assert from "node:assert/strict";

import { renderTechStack } from "../scripts/update-tech-stack.js";

test("renders a ranked, byte-weighted public tech stack", () => {
  const result = renderTechStack(
    new Map([
      ["Python", 800],
      ["TypeScript", 200],
    ]),
  );

  assert.equal(
    result,
    "## Tech stack\n\n<!-- tech-stack:start -->\n- Python — 80.0%\n- TypeScript — 20.0%\n<!-- tech-stack:end -->",
  );
});

test("replaces only the generated section in an existing README", () => {
  const result = renderTechStack(
    new Map([["Python", 10]]),
    "# Marsha\n\nBefore\n\n## Tech stack\n\n<!-- tech-stack:start -->\nold\n<!-- tech-stack:end -->\n\nAfter\n",
  );

  assert.match(result, /^# Marsha/);
  assert.match(result, /- Python — 100.0%/);
  assert.match(result, /After\n$/);
});
