import { testingAsserts as ta } from "./deps-test.ts";
import { safety } from "./deps.ts";
import * as mod from "./assemble.ts";

interface TestContext extends mod.AssemblyContext {
  isTestContext: true;
  count: number;
}

const isTestContext = safety.typeGuard<TestContext>("isTestContext", "count");

interface TestTarget {
  isTestObject: true;
}

interface ChainedTarget extends mod.AssemblyResult<TestTarget> {
  isChainedTarget: true;
  previous: TestTarget;
}

const isChainedTarget = safety.typeGuard<ChainedTarget>(
  "isChainedTarget",
  "previous",
);

// deno-lint-ignore require-await
async function assembleTestTarget(
  target: TestTarget | mod.AssemblyResult<TestTarget>,
  ctx?: mod.AssemblyContext,
): Promise<TestTarget | mod.AssemblyResult<TestTarget>> {
  if (isTestContext(ctx)) {
    ctx.count++;
  }
  ta.assert(!mod.isAssemblyResult(target));
  return {
    target,
    isTestObject: true,
  };
}

// deno-lint-ignore require-await
async function assembleChainedTarget(
  target: TestTarget | mod.AssemblyResult<TestTarget>,
  ctx?: mod.AssemblyContext,
): Promise<TestTarget | mod.AssemblyResult<TestTarget> | ChainedTarget> {
  if (isTestContext(ctx)) {
    ctx.count++;
  }
  if (mod.isAssemblyResult(target)) {
    const result:
      & ChainedTarget
      & mod.AssemblyTransformerProvenanceSupplier<TestTarget> = {
        ...target,
        isChainedTarget: true,
        previous: target.target,
        isTransformed: mod.assemblyTransformationSource<TestTarget>(
          target.target,
        ),
      };
    return result;
  }

  return mod.assemblyIssue(target, "mod.isAssembleResult(target) expected");
}

Deno.test("AssemblyPipe async", async () => {
  const pipe = mod.assemblyPipe<TestTarget>(
    assembleTestTarget,
    assembleChainedTarget,
  );
  const ctx: TestContext = { isTestContext: true, count: 0 };
  const result = await pipe({ isTestObject: true }, ctx);
  ta.assertEquals(ctx.count, 2);
  ta.assert(mod.isAssemblyResult(result));
  ta.assert(isChainedTarget(result));
  ta.assert(mod.isTransformedAssemblyResult(result));
  ta.assertEquals(result.isTransformed.position, 0);
});

function assembleTestTargetSync(
  target: TestTarget | mod.AssemblyResult<TestTarget>,
  ctx?: mod.AssemblyContext,
): TestTarget | mod.AssemblyResult<TestTarget> {
  if (isTestContext(ctx)) {
    ctx.count++;
  }
  ta.assert(!mod.isAssemblyResult(target));
  return {
    target,
    isTestObject: true,
  };
}

function assembleChainedTargetSync(
  target: TestTarget | mod.AssemblyResult<TestTarget>,
  ctx?: mod.AssemblyContext,
): TestTarget | mod.AssemblyResult<TestTarget> | ChainedTarget {
  if (isTestContext(ctx)) {
    ctx.count++;
  }
  if (mod.isAssemblyResult(target)) {
    const result:
      & ChainedTarget
      & mod.AssemblyTransformerProvenanceSupplier<TestTarget> = {
        ...target,
        isChainedTarget: true,
        previous: target.target,
        isTransformed: mod.assemblyTransformationSource<TestTarget>(
          target.target,
        ),
      };
    return result;
  }

  return mod.assemblyIssue(target, "mod.isAssemblyResult(target) expected");
}

Deno.test("AssemblyPipe sync", () => {
  const pipe = mod.assemblyPipeSync<TestTarget>(
    assembleTestTargetSync,
    assembleChainedTargetSync,
  );
  const ctx: TestContext = { isTestContext: true, count: 0 };
  const result = pipe({ isTestObject: true }, ctx);
  ta.assertEquals(ctx.count, 2);
  ta.assert(mod.isAssemblyResult(result));
  ta.assert(isChainedTarget(result));
  ta.assert(mod.isTransformedAssemblyResult(result));
  ta.assertEquals(result.isTransformed.position, 0);
});
