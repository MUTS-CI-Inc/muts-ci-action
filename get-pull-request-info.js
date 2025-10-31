module.exports = async ({github, context, core}) => {
  // Get commits from the repository
  let commits;
  try {
    // Try to get PR commits if in a PR context
    if (context.payload.pull_request) {
      const { data: prCommits } = await github.rest.pulls.listCommits({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: context.payload.pull_request.number
      });
      commits = prCommits;
    } else {
      throw new Error('Not in PR context');
    }
  } catch (error) {
    // Fall back to repository commits if PR commits are not accessible
    console.log('Unable to fetch PR commits, falling back to repository commits');
    const { data: repoCommits } = await github.rest.repos.listCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      per_page: 100
    });
    commits = repoCommits;
  }
  
  // Extract unique authors from commits and count commits per author
  const authorsMap = new Map();
  const commitCountMap = new Map();
  
  for (const commit of commits) {
    if (commit.commit.author) {
      const name = commit.commit.author.name;
      const email = commit.commit.author.email;
      
      // Use email as key to avoid duplicates
      // Prefer non-noreply emails
      if (!authorsMap.has(email) || !email.includes('noreply.github.com')) {
        authorsMap.set(email, `${name} <${email}>`);
      }
      
      // Count commits per author
      commitCountMap.set(email, (commitCountMap.get(email) || 0) + 1);
    }
  }
  
  // Convert map values to array
  const targetAuthors = Array.from(authorsMap.values());
  
  // Find the maximum commit count
  const maxCommitCount = Math.max(...Array.from(commitCountMap.values()), 0);
  
  const authorsEnvValue = JSON.stringify(targetAuthors);
  console.log(`Setting TARGET_AUTHORS to: ${authorsEnvValue}`);
  console.log(`Found ${targetAuthors.length} unique author(s) in the PR`);
  console.log(`Setting TARGET_COMMIT_COUNT to: ${maxCommitCount}`);
  
  core.exportVariable('TARGET_AUTHORS', authorsEnvValue);
  core.exportVariable('TARGET_COMMIT_COUNT', maxCommitCount.toString());
};
