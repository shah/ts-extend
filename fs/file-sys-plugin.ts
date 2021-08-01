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
  "absPathAndFileName",
  "fileNameExtension",
  "systemID",
  "friendlyName",
  "abbreviatedName",
  "graphNodeName",
);

export interface FileSystemPluginSourceRegistrarStrategy {
  (source: FileSystemPluginSource): extn.PluginRegistrar | undefined;
}

export class FileSourcePluginRegistrar<PM extends extn.PluginsManager>
  implements extn.PluginRegistrar {
  constructor(
    readonly manager: PM,
    readonly sourceNameRegistrar: FileSystemPluginSourceRegistrarStrategy,
    readonly defaultRegistrar?: extn.PluginRegistrar,
  ) {
  }

  // deno-lint-ignore require-await
  async pluginApplicability(
    source: extn.PluginSource,
  ): Promise<extn.PluginRegistrarSourceApplicability> {
    if (isFileSystemPluginSource(source)) {
      const registrar = this.sourceNameRegistrar(source);
      if (registrar) {
        return { isApplicable: true, alternateRegistrar: registrar };
      }
      if (this.defaultRegistrar) {
        return {
          isApplicable: true,
          alternateRegistrar: this.defaultRegistrar,
        };
      }
    }
    return { isApplicable: false };
  }

  async pluginRegistration(
    source: extn.PluginSource,
    onInvalid: (
      src: extn.PluginSource,
      suggested?: extn.InvalidPluginRegistration,
    ) => Promise<extn.PluginRegistration>,
    nature?: (suggested: extn.PluginNature) => extn.PluginNature,
  ): Promise<extn.PluginRegistration> {
    const pa = await this.pluginApplicability(source);
    if (pa.isApplicable) {
      if (pa.alternateRegistrar) {
        return await pa.alternateRegistrar.pluginRegistration(
          pa.redirectSource || source,
          onInvalid,
          nature,
        );
      } else {
        const invalid: extn.InvalidPluginRegistration = {
          source,
          issues: [
            {
              source,
              diagnostics: [
                `FileExtensionPluginRegistrar.pluginRegistration pa.alternateRegistrar not provided`,
              ],
            },
          ],
        };
        return onInvalid(source, invalid);
      }
    }
    return onInvalid(source);
  }
}

export interface DiscoverFileSystemRouteGlob {
  readonly glob: FileSystemGlob;
  readonly nature?: (suggested: extn.PluginNature) => extn.PluginNature;
}

export interface DiscoverFileSystemRoute {
  readonly registrars: extn.PluginRegistrar[];
  readonly discoveryPath: FileSystemPathOnly;
  readonly globs: DiscoverFileSystemRouteGlob[];
}

export interface DiscoverFileSystemPluginSource extends FileSystemPluginSource {
  readonly route: DiscoverFileSystemRoute;
  readonly glob: FileSystemGlob;
}

export const isDiscoverFileSystemPluginSource = safety.typeGuard<
  DiscoverFileSystemPluginSource
>(
  "route",
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
            const dfspSrc: DiscoverFileSystemPluginSource = {
              route,
              glob: glob.glob,
              systemID: we.path,
              friendlyName: path.relative(route.discoveryPath, we.path),
              abbreviatedName: path.basename(we.path),
              absPathAndFileName: we.path,
              fileNameExtension: path.extname(we.path),
              graphNodeName: path.relative(route.discoveryPath, we.path),
            };

            for (const registrar of route.registrars) {
              const registration = await registrar.pluginRegistration(
                dfspSrc,
                // deno-lint-ignore require-await
                async (source, suggested) => {
                  return suggested || {
                    source,
                    issues: [{
                      source,
                      diagnostics: [
                        `invalid plugin: ${JSON.stringify(source)}`,
                      ],
                    }],
                  };
                },
                glob.nature,
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
