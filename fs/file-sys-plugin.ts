import { extn, fs, path, safety } from "./deps.ts";

export type FileSystemPathAndFName = string;
export type FileSystemPathOnly = string;
export type FileSystemGlob = string;
export type FileSystemGlobs = FileSystemGlob[];

// deno-lint-ignore no-empty-interface
export interface FileSystemPluginsManager extends extn.PluginsManager {
}

export interface FileSystemPluginSource extends extn.PluginSource {
  readonly absPathAndFileName: string;
  readonly fileNameExtension: string;
}

export const isFileSystemPluginSource = safety.typeGuard<
  FileSystemPluginSource
>(
  "registrarID",
  "absPathAndFileName",
  "fileNameExtension",
  "systemID",
  "friendlyName",
  "abbreviatedName",
  "graphNodeName",
);

export interface DiscoverFileSystemRouteGlob
  extends extn.PluginRegistrationOptions {
  readonly globID: extn.PluginRegistrarIdentity;
  readonly glob: FileSystemGlob;
  readonly registrars: extn.PluginRegistrar[];
  readonly acquireSource?: (
    dfspSrc: DiscoverFileSystemPluginSource,
    registrar: extn.PluginRegistrar,
  ) => DiscoverFileSystemPluginSource | false;
}

export interface DiscoverFileSystemRoute {
  readonly discoveryPath: FileSystemPathOnly;
  readonly globs: DiscoverFileSystemRouteGlob[];
}

export interface DiscoverFileSystemPluginSource extends FileSystemPluginSource {
  readonly route: DiscoverFileSystemRoute;
  readonly glob: DiscoverFileSystemRouteGlob;
}

export const isDiscoverFileSystemPluginSource = safety.typeGuard<
  DiscoverFileSystemPluginSource
>(
  "route",
  "registrarID",
  "absPathAndFileName",
  "systemID",
  "friendlyName",
  "abbreviatedName",
  "graphNodeName",
);

export class FileSystemRoutesPlugins implements extn.InactivePluginsSupplier {
  readonly validInactivePlugins: extn.ValidPluginRegistration[] = [];
  readonly invalidPlugins: extn.InvalidPluginRegistration[] = [];
  readonly unknownPlugins: extn.PluginRegistration[] = [];

  constructor() {
  }

  async acquire(routes: DiscoverFileSystemRoute[]): Promise<void> {
    for (const route of routes) {
      for (const glob of route.globs) {
        for (
          const we of fs.expandGlobSync(glob.glob, {
            root: route.discoveryPath,
          })
        ) {
          if (we.isFile) {
            for (const registrar of glob.registrars) {
              let dfspSrc: DiscoverFileSystemPluginSource = {
                registrarID: `${registrar.registrarID}::${glob.globID}`,
                route,
                glob,
                systemID: we.path,
                friendlyName: path.relative(route.discoveryPath, we.path),
                abbreviatedName: path.basename(we.path),
                absPathAndFileName: we.path,
                fileNameExtension: path.extname(we.path),
                graphNodeName: path.relative(route.discoveryPath, we.path),
              };

              if (glob.acquireSource) {
                const acquireSource = glob.acquireSource(dfspSrc, registrar);
                if (!acquireSource) continue; // false means skip this file for this registrar
                dfspSrc = acquireSource;
              }

              const pa = await registrar.pluginApplicability(dfspSrc);
              if (pa.isApplicable) {
                const finalSource = pa.redirectSource || dfspSrc;
                const finalRegistrar = pa.alternateRegistrar ||
                  registrar;
                const registration = await finalRegistrar.pluginRegistration(
                  finalSource,
                  // deno-lint-ignore require-await
                  async (source, suggested) => {
                    return suggested || {
                      source,
                      issues: [{
                        source,
                        diagnostics: [
                          `invalid plugin: ${source.registrarID} ${source.systemID}`,
                        ],
                      }],
                    };
                  },
                  glob,
                );
                if (registration) {
                  if (extn.isValidPluginRegistration(registration)) {
                    this.validInactivePlugins.push(registration);
                  } else if (extn.isInvalidPluginRegistration(registration)) {
                    this.invalidPlugins.push(registration);
                  } else {
                    this.unknownPlugins.push(registration);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
