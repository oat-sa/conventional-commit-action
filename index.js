const core = require('@actions/core');
const { GitHub, context } = require('@actions/github');

async function main() {
    const token = core.getInput('token');

    console.log(JSON.stringify(context));

    await new GitHub(token).issues.createComment({
		repo: context.repo.repo,
		owner: context.repo.owner,
		issue_number: context.payload.pull_request.number,
		body: 'New version',
	})
}

main().catch(err => core.setFailed(err.message) );
