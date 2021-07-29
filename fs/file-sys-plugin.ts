import { fs, path, safety } from "../deps.ts";
import * as fr from "../framework.ts";
import * as tsExtn from "../typescript-extn.ts";
import * as sfp from "./shell-exe-plugin.ts";
import * as tsp from "./typescript-plugin.ts";

export type FileSystemPathAndFName = string;
export type FileSystemPathOnly = string;
export type FileSystemGlob = string;
export type FileSystemGlobs = FileSystemGlob[];

export interface FileSystemPluginsSupplier<PE extends fr.PluginExecutive>
  extends fr.PluginsSupplier<PE> {
  readonly localFsSources: FileSystemGlobs;
}

export function isFileSystemPluginsSupplier<PE extends fr.PluginExecutive>(
  o: unknown,
): o is FileSystemPluginsSupplier<PE> {
  const isFSPS = safety.typeGuard<FileSystemPluginsSupplier<PE>>(
    "localFsSources",
  );
  return fr.isPluginsSupplier(o) && isFSPS(o);
}

export interface FileSystemPluginSource extends fr.PluginSource {
  readonly absPathAndFileName: string;
}

export const isFileSystemPluginSource = safety.typeGuard<
  FileSystemPluginSource
>(
  "absPathAndFileName",
);

export function fileSystemPluginRegistrar<
  PE extends fr.PluginExecutive,
  PS extends fr.PluginsSupplier<PE>,
>(
  executive: PE,
  supplier: PS,
  src: FileSystemPluginSource,
  sfro: sfp.ShellFileRegistrarOptions<PE>,
  tsro: tsExtn.TypeScriptRegistrarOptions<PE>,
): fr.PluginRegistrar | undefined {
  switch (path.extname(src.absPathAndFileName)) {
    case ".ts":
      return tsp.typeScriptFileRegistrar(executive, supplier, tsro);

    default:
      return sfp.shellFileRegistrar<PE>(sfro);
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
  PE extends fr.PluginExecutive,
> {
  readonly discoveryPath: FileSystemPathOnly;
  readonly globs: FileSystemGlobs;
  readonly onValidPlugin: (vpr: fr.ValidPluginRegistration) => void;
  readonly onInvalidPlugin?: (ipr: fr.InvalidPluginRegistration) => void;
  readonly shellFileRegistryOptions: sfp.ShellFileRegistrarOptions<PE>;
  readonly typeScriptFileRegistryOptions: tsExtn.TypeScriptRegistrarOptions<PE>;
}

export async function discoverFileSystemPlugins<
  PE extends fr.PluginExecutive,
  PS extends fr.PluginsSupplier<PE>,
>(
  executive: PE,
  supplier: PS,
  options: DiscoverFileSystemPluginsOptions<PE>,
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
          abbreviatedName: path.basename(we.path),
          absPathAndFileName: we.path,
          graphNodeName: path.relative(discoveryPath, we.path),
        };

        const register = fileSystemPluginRegistrar(
          executive,
          supplier,
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
