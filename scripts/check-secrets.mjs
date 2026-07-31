import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/*
 * Token prefixes must start at a token boundary, and key bodies must not contain
 * hyphens. Without both constraints `sk-` matches inside ordinary kebab-case
 * identifiers such as `risk-disclosure-acknowledged`, which made this gate fail
 * on clean source and buried any real finding in false positives.
 */
const START = String.raw`(?<![A-Za-z0-9_-])`;

const detectors = [
  ["OpenAI API key", new RegExp(`${START}sk-(?:proj-|svcacct-)?[A-Za-z0-9_]{20,}`)],
  ["Stripe secret key", new RegExp(`${START}(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}`)],
  ["Stripe webhook secret", new RegExp(`${START}whsec_[A-Za-z0-9]{16,}`)],
  ["GitHub token", new RegExp(`${START}gh[oprsu]_[A-Za-z0-9]{20,}`)],
  ["AWS access key", new RegExp(`${START}AKIA[0-9A-Z]{16}`)],
  ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["populated OpenAI environment assignment", /^OPENAI_API_KEY[ \t]*=[ \t]*\S+/m],
  ["Google OAuth client secret", new RegExp(`${START}GOCSPX-[A-Za-z0-9_-]{10,}`)],
  ["populated Google client secret assignment", /^GOOGLE_CLIENT_SECRET[ \t]*=[ \t]*\S+/m],
];

/*
 * Self-test: a tightened pattern is only useful if it still catches the real
 * thing, so prove detection on synthetic keys before scanning the repository.
 */
const selfTest = [
  ["OpenAI API key", `sk-${"A1b2C3d4E5f6G7h8I9j0".repeat(2)}`],
  ["OpenAI API key", `sk-proj-${"A1b2C3d4E5f6G7h8I9j0".repeat(2)}`],
  ["Stripe secret key", `sk_live_${"A1b2C3d4E5f6G7h8"}`],
  ["Stripe webhook secret", `whsec_${"A1b2C3d4E5f6G7h8"}`],
  ["GitHub token", `ghp_${"A1b2C3d4E5f6G7h8I9j0"}`],
  // Assembled at runtime so this file never contains a literal key shape itself.
  ["AWS access key", `AKIA${"0123456789ABCDEF"}`],
];
for (const [label, sample] of selfTest) {
  const detector = detectors.find(([name]) => name === label);
  if (!detector || !detector[1].test(sample)) {
    console.error(`Secret scanner self-test failed: "${label}" no longer detects a known key shape.`);
    process.exit(2);
  }
}

const repositoryFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
  encoding: "utf8",
  },
).split("\0").filter(Boolean);

const findings = [];
for (const path of repositoryFiles) {
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  if (contents.includes("\0")) continue;

  for (const [label, pattern] of detectors) {
    if (pattern.test(contents)) findings.push({ path, label });
  }
}

if (findings.length > 0) {
  console.error("Potential committed secrets detected (matched values suppressed):");
  for (const finding of findings) {
    console.error(`- ${finding.path}: ${finding.label}`);
  }
  process.exit(1);
}

console.log(`Secret-pattern scan passed across ${repositoryFiles.length} version-control candidates.`);
