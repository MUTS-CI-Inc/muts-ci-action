module.exports = async ({ github, context, core }) => {
  let commits = [];

  // --- NEW FEATURE: Allow override via environment variables ---
  const startCommit = process.env.start_commit;
  const endCommit = process.env.end_commit;

  if (startCommit && endCommit) {
  console.log(`Environment override detected.`);
  console.log(`Using commit range: ${endCommit}..${startCommit}`);

  const { execSync } = require("child_process");

  try {
    // Get authors from git log between commits
    const authorOutput = execSync(
      `git log --format="%an <%ae>" ${endCommit}..${startCommit}`,
      { encoding: "utf8" }
    );

    const authorsRaw = authorOutput
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    // Deduplicate authors
    const authorsSet = new Set(authorsRaw);
    const authors = Array.from(authorsSet);

    console.log("Authors found from git:");
    authors.forEach(a => console.log("  " + a));

    const commitCount = authorsRaw.length;
    console.log(`Commit count from git: ${commitCount}`);

    // Export variables
    core.exportVariable("TARGET_AUTHORS", JSON.stringify(authors));
    core.exportVariable("TARGET_COMMIT_COUNT", commitCount.toString());
    core.exportVariable("TARGET_START_COMMIT", startCommit);
    core.exportVariable("TARGET_END_COMMIT", endCommit);

    // We're done — skip GitHub API logic completely
    return;

  } catch (err) {
    console.error("Failed to read authors from git:");
    console.error(err.message);
    return;
  }
} else {
    // --- ORIGINAL FUNCTIONALITY ---
    try {
      if (context.payload.pull_request) {
        console.log(`Fetching commits from PR #${context.payload.pull_request.number} ...`);

        const iterator = github.paginate.iterator(github.rest.pulls.listCommits, {
          owner: context.repo.owner,
          repo: context.repo.repo,
          pull_number: context.payload.pull_request.number,
          per_page: 100
        });

        for await (const response of iterator) {
          commits.push(...response.data);
        }

        console.log(`Fetched ${commits.length} total commit(s) from PR`);
      } else {
        console.log("Not in PR context and no manual commit range provided.");
        return;
      }
    } catch (error) {
      console.log("Unable to fetch PR commits - skipping TARGET_AUTHORS setup");
      console.log("Error:", error.message);
      console.log('Please ensure the workflow has "pull-requests: read" permission');
      return;
    }
  }

  // --- PROCESS AUTHORS (existing behavior) ---
  const authorsMap = new Map();
  const commitCountMap = new Map();

  for (const commit of commits) {
    if (commit.commit.author) {
      const name = commit.commit.author.name;
      const email = commit.commit.author.email;

      if (!authorsMap.has(email) || !email.includes("noreply.github.com")) {
        authorsMap.set(email, `${name} <${email}>`);
      }

      commitCountMap.set(email, (commitCountMap.get(email) || 0) + 1);
    }
  }

  const targetAuthors = Array.from(authorsMap.values());
  const maxCommitCount = Math.max(...Array.from(commitCountMap.values()), 0);

  const authorsEnvValue = JSON.stringify(targetAuthors);
  console.log(`Setting system environment variable TARGET_AUTHORS = ${authorsEnvValue}`);
  console.log(`Setting system environment variable TARGET_COMMIT_COUNT = ${maxCommitCount}`);

  core.exportVariable("TARGET_AUTHORS", authorsEnvValue);
  core.exportVariable("TARGET_COMMIT_COUNT", maxCommitCount.toString());
};
