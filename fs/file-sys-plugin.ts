import { fs, path, safety } from "../deps.ts";
import * as fr from "../framework.ts";
import * as tsExtn from "../typescript-extn.ts";
import * as sfp from "./shell-exe-plugin.ts";
import * as tsp from "./typescript-plugin.ts";

export type FileSystemPathAndFName = string;
export type FileSystemPathOnly = string;
export type FileSystemGlob = string;
export type FileSystemGlobs = FileSystemGlob[];

export interface FileSystemPluginsSupplier extends fr.PluginsSupplier {
  readonly localFsSources: FileSystemGlobs;
}

export const isLocalFsPluginManager = safety.typeGuard<
  FileSystemPluginsSupplier
>(
  "localFsSources",
);

export interface FileSystemPluginSource extends fr.PluginSource {
  readonly absPathAndFileName: string;
}

export const isFileSystemPluginSource = safety.typeGuard<
  FileSystemPluginSource
>(
  "absPathAndFileName",
);

export function fileSystemPluginRegistrar<T extends fr.PluginExecutive>(
  src: FileSystemPluginSource,
  sfro: sfp.ShellFileRegistrarOptions<T>,
  tsro: tsExtn.TypeScriptRegistrarOptions,
): fr.PluginRegistrar | undefined {
  switch (path.extname(src.absPathAndFileName)) {
    case ".ts":
      return tsp.typeScriptFileRegistrar(tsro);

    default:
      return sfp.shellFileRegistrar<T>(sfro);
  }
}

export interface DiscoverFileSystemPluginSource extends FileSystemPluginSource {
  readonly discoveryPath: FileSystemPathOnly;
  readonly glob: FileSystemGlob;
}

export const isDiscoverFileSystemPluginSource = safety.typeGuard<
  DiscoverFileSystemPluginSource
>("discoveryPath", "glob");

export interface DiscoverFileSystemPluginsOptions<
  T extends fr.PluginExecutive,
> {
  readonly discoveryPath: FileSystemPathOnly;
  readonly globs: FileSystemGlobs;
  readonly onValidPlugin: (vpr: fr.ValidPluginRegistration) => void;
  readonly onInvalidPlugin?: (ipr: fr.InvalidPluginRegistration) => void;
  readonly shellFileRegistryOptions: sfp.ShellFileRegistrarOptions<T>;
  readonly typeScriptFileRegistryOptions: tsExtn.TypeScriptRegistrarOptions;
}

export async function discoverFileSystemPlugins<T extends fr.PluginExecutive>(
  options: DiscoverFileSystemPluginsOptions<T>,
): Promise<void> {
  const { discoveryPath, globs, onValidPlugin, onInvalidPlugin } = options;
  for (const glob of globs) {
    for (const we of fs.expandGlobSync(glob, { root: options.discoveryPath })) {
      if (we.isFile) {
        const dfspSrc: DiscoverFileSystemPluginSource = {
          discoveryPath: discoveryPath,
          glob,
          systemID: we.path,
          friendlyName: path.relative(discoveryPath, we.path),
          absPathAndFileName: we.path,
        };

        const register = fileSystemPluginRegistrar(
          dfspSrc,
          options.shellFileRegistryOptions,
          options.typeScriptFileRegistryOptions,
        );
        if (register) {
          const registration = await register(dfspSrc);
          if (fr.isValidPluginRegistration(registration)) {
            onValidPlugin(registration);
          }
          if (fr.isInvalidPluginRegistration(registration) && onInvalidPlugin) {
            onInvalidPlugin(registration);
          }
        }
      }
    }
  }
}
