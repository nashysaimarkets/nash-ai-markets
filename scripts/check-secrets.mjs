import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const detectors = [
  ["OpenAI API key", /sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/],
  ["Stripe secret key", /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/],
  ["Stripe webhook secret", /whsec_[A-Za-z0-9]{16,}/],
  ["GitHub token", /gh[oprsu]_[A-Za-z0-9]{20,}/],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["populated OpenAI environment assignment", /^OPENAI_API_KEY[ \t]*=[ \t]*\S+/m],
];

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
