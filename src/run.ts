// Copyright 2020-2021 Buf Technologies, Inc.
//
// All rights reserved.

import * as core from '@actions/core';
import * as github from '@actions/github'
import * as io from '@actions/io';
import { breaking } from './buf';
import { Error, isError } from './error';
import { postComments } from './github';

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
        // TODO: Update this reference to a link once it's available.
        return {
            message: 'buf is not installed; please add the "bufbuild/setup-buf" step to your job'
        };
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
