// Copyright 2020-2021 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as core from '@actions/core';
import * as github from '@actions/github'
import * as io from '@actions/io';
import * as child from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import { breaking } from './buf';
import { Error, isError } from './error';
import { postComments } from './github';

// minimumBufVersion is the minimum buf version required to
// run this action. At least this version is required because
// the implementation uses the FileAnnotation exit code introduced
// in the following release:
// https://github.com/bufbuild/buf/releases/tag/v0.41.0
const minimumBufVersion = '0.41.0'

// runnerTempEnvKey is the environment variable key
// used to access a temporary directory. Although
// undocumented in the Github Actions documentation,
// this can be found in the @actions/tools-cache module.
// https://github.com/actions/toolkit/blob/4bf916289e5e32bb7d1bd7f21842c3afeab3b25a/packages/tool-cache/src/tool-cache.ts#L701
const runnerTempEnvKey = 'RUNNER_TEMP'

export async function run(): Promise<void> {
    try {
        const result = await runBreaking();
        if (result != null && isError(result)) {
            core.setFailed(result.message);
        }
    } catch (error) {
        // In case we ever fail to catch an error
        // in the call chain, we catch the error
        // and mark the build as a failure. The
        // user is otherwise prone to false positives.
        if (isError(error)) {
            core.setFailed(error.message);
            return;
        }
        core.setFailed('Internal error');
    }
}

// runBreaking runs the buf-breaking action, and returns
// a non-empty error if it fails.
async function runBreaking(): Promise<null|Error> {
    const authenticationToken = core.getInput('github_token');
    if (authenticationToken === '') {
        return {
            message: 'a Github authentication token was not provided'
        };
    }
    const input = core.getInput('input');
    if (input === '') {
        return {
            message: 'an input was not provided'
        };
    }
    const against = core.getInput('against');
    if (against === '') {
        return {
            message: 'an against was not provided'
        };
    }
    const owner = github.context.repo.owner;
    if (owner === '') {
        return {
            message: 'an owner was not provided'
        };
    }
    const repository = github.context.repo.repo;
    if (repository === '') {
        return {
            message: 'a repository was not provided'
        };
    }
    const binaryPath = await io.which('buf', true);
    if (binaryPath === '') {
        return {
            message: 'buf is not installed; please add the "bufbuild/buf-setup-action" step to your job found at https://github.com/bufbuild/buf-setup-action'
        };
    }
    const version = child.execSync(`${binaryPath} --version 2>&1`).toString();
    if (semver.lt(version, minimumBufVersion)) {
        return {
            message: `buf must be at least version ${minimumBufVersion}, but found ${version}`
        };
    }

    const bufToken = core.getInput('buf_token');
    if (bufToken !== '') {
        // If the BUF_TOKEN is set, add it to the runner's .netrc.
        const tempDir = process.env[runnerTempEnvKey] ?? '';
        if (tempDir === '') {
            return {
                message: `expected ${runnerTempEnvKey} to be defined`
            };
        }

        // TODO: For now, we hard-code the 'buf.build' remote. This will
        // need to be refactored once we support federation between other
        // BSR remotes.
        const netrcPath = path.join(tempDir, '.netrc');
        fs.writeFileSync(netrcPath, `machine buf.build\npassword ${bufToken}`, { flag: 'w' });
        process.env.NETRC = netrcPath;
    }

    const result = breaking(binaryPath, input, against);
    if (isError(result)) {
        return result
    }
    if (result.fileAnnotations.length === 0) {
        core.info('No breaking errors were found.');
        return null;
    }

    const pullRequestNumber = github.context.payload.pull_request?.number;
    if (pullRequestNumber !== undefined) {
        // If this action was configured for pull requests, we post the
        // FileAnnotations as comments.
        try {
            await postComments(
                authenticationToken,
                owner,
                repository,
                pullRequestNumber,
                result.fileAnnotations,
            );
        } catch (error) {
            // Log the error, but continue so that we still write
            // out the raw output to the user.
            if (isError(error)) {
                core.info(`Failed to write comments in-line: ${error.message}`);
            } else {
                core.info(`Failed to write comments in-line`);
            }
        }
    }

    // Include the raw output so that the console includes sufficient context.
    return {
        message: `buf found ${result.fileAnnotations.length} breaking failures.\n${result.raw}`
    };
}
