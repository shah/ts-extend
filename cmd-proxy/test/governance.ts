import { safety } from "../../deps.ts";
import * as mod from "../../mod.ts";
import * as modT from "../mod_test.ts";

export type TestPluginsSupplier = mod.PluginsSupplier<modT.TestExecutive>;

export type TestPluginContext = mod.PluginContext<modT.TestExecutive>;

export type TestPluginActionResult = mod.ActionResult<
  modT.TestExecutive,
  TestPluginContext
>;

export interface TestAction extends
  mod.DenoModulePlugin,
  mod.Action<
    modT.TestExecutive,
    TestPluginContext,
    TestPluginActionResult
  > {
}

export type TestPluginActivateCtx = mod.DenoModuleActivateContext<
  modT.TestExecutive,
  TestPluginContext,
  TestPluginsSupplier
>;
export type TestPluginActivateResult = mod.DenoModuleActivateResult<
  modT.TestExecutive,
  TestPluginContext,
  TestPluginsSupplier,
  TestPluginActivateCtx
>;

export type TestPluginActivatable = mod.DenoModuleActivatable<
  modT.TestExecutive,
  TestPluginContext,
  TestPluginsSupplier,
  TestPluginActivateCtx,
  TestPluginActivateResult
>;

export interface TestState {
  activateCountState: number;
  executeCountState: number;
  readonly graphNode: mod.PluginGraphNode;
}

export const isTestState = safety.typeGuard<TestState>(
  "activateCountState",
  "executeCountState",
  "graphNode",
);
