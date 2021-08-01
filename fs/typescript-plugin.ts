import { extn, govnSvcTelemetry as telem, path } from "./deps.ts";
import * as fs from "./file-sys-plugin.ts";

export class DenoModuleFileRegistrar<PM extends extn.PluginsManager>
  implements extn.PluginRegistrar {
  readonly denoModuleRegistrar: extn.DenoModuleRegistrar<PM>;
  readonly denoModulesTelemetry: extn.TypicalDenoModuleRegistrarTelemetry;

  constructor(
    readonly manager: PM,
    readonly telemetry: telem.Instrumentation,
  ) {
    this.denoModulesTelemetry = new extn.TypicalDenoModuleRegistrarTelemetry(
      telemetry,
    );
    this.denoModuleRegistrar = new extn.DenoModuleRegistrar(
      manager,
      this.denoModulesTelemetry,
    );
  }

  // deno-lint-ignore require-await
  async pluginApplicability(
    source: extn.PluginSource,
  ): Promise<extn.PluginRegistrarSourceApplicability> {
    if (fs.isFileSystemPluginSource(source)) {
      if (
        source.fileNameExtension.endsWith(".ts") ||
        source.fileNameExtension.endsWith(".js")
      ) {
        return { isApplicable: true };
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
    options?: extn.PluginRegistrationOptions,
  ): Promise<extn.PluginRegistration> {
    if (fs.isFileSystemPluginSource(source)) {
      try {
        const module = await extn.importCachedModule(
          path.toFileUrl(source.absPathAndFileName),
          this.denoModulesTelemetry,
        );
        const dms: extn.DenoModulePluginSource = {
          ...source,
          moduleEntryPoint: module,
        };
        return await this.denoModuleRegistrar.pluginRegistration(
          dms,
          onInvalid,
          options,
        );
      } catch (err) {
        const result: extn.InvalidPluginRegistration = {
          source: source,
          issues: [{ source: source, diagnostics: [err] }],
        };
        return result;
      }
    }
    const result: extn.InvalidPluginRegistration = {
      source: source,
      issues: [{
        source: source,
        diagnostics: [
          "typeScriptFileRegistrar() only knows how to register file system sources",
        ],
      }],
    };
    return onInvalid(source, result);
  }
}
