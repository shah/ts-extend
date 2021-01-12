import * as actv from "../activity.ts";
import { path } from "../deps.ts";
import * as fsp from "./file-sys-plugin.ts";

export interface LocalFileActivity extends actv.PluginActivity {
  readonly localFile: fsp.FileSystemPathAndFName;
  readonly localFileHumanFriendly: fsp.FileSystemPathAndFName;
}

export function localFileActivity(
  message: string,
  localFile: fsp.FileSystemPathAndFName,
  localFileHumanFriendly: fsp.FileSystemPathAndFName,
  defaults?: Partial<
    Omit<LocalFileActivity, "message" | "localFile" | "localFileHumanFriendly">
  >,
): LocalFileActivity {
  return {
    message,
    localFile,
    localFileHumanFriendly,
    ...defaults,
  };
}

export function proposeLocalFileActivity(
  message: string,
  localFile: fsp.FileSystemPathAndFName,
  localFileHumanFriendly: fsp.FileSystemPathAndFName,
  defaults?: Partial<
    Omit<LocalFileActivity, "message" | "localFile" | "localFileHumanFriendly">
  >,
): LocalFileActivity {
  return {
    message,
    localFile,
    localFileHumanFriendly,
    ...defaults,
  };
}

export function generatedLocalFile(
  localFile: fsp.FileSystemPathAndFName,
  localFileHumanFriendly: fsp.FileSystemPathAndFName,
  defaults?: Partial<
    Omit<LocalFileActivity, "message" | "localFile" | "localFileHumanFriendly">
  >,
): LocalFileActivity {
  return {
    message: `Generated '${path.basename(localFileHumanFriendly)}' in ${
      path.dirname(localFileHumanFriendly)
    }`,
    localFile,
    localFileHumanFriendly,
    ...defaults,
  };
}

export function proposeGenerateLocalFile(
  localFile: fsp.FileSystemPathAndFName,
  localFileHumanFriendly: fsp.FileSystemPathAndFName,
  defaults?: Partial<
    Omit<LocalFileActivity, "message" | "localFile" | "localFileHumanFriendly">
  >,
): LocalFileActivity {
  return {
    message: `Will generate ${path.basename(localFileHumanFriendly)} in ${
      path.dirname(localFileHumanFriendly)
    }`,
    localFile,
    localFileHumanFriendly,
    ...defaults,
  };
}

export function removedLocalFile(
  localFile: fsp.FileSystemPathAndFName,
  localFileHumanFriendly: fsp.FileSystemPathAndFName,
  defaults?: Partial<
    Omit<LocalFileActivity, "message" | "localFile" | "localFileHumanFriendly">
  >,
): LocalFileActivity {
  return {
    message: `Removed '${path.basename(localFileHumanFriendly)}' from ${
      path.dirname(localFileHumanFriendly)
    }`,
    localFile,
    localFileHumanFriendly,
    ...defaults,
  };
}

export function proposeRemoveLocalFile(
  localFile: fsp.FileSystemPathAndFName,
  localFileHumanFriendly: fsp.FileSystemPathAndFName,
  defaults?: Partial<
    Omit<LocalFileActivity, "message" | "localFile" | "localFileHumanFriendly">
  >,
): LocalFileActivity {
  return {
    message: `rm -f "${path.basename(localFileHumanFriendly)}"`,
    localFile,
    localFileHumanFriendly,
    ...defaults,
  };
}
