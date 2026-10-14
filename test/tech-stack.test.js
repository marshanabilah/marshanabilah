import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStackData,
  renderStackSvg,
  renderTechStack,
} from "../scripts/update-tech-stack.js";

const stackData = buildStackData([
  {
    name: "language-lab",
    html_url: "https://github.com/marshanabilah/language-lab",
    languages: { Python: 800, HTML: 100 },
  },
  {
    name: "portfolio",
    html_url: "https://github.com/marshanabilah/portfolio",
    languages: { TypeScript: 100 },
  },
]);

test("builds a ranked, byte-weighted stack with repository evidence", () => {
  assert.equal(stackData.repositoryCount, 2);
  assert.deepEqual(
    stackData.languages.map(({ name, percentage }) => [name, percentage]),
    [
      ["Python", 80],
      ["HTML", 10],
      ["TypeScript", 10],
    ],
  );
  assert.equal(stackData.languages[0].repositories[0].name, "language-lab");
});

test("renders a visual dashboard and expandable repository links", () => {
  const result = renderTechStack(stackData);

  assert.match(result, /assets\/tech-stack-dark\.svg/);
  assert.match(result, /https:\/\/marshanabilah\.github\.io\/stack\//);
  assert.match(result, /<details>/);
  assert.match(result, /language-lab/);
  assert.doesNotMatch(result, /—/);
});

test("replaces only the generated section in an existing README", () => {
  const result = renderTechStack(
    stackData,
    "# Marsha\n\nBefore\n\n## Tech stack\n\n<!-- tech-stack:start -->\nold\n<!-- tech-stack:end -->\n\nAfter\n",
  );

  assert.match(result, /^# Marsha/);
  assert.match(result, /Open the interactive repository breakdown/);
  assert.match(result, /After\n$/);
});

test("renders accessible light and dark SVG variants", () => {
  const light = renderStackSvg(stackData, "light");
  const dark = renderStackSvg(stackData, "dark");

  assert.match(light, /<title id="title">Marsha Nabilah tech stack<\/title>/);
  assert.match(light, /Python/);
  assert.match(light, /80\.0%/);
  assert.match(dark, /#0d1117/);
});
