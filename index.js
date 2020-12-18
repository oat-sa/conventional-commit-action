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
    const recommendation = await getRecommandation();
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
    console.log('version', version);
    console.log('last version', lastVersion);


    if(recommendation && recommendation.stats.commits > 0 && recommendation.stats.commits === recommendation.stats.unset){
        await postComment(octokit, context, '❌ The commits messages are not compliant with the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) format!');
        throw new Error('The commits messages are not compliant');
    } else {
        await postComment(octokit, context, getMessage(recommendation, lastVersion, version))
    }
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

                resolve(recommendation);
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

function getMessage({ stats, level, reason } = recommendation, lastVersion, version) {

    let message = ['### Expexted version'];
    if(level === 0) {
        message.push('🚨 Your pull request contains a BREAKING CHANGE, please be sure to communicate it');
    }
    if (stats.unset > 0 ) {
        message.push(`❕ ${stats.unset} commits are not using the conventional commits formats. They will be ignored in version management.`);
    }
    message.push(`
        | Target Version | ${version} |
        | -------------- | ---------- |
        | Last version   | ${lastVersion} |
    `);
    message.push(`> ${reason}`);
    return message.join('\n');
}

async function postComment(octokit, context, comment) {
    return octokit.issues.createComment({
		repo: context.repo.repo,
		owner: context.repo.owner,
		issue_number: context.payload.pull_request.number,
		body: `<!--OAT-cc-action-->
		    ${comment}
		`
	})
}

main().catch(err => core.setFailed(err.message) );
