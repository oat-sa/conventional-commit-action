const core = require('@actions/core');
const github = require('@actions/github');

async function main() {
    const token = core.getInput('github_token');
    const octokit = github.getOctokit(token);
    console.log("CONTEXT", JSON.stringify(context));

    await octokit.issues.createComment({
		repo: context.repo.repo,
		owner: context.repo.owner,
		issue_number: context.payload.pull_request.number,
		body: 'New version',
	})
}

main().catch(err => core.setFailed(err.message) );
