const core = require('@actions/core');
const github = require('@actions/github');
const conventionalRecommendedBump = require('conventional-recommended-bump');
const conventionalPresetConfig = require('@oat-sa/conventional-changelog-tao');

async function main() {
    const token = core.getInput('github_token');
    const context = github.context;

    const octokit = github.getOctokit(token);
    console.log("CONTEXT", JSON.stringify(context));

    const versions = await getVersion();

    console.log('>>>VERSIONS<<<<', versions);

    await octokit.issues.createComment({
		repo: context.repo.repo,
		owner: context.repo.owner,
		issue_number: context.payload.pull_request.number,
		body: 'Hey 👋, this is Bertrand. I\'m testing some github action on this repo. No worry your PR is awesome !',
	})
}


async function getVersion() {
    return new Promise((resolve, reject) => {
        conventionalRecommendedBump(
            {
                preset: {
                    name: '@oat-sa/tao'
                }
            },
            {},
            (err, recommendation) => {
                if (err) {
                    return reject(err);
                }

                const lastVersion = lastVersionObject.version;

                //carefull inc mutate lastVersionObject
                const version = semverInc(lastVersionObject, recommendation.releaseType);
                resolve({ lastVersion, version, recommendation });
            });
    });
}

main().catch(err => core.setFailed(err.message) );
