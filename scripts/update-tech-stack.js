import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const START_MARKER = "<!-- tech-stack:start -->";
const END_MARKER = "<!-- tech-stack:end -->";
const USERNAME = process.env.GITHUB_USERNAME ?? "marshanabilah";
const MAX_LANGUAGES = 8;
const INTERACTIVE_URL = "https://marshanabilah.github.io/stack/";

function formatPercentage(value) {
  return `${value.toFixed(1)}%`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildStackData(repositories) {
  const languages = new Map();
  let totalBytes = 0;

  for (const repository of repositories) {
    for (const [name, bytes] of Object.entries(repository.languages)) {
      totalBytes += bytes;
      const language = languages.get(name) ?? { bytes: 0, repositories: [] };
      language.bytes += bytes;
      language.repositories.push({
        name: repository.name,
        url: repository.html_url,
        bytes,
      });
      languages.set(name, language);
    }
  }

  const rankedLanguages = [...languages.entries()]
    .sort(([, left], [, right]) => right.bytes - left.bytes)
    .slice(0, MAX_LANGUAGES)
    .map(([name, language]) => ({
      name,
      bytes: language.bytes,
      percentage: totalBytes === 0
        ? 0
        : Number(((language.bytes / totalBytes) * 100).toFixed(1)),
      repositories: language.repositories
        .sort((left, right) => right.bytes - left.bytes)
        .map(({ name: repositoryName, url }) => ({ name: repositoryName, url })),
    }));

  return {
    repositoryCount: repositories.length,
    totalBytes,
    languages: rankedLanguages,
  };
}

function renderRepositoryEvidence(data) {
  if (data.languages.length === 0) {
    return "<p>No language data is available from eligible public repositories yet.</p>";
  }

  return data.languages.map((language) => {
    const repositories = language.repositories
      .map((repository) => (
        `<a href="${repository.url}">${escapeHtml(repository.name)}</a>`
      ))
      .join(" · ");
    return `<p><strong>${escapeHtml(language.name)} · ${formatPercentage(language.percentage)}</strong><br>${repositories}</p>`;
  }).join("\n");
}

export function renderTechStack(data, readme) {
  const section = `## Tech stack

${START_MARKER}
<a href="${INTERACTIVE_URL}">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/tech-stack-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/tech-stack-light.svg">
    <img alt="Bar chart showing the languages detected across Marsha Nabilah's public repositories" src="assets/tech-stack-light.svg" width="880">
  </picture>
</a>

[Open the interactive repository breakdown](${INTERACTIVE_URL})

<details>
<summary>Repository evidence for ${data.repositoryCount} public repositories</summary>

${renderRepositoryEvidence(data)}
</details>
${END_MARKER}`;

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

export function renderStackSvg(data, theme) {
  const colors = theme === "dark"
    ? {
        background: "#0d1117",
        ink: "#f0f6f6",
        muted: "#afc2c3",
        line: "#334548",
        track: "#1e3032",
        accent: "#58aaa5",
      }
    : {
        background: "#ffffff",
        ink: "#1f2933",
        muted: "#4d5c64",
        line: "#d6dede",
        track: "#e9efef",
        accent: "#287d7a",
      };
  const width = 880;
  const rowHeight = 34;
  const height = 126 + Math.max(data.languages.length, 1) * rowHeight;
  const barX = 220;
  const barWidth = 540;

  const rows = data.languages.length === 0
    ? `<text x="44" y="132" fill="${colors.muted}" font-size="15">No public language data is available yet.</text>`
    : data.languages.map((language, index) => {
        const y = 116 + index * rowHeight;
        const fillWidth = Math.max(3, barWidth * (language.percentage / 100));
        return `<g>
  <text x="44" y="${y + 16}" fill="${colors.ink}" font-size="15">${escapeHtml(language.name)}</text>
  <rect x="${barX}" y="${y + 3}" width="${barWidth}" height="16" fill="${colors.track}" />
  <rect x="${barX}" y="${y + 3}" width="${fillWidth.toFixed(1)}" height="16" fill="${colors.accent}" />
  <text x="836" y="${y + 16}" fill="${colors.ink}" font-size="14" text-anchor="end">${formatPercentage(language.percentage)}</text>
</g>`;
      }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Marsha Nabilah tech stack</title>
  <desc id="description">Language share across ${data.repositoryCount} eligible public repositories. Select the image to open the interactive repository breakdown.</desc>
  <rect width="${width}" height="${height}" fill="${colors.background}" stroke="${colors.line}" />
  <text x="44" y="47" fill="${colors.ink}" font-family="Georgia, serif" font-size="25">Where the code lives</text>
  <text x="44" y="75" fill="${colors.muted}" font-family="Arial, sans-serif" font-size="14">Detected language bytes across ${data.repositoryCount} public repositories</text>
  <line x1="44" y1="94" x2="836" y2="94" stroke="${colors.line}" />
  <g font-family="Arial, sans-serif">${rows}</g>
</svg>\n`;
}

async function getJson(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": `${USERNAME}-profile-tech-stack`,
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
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

async function addLanguages(repository) {
  return {
    ...repository,
    languages: await getJson(repository.languages_url),
  };
}

async function main() {
  const readme = await readFile("README.md", "utf8");
  const repositories = await getPublicRepositories();
  const eligibleRepositories = repositories.filter(
    (repository) => !repository.fork && !repository.archived && !repository.disabled,
  );
  const stackData = buildStackData(
    await Promise.all(eligibleRepositories.map(addLanguages)),
  );

  await mkdir("assets", { recursive: true });
  await Promise.all([
    writeFile("README.md", renderTechStack(stackData, readme)),
    writeFile("assets/tech-stack.json", `${JSON.stringify(stackData, null, 2)}\n`),
    writeFile("assets/tech-stack-light.svg", renderStackSvg(stackData, "light")),
    writeFile("assets/tech-stack-dark.svg", renderStackSvg(stackData, "dark")),
  ]);
  console.log(`Updated tech stack from ${eligibleRepositories.length} public repositories.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
