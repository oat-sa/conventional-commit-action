const core = require('@actions/core');
const github = require('@actions/github');

async function main() {
    const token = core.getInput('github_token');

    if(token && token.length){
       core.info('got the token');
        console.log('GOT THE TOKEN');
    } else {

       core.info('the token is empty');
        console.log('EMPTY TOKEN');

    }
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
