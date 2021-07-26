# Extensions

Deno module for discovering and executing custom extensions, plugins, and
add-ons written in TypeScript or any shell executable.

Modern applications utilities should have a small core and allows extensions
that _extend functionality without touching core_. If you're writing a utility
or application in Deno and want to allow contributors to add or modify
functionality without needing to touch your core, you should use this
`Extensions` module.

## Interfaces

- `Plugin` is the base contract for any extension regardless of nature or how it
  was registered. A plugin (extension) can be either or both and
  `action`/`filter`:
  - `ActionPlugin` has an `execute(PluginContext)` method which performs an
    action and returns `ActionResult`
  - `FilterPlugin` has a `filter(PluginContext)` method which takes input and
    returns `FilterResult`.
- `PluginExecutive` is the extensions _container_ (the application or utility
  itself) which provides extension _hooks_ or _commands_.
- `PluginRegistrar` is a vehicle for registering discovered plugins.
- `PluginsSupplier` is defines a contract for supplying (either discovered or
  predefined) plugins.
- `PluginSource` defines where a plugin was discovered or registered from.
- `PluginContext<T extends PluginExecutive>` is given to each plugin when it's
  being executed.

## Implementations

- `ShellExePlugin`
- `DenoModulePlugin`

## TODO

- Move Plugin focused interfaces to contract.ts so that each plugin only needs
  to pull in that specific TS file into its own module
- Create PluginLifecycle events like discover, activate, discard (on error),
  etc. which can be implemented by PluginExecutive or can be provided in Plugins
  meta data
- Add serviceHealth (ServiceHealthSupplier) for indicating healthy or unhealthy
  plugins
- Create plugin dependency management using
  [CxGraph](https://github.com/cfjello/cxgraph)
- Create `ContextPlugin` which has a `prepareContext(PluginContext)` method
  which only prepares a context that multiple extensions can use.
- Create `ActionSync` and `FilterSync` versions of Action and Filter
- Consider adding ActionGenerateSync and FilterGenerateSync versions of Action
  and Filter
- Allow `Action*` or `Filter*` to implement `PluginSupplier` or other methods
  that will force rescanning of plugins in case they generate plugins
- Add ability for a `Plugin` to be a `PluginSupplier` so a plugin can register
  other dependent extensions.
