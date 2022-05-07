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

import * as child from 'child_process';
import { Error, isError } from './error';

// breakingExitCode is the exit code used to signal that buf
// successfully found incompatible changes.
const breakingExitCode = 100

// BreakingResult includes both the raw and formatted FileAnnotation
// output of a 'buf breaking` command execution. We include both so
// that we preserve the same content users would see on the command line.
export interface BreakingResult {
    raw: string;
    fileAnnotations: FileAnnotation[];
}

// FileAnnotation is a subset of the buf FileAnnotation definition
// referenced from the following:
// https://github.com/bufbuild/buf/blob/8255257bd94c9f1b5faa27242211c5caad05be79/internal/buf/bufanalysis/bufanalysis.go#L102
export interface FileAnnotation {
    message: string;
    path?: string;
    start_line?: number;
    start_column?: number;
}

// ExecException is a subset of the child.ExecException interface.
interface ExecException {
    status: number;
    stdout: Buffer | string;
    stderr: Buffer | string;
}

// breaking runs 'buf breaking' with the given command line arguments.
// Note that we run the same 'buf breaking' command twice so that we
// can write out the raw content that users see on the command line.
// We do NOT attempt to reformat the structured FileAnnotation because
// this approach is prone to differentiate from the raw output.
export function breaking(
    binaryPath: string,
    input: string,
    against: string,
    pathsToExclude: string[]
): BreakingResult | Error {
    let breakingCommand = `${binaryPath} breaking ${input} --against ${against}`;
    if (pathsToExclude.length > 0) {
        breakingCommand += ` --exclude-path ${pathsToExclude.join(",")}`;
    }
    const rawOutput = runBreakingCommand(breakingCommand);
    if (isError(rawOutput)) {
        return rawOutput
    }
    breakingCommand += ' --error-format=json';
    const jsonOutput = runBreakingCommand(breakingCommand);
    if (isError(jsonOutput)) {
        return jsonOutput
    }
    const fileAnnotations = parseLines(jsonOutput.trim().split('\n').filter(elem => {
        return elem !== ''
    }))
    if (isError(fileAnnotations)) {
        return fileAnnotations
    }
    return {
        raw: rawOutput,
        fileAnnotations: fileAnnotations,
    };
}

// runBreakingCommand runs the given command. Note that this function assumes
// the given command is 'buf breaking', and handles its exit code as such.
function runBreakingCommand(cmd: string): string | Error {
    try {
        child.execSync(cmd);
    } catch (error) {
        if (isExecException(error)) {
            if (error.status == breakingExitCode) {
                // The command found warnings to report.
                return error.stdout.toString();
            }
            return {
                message: error.stderr.toString(),
            };
        }
        return {
            message: `failed to run command: ${cmd}`
        };
    }
    return ''
}

// parseLines parses the given output lines into an array
// of FileAnnotations.
function parseLines(lines: string[]): FileAnnotation[] | Error {
  const fileAnnotations: FileAnnotation[] = [];
  for (let index = 0; index < lines.length; index++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const fileAnnotation = JSON.parse(lines[index]);
      if (!isFileAnnotation(fileAnnotation)) {
        return {
          message: `failed to parse "${lines[index]}" as file annotation`,
        };
      }
      fileAnnotations.push(fileAnnotation);
    } catch (error) {
      return {
        message: `failed to parse "${lines[index]}" as file annotation`,
      };
    }
  }
  return fileAnnotations;
}

// isFileAnnotation returns true if the given object is
// a FileAnnotation according to the minimal fields that
// must be present.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFileAnnotation(o: any): o is FileAnnotation {
  return (
    'message' in o
  );
}

// isExecException returns true if the given object is
// a ExecException according to the minimal fields that
// are used in this module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isExecException(o: any): o is ExecException {
  return (
    'status' in o &&
    'stdout' in o &&
    'stderr' in o
  );
}
