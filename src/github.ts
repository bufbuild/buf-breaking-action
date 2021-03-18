// Copyright 2020-2021 Buf Technologies, Inc.
//
// All rights reserved.

import { Octokit } from '@octokit/core';
import { FileAnnotation } from './buf';

// bufMessagePrefix is the prefix used for the in-line comments.
const bufMessagePrefix = 'buf-breaking: '

// rightSide is the enum used to inform Github to place the
// in-line comment on the right-side (i.e. the latest version)
// of the diff. This is referenced from the following:
// https://docs.github.com/en/rest/reference/pulls#list-review-comments-in-a-repository
const rightSide = 'RIGHT'

// defaultReviewBody is the default message used in the body text of
// the pull request review. This is required.
const defaultReviewBody = 'buf-breaking: Please resolve all failures to proceed.'

// commentEvent is the Github pull request comment event.
// This is referenced from the following:
// https://docs.github.com/en/rest/reference/pulls#create-a-review-for-a-pull-request
const commentEvent = 'COMMENT'

// Comment conforms to the Github comment parameters referenced
// from the following:
// https://docs.github.com/en/rest/reference/pulls#create-a-review-for-a-pull-request
interface Comment {
    path: string;
    body: string;
    start_line?: number;
    line?: number;
    start_side?: string;
    side?: string;
}

// postComments maps the given FileAnnotations into Comments
// and posts them to the given pull request.
export async function postComments(
    authenticationToken: string,
    owner: string,
    repository: string,
    pullRequestNumber: number,
    fileAnnotations: FileAnnotation[],
): Promise<void> {
    const inLineComments: Comment[] = [];
    const reviewComments: string[] = [];
    fileAnnotations.forEach((fileAnnotation: FileAnnotation) => {
        if (fileAnnotation.path === undefined || fileAnnotation.path === '') {
            // The FileAnnotation doesn't include a filepath, so we capture this
            // context in the top-level review comment.
            reviewComments.push(fileAnnotation.type + ': ' + fileAnnotation.message);
            return;
        }
        inLineComments.push(fileAnnotationToComment(fileAnnotation));
    })

    let reviewBody = defaultReviewBody;
    if (reviewComments.length !== 0) {
        // If we have review-level comments to report, prepend
        // the default comment to the set and split them by
        // newlines.
        reviewComments.unshift(reviewBody)
        reviewBody = reviewComments.join('\n')
    }

    const octokit = new Octokit({
        auth: authenticationToken,
    });
    // https://docs.github.com/en/rest/reference/pulls#create-a-review-for-a-pull-request
    await octokit.request(
        'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
        {
            owner: owner,
            repo: repository,
            pull_number: +pullRequestNumber,
            body: reviewBody,
            event: commentEvent,
            comments: inLineComments,
        },
    );
}

// fileAnnotation maps the given FileAnnotation into a Github comment.
function fileAnnotationToComment(fileAnnotation: FileAnnotation): Comment {
    let startLine; // This can either be a string or undefined, so we initialize it without a type.
    if (
        fileAnnotation.end_line !== undefined && fileAnnotation.end_line !== 0 &&
        fileAnnotation.start_line !== undefined && fileAnnotation.start_line !== 0 &&
        fileAnnotation.end_line > fileAnnotation.start_line
    ) {
        // Some FileAnnotations will not include the start_line and end_line,
        // such as breaking changes that remove a file. We also don't include
        // the start_line if it's the same as the end_line in order to satisfy
        // the Github API.
        startLine = fileAnnotation.start_line;
    }
    let line = fileAnnotation.end_line;
    if (
        (line === undefined || line === 0) &&
        (startLine === undefined || startLine === 0)
    ) {
        // If neither a start_line or end_line was provided, we must default
        // to the first line of the file. This is relevant for some FileAnnotations,
        // such as lint errors that complain about a missing package declaration.
        line = 1;
    }
    return {
        path: fileAnnotation.path ?? '',
        body: bufMessagePrefix + fileAnnotation.message, // Prepend the message with a prefix so it's clear it's coming from buf.
        start_line: startLine,
        line: line,
        start_side: rightSide,
        side: rightSide,
    }
}
