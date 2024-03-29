import { safety } from "../../deps.ts";
import * as mod from "../../mod.ts";
import * as modT from "../mod_test.ts";

export type TestPluginsSupplier = mod.PluginsSupplier<modT.TestExecutive>;

export type TestPluginContext = mod.PluginContext<modT.TestExecutive>;

export type TestPluginActionResult = mod.ActionResult<
  modT.TestExecutive,
  TestPluginContext
>;

export interface TestAction
  extends mod.DenoModulePlugin, mod.Action<modT.TestExecutive> {
}

export type TestPluginActivatable = mod.DenoModuleActivatable<
  modT.TestExecutive
>;

export interface TestState {
  activateCountState: number;
  deactivateCountState: number;
  executeCountState: number;
  readonly graphNode: mod.PluginGraphNode;
}

export const isTestState = safety.typeGuard<TestState>(
  "activateCountState",
  "executeCountState",
  "graphNode",
);
