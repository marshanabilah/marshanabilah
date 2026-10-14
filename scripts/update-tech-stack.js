import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const START_MARKER = "<!-- tech-stack:start -->";
const END_MARKER = "<!-- tech-stack:end -->";
const USERNAME = process.env.GITHUB_USERNAME ?? "marshanabilah";
const MAX_LANGUAGES = 8;

function formatPercentage(value, total) {
  return `${((value / total) * 100).toFixed(1)}%`;
}

export function renderTechStack(languageBytes, readme) {
  const ranked = [...languageBytes.entries()]
    .sort(([, leftBytes], [, rightBytes]) => rightBytes - leftBytes)
    .slice(0, MAX_LANGUAGES);
  const total = ranked.reduce((sum, [, bytes]) => sum + bytes, 0);
  const lines = total === 0
    ? ["- No languages found in eligible public repositories yet."]
    : ranked.map(([language, bytes]) => `- ${language} — ${formatPercentage(bytes, total)}`);
  const section = `## Tech stack\n\n${START_MARKER}\n${lines.join("\n")}\n${END_MARKER}`;

  if (readme === undefined) return section;

  const start = readme.indexOf(START_MARKER);
  const end = readme.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("README.md must contain a complete tech-stack marker pair.");
  }

  const sectionStart = readme.lastIndexOf("##", start);
  if (sectionStart === -1) {
    throw new Error("The tech-stack marker pair must be under a Markdown heading.");
  }

  return `${readme.slice(0, sectionStart)}${section}${readme.slice(end + END_MARKER.length)}`;
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `${USERNAME}-profile-tech-stack`,
    },
  });
  if (!response.ok) throw new Error(`GitHub API request failed (${response.status}): ${url}`);
  return response.json();
}

async function getPublicRepositories() {
  const repositories = [];
  for (let page = 1; ; page += 1) {
    const batch = await getJson(
      `https://api.github.com/users/${USERNAME}/repos?type=owner&sort=updated&per_page=100&page=${page}`,
    );
    repositories.push(...batch);
    if (batch.length < 100) return repositories;
  }
}

async function getLanguageBytes(repositories) {
  const totals = new Map();
  for (const repository of repositories) {
    const languages = await getJson(repository.languages_url);
    for (const [language, bytes] of Object.entries(languages)) {
      totals.set(language, (totals.get(language) ?? 0) + bytes);
    }
  }
  return totals;
}

async function main() {
  const readme = await readFile("README.md", "utf8");
  const repositories = await getPublicRepositories();
  const eligibleRepositories = repositories.filter(
    (repository) => !repository.fork && !repository.archived && !repository.disabled,
  );
  const languageBytes = await getLanguageBytes(eligibleRepositories);
  await writeFile("README.md", renderTechStack(languageBytes, readme));
  console.log(`Updated tech stack from ${eligibleRepositories.length} public repositories.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
