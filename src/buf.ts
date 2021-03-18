// Copyright 2020-2021 Buf Technologies, Inc.
//
// All rights reserved.

import * as child from 'child_process';
import { Error, isError } from './error';

// BreakingResult includes both the raw and formatted FileAnnotation
// output of a 'buf breaking` command execution. We include both so
// that we preserve the same content users would see on the command line.
export interface BreakingResult {
    raw: string;
    fileAnnotations: FileAnnotation[];
}

// FileAnnotation conforms the buf FileAnnotation definition
// referenced from the following:
// https://github.com/bufbuild/buf/blob/8255257bd94c9f1b5faa27242211c5caad05be79/internal/buf/bufanalysis/bufanalysis.go#L102
export interface FileAnnotation {
    type: string;
    message: string;
    path?: string;
    start_line?: number;
    end_line?: number;
}

// ExecException is a subset of the child.ExecException interface.
interface ExecException {
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
): BreakingResult | Error {
    const rawOutput = runCommand(`${binaryPath} breaking ${input} --against ${against}`);
    if (isError(rawOutput)) {
        return rawOutput
    }
    const jsonOutput = runCommand(`${binaryPath} breaking ${input} --against ${against} --error-format=json`);
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

// runCommand runs the given command and maps its output into an
// array of FileAnnotations.
function runCommand(cmd: string): string | Error {
    let output = '';
    try {
        child.execSync(cmd);
    } catch (error) {
        let commandError = '';
        if (isExecException(error)) {
            output = error.stdout.toString();
            commandError = error.stderr.toString();
        } else {
            commandError = `failed to run command: ${cmd}`
        }
        if (commandError !== '') {
            return {
                message: commandError,
            };
        }
    }
    return output
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
    'type' in o &&
    'message' in o
  );
}

// isExecException returns true if the given object is
// a ExecException according to the minimal fields that
// are used in this module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isExecException(o: any): o is ExecException {
  return (
    'stdout' in o &&
    'stderr' in o
  );
}
