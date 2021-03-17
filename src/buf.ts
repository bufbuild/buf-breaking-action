// Copyright 2020-2021 Buf Technologies, Inc.
//
// All rights reserved.

import cp from 'child_process';
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
    const fileAnnotations = parseLines((jsonOutput as string).trim().split('\n').filter(elem => {
        return elem !== ''
    }))
    if (isError(fileAnnotations)) {
        return fileAnnotations
    }
    return {
        raw: rawOutput as string,
        fileAnnotations: fileAnnotations as FileAnnotation[],
    };
}

// runCommand runs the given command and maps its output into an
// array of FileAnnotations.
function runCommand(cmd: string): string | Error {
    let output = '';
    try {
        cp.execSync(cmd);
    } catch (error) {
        output = error.stdout.toString();
        const commandError = error.stderr.toString();
        if (commandError !== '') {
            return {
                errorMessage: commandError,
            };
        }
    }
    return output
}

// parseLines parses the given output lines into an array
// of FileAnnotations.
function parseLines(lines: string[]): FileAnnotation[] | Error {
  let fileAnnotations: FileAnnotation[] = [];
  for (let index = 0; index < lines.length; index++) {
    try {
      const fileAnnotation = JSON.parse(lines[index]);
      if (!isFileAnnotation(fileAnnotation)) {
        return {
          errorMessage: `failed to parse "${lines[index]}" as file annotation`,
        };
      }
      fileAnnotations.push(fileAnnotation);
    } catch (error) {
      return {
        errorMessage: `failed to parse "${lines[index]}" as file annotation: ${error}`,
      };
    }
  }
  return fileAnnotations;
};

// isFileAnnotation returns true if the given object is
// a FileAnnotation according to the minimal fields that
// must be present.
function isFileAnnotation(o: any): o is FileAnnotation {
  return (
    'type' in o &&
    'message' in o
  );
}
