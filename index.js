/**
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; under version 2
 * of the License (non-upgradable).
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * Copyright (c) 2020 (original work) Open Assessment Technologies SA ;
 */
const core = require('@actions/core');
const github = require('@actions/github');
const conventionalRecommendedBump = require('conventional-recommended-bump');
const conventionalPresetConfig = require('@oat-sa/conventional-changelog-tao');
const presetBumper = require('@oat-sa/conventional-changelog-tao/bumper.js');
const gitSemverTags = require('git-semver-tags');
const semverParse = require('semver/functions/parse');
const semverInc = require('semver/functions/inc');

//PR stops listing commits after this limit
const commitNumbersThreshold = 250;

/**
 * The main entry point
 * @returns {Promise}
 */
function main() {
    const token = core.getInput('github_token');
    const context = github.context;
    const octokit = github.getOctokit(token);

    const commitNumbers = context.payload.pull_request.commits;

    return octokit
        .paginate(octokit.rest.pulls.listCommits, {
            repo: context.repo.repo,
            owner: context.repo.owner,
            pull_number: context.payload.pull_request.number,
            per_page: 100
        })
        .then(commits => Promise.all([getRecommandation(commits.map(commit => commit.sha)), getLastTag()]))
        .then(([recommendation, lastTag] = []) => {
            if (!recommendation || !lastTag) {
                throw new Error('Unable to retrieve commits and tag information');
            }
            if (lastTag.match(/^20\d\d\.\d\d/)) {
                // YYYY.MM* tagging is not proper semver, and bump shouldn't be proposed
                return;
            }

            let lastVersion;
            let version;
            if (lastTag && recommendation) {
                const lastVersionObject = semverParse(lastTag);
                lastVersion = lastVersionObject.version;
                version = semverInc(lastVersionObject, recommendation.releaseType);
                core.setOutput('version', version);
            }

            core.info(JSON.stringify(recommendation, null, ' '));

            if (
                recommendation.stats &&
                recommendation.stats.commits > 0 &&
                recommendation.stats.unset + recommendation.stats.merge >= recommendation.stats.commits
            ) {
                return postComment(
                    octokit,
                    context,
                    '❌ The commits messages are not compliant with the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) format!'
                ).then(() => Promise.reject(new Error('The commits messages are not compliant')));
            }

            return postComment(octokit, context, getMessage(recommendation, lastVersion, version, commitNumbers));
        });
}

/**
 * Get commit recommendation
 * @param {String[]]} includeCommits - the list of commits to include
 * @returns {Promise<Object>} resolves with the recommendation object
 */
function getRecommandation(includeCommits) {
    return new Promise((resolve, reject) => {
        conventionalRecommendedBump(
            {
                //the preset cannot be used from string in an action due to missing lookups in node_modules
                config: conventionalPresetConfig,
                whatBump(commits) {
                    return presetBumper().whatBump(commits.filter(commit => includeCommits.includes(commit.hash)));
                }
            },
            (err, recommendation) => {
                if (err) {
                    return reject(err);
                }

                resolve(recommendation);
            }
        );
    });
}

/**
 * Get the last tag,
 * it expects the local git to have the tags fetched
 * @returns {Promise<Object>} resolves with the tag version object
 */
function getLastTag() {
    return new Promise((resolve, reject) => {
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

/**
 * Build the comment message
 * @param {Object} recommendation
 * @param {Object} recommendation.stats
 * @param {number} recommendation.level
 * @param {string} recommendation.reason
 * @param {string} lastVersion
 * @param {string} version
 * @param {number} [commitNumbers=0]
 * @returns {string} the message, in markdown format
 */
function getMessage({ stats, level, reason } = {}, lastVersion, version, commitNumbers = 0) {
    let message = ['### Version'];
    if (commitNumbers > commitNumbersThreshold) {
        message.push(
            `⚠️  The pull request contains ${commitNumbers} commits. This message is based only on the first ${commitNumbersThreshold}.`
        );
    }
    if (level === 0) {
        message.push('🚨 Your pull request contains a BREAKING CHANGE, please be sure to communicate it.');
    }
    if (stats.unset > 0) {
        message.push(
            `❕ Some commits are not using the conventional commits formats. They will be ignored in version management.`
        );
    }
    message.push(`
| Target Version | ${version} |
| -------------- | ---------- |
| Last version   | ${lastVersion} |
    `);
    message.push(`${reason}`);
    return message.join('\n');
}

/**
 * Post a comment to the PR
 * @param {Object} octokit
 * @param {Object} context
 * @param {string} comment
 * @returns {Promise}
 */
function postComment(octokit, context, comment) {
    //there's no API to update a comment, so we
    //keep track of comments by inserting an hidden comment
    //and removing the previous
    const commentHeader = '<!--OAT-cc-action-->';

    return octokit.rest.issues
        .listComments({
            repo: context.repo.repo,
            owner: context.repo.owner,
            issue_number: context.payload.pull_request.number
        })
        .then(results => {
            const { data: existingComments } = results;

            return existingComments.filter(({ body }) => body.startsWith(commentHeader));
        })
        .then(toDelete => {
            if (Array.isArray(toDelete)) {
                return Promise.all(
                    toDelete.map(({ id }) =>
                        octokit.rest.issues.deleteComment({
                            repo: context.repo.repo,
                            owner: context.repo.owner,
                            comment_id: id
                        })
                    )
                );
            }
        })
        .then(() =>
            octokit.rest.issues.createComment({
                repo: context.repo.repo,
                owner: context.repo.owner,
                issue_number: context.payload.pull_request.number,
                body: `${commentHeader}\n${comment}`
            })
        );
}

main().catch(err => core.setFailed(err.message));
