const core = require('@actions/core');
const github = require('@actions/github');
const conventionalRecommendedBump = require('conventional-recommended-bump');
const conventionalPresetConfig = require('@oat-sa/conventional-changelog-tao');
const gitSemverTags = require('git-semver-tags');
const semverParse = require('semver/functions/parse');
const semverInc = require('semver/functions/inc');


async function main() {
    const token = core.getInput('github_token');
    const context = github.context;

    const octokit = github.getOctokit(token);
    const recommendation = await getVersion();
    const lastTag = await getLastTag();

    let lastVersion;
    let version;
    if( lastTag && recommendation ){
        const lastVersionObject = semverParse(lastTag);
        lastVersion = lastVersionObject.version;
        version = semverInc(lastVersionObject, recommendation.releaseType);
    }

    console.log('recommendation', recommendation);
    console.log('lastTag', lastTag);

    await octokit.issues.createComment({
		repo: context.repo.repo,
		owner: context.repo.owner,
		issue_number: context.payload.pull_request.number,
		body: getMessage(recommendation, version)
	})
}


async function getRecommandation(){
    return new Promise((resolve, reject) => {
        conventionalRecommendedBump(
            {
                //the preset cannot be used from string in an action due to missing lookups in node_modules
                config: conventionalPresetConfig                },
            {},
            (err, recommendation) => {
                if (err) {
                    return reject(err);
                }

                resolve(recommendation, lastVersion, version);
            });
    });
}

async function getLastTag() {
    return new Promise( (resolve, reject) => {
        gitSemverTags((err, tags) => {
            if (err) {
                return reject(err);
            }
            if (tags && tags.length) {
                return resolve(tags[0]);
            }
            return reject(new Error('no tag found'));
        });
    });
}

function getMessage({ stats, releaseType, reason } = recommendation, lastVersion, version) {
    if(stats.commits > 0 && stats.commits === stats.unset){
        return 'The commits are not compliant with the conventional commits format!';
    }
    let message = [];
    if (stats.unset > 0 ) {
        message.push(`${stats.unset} commits are not using the conventional commits formats. They will be ignored in version management.`);
    }
    message.push(
        ` - last version: ${lastVersion}`
    );
    message.push(
        ` - target version: **${version}**`
    );
    message.push(
        reason
    );
    return message.join('\n');
}

main().catch(err => core.setFailed(err.message) );
