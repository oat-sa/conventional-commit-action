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
const gitSemverTags = require('git-semver-tags');
const semverParse = require('semver/functions/parse');
const semverInc = require('semver/functions/inc');

/**
 * The main entry point
 * @returns {Promise}
 */
function main() {
    const token = core.getInput('github_token');
    const context = github.context;
    const octokit = github.getOctokit(token);

    return Promise.all([getRecommandation(), getLastTag()]).then(([recommendation, lastTag] = []) => {
        if (!recommendation || !lastTag) {
            throw new Error('Unable to retrieve commits and tag information');
        }

        let lastVersion;
        let version;
        if (lastTag && recommendation) {
            const lastVersionObject = semverParse(lastTag);
            lastVersion = lastVersionObject.version;
            version = semverInc(lastVersionObject, recommendation.releaseType);
            core.setOutput('version', version);
        }

        if (
            recommendation.stats &&
            recommendation.stats.commits > 0 &&
            recommendation.stats.commits === recommendation.stats.unset
        ) {
            return postComment(
                octokit,
                context,
                '❌ The commits messages are not compliant with the [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) format!'
            ).then(() => Promise.reject(new Error('The commits messages are not compliant')));
        }
        return postComment(octokit, context, getMessage(recommendation, lastVersion, version));
    });
}

/**
 * Get commit recommendation
 * @returns {Promise<Object>} resolves with the recommendation object
 */
function getRecommandation() {
    return new Promise((resolve, reject) => {
        conventionalRecommendedBump(
            {
                //the preset cannot be used from string in an action due to missing lookups in node_modules
                config: conventionalPresetConfig
            },
            {},
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
 * @returns {string} the message, in markdown format
 */
function getMessage({ stats, level, reason } = {}, lastVersion, version) {
    let message = ['### Version'];
    if (level === 0) {
        message.push('🚨 Your pull request contains a BREAKING CHANGE, please be sure to communicate it');
    }
    if (stats.unset > 0) {
        message.push(
            `❕ ${stats.unset} commits are not using the conventional commits formats. They will be ignored in version management.`
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

    return octokit.issues
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
                    toDelete.map(({ id }) => (
                        octokit.issues.deleteComment({
                            repo: context.repo.repo,
                            owner: context.repo.owner,
                            comment_id: id
                        })
                    ))
                );
            }
        })
        .then(() => (
            octokit.issues.createComment({
                repo: context.repo.repo,
                owner: context.repo.owner,
                issue_number: context.payload.pull_request.number,
                body: `${commentHeader}\n${comment}`
            })
        ));
}

main().catch(err => core.setFailed(err.message));
