module.exports = async ({github, context, core}) => {
  const assigneesJson = process.env.PR_ASSIGNEES_JSON;
  const assignees = JSON.parse(assigneesJson || '[]');
  
  let targetAuthors = [];
  
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
  
  for (const login of assignees) {
    let name = login;
    let email = `${login}@users.noreply.github.com`;
    
    // Find any commit by this user and use the commit author info (not the GitHub author)
    for (const commit of commits) {
      if (commit.author && commit.author.login === login && commit.commit.author) {
        name = commit.commit.author.name || name;
        email = commit.commit.author.email || email;
        // Use the first match that has a non-noreply email
        if (!email.includes('noreply.github.com')) {
          break;
        }
      }
    }
    
    targetAuthors.push(`${name} <${email}>`);
  }
  
  const envVarValue = JSON.stringify(targetAuthors);
  console.log(`Setting TARGET_AUTHORS to: ${envVarValue}`);
  core.exportVariable('TARGET_AUTHORS', envVarValue);
};
