import { io } from "./deps.ts";
import { testingAsserts as ta } from "./deps-test.ts";
import * as mod from "./contrib.ts";

Deno.test(`contributionContentTextSync text`, () => {
  ta.assertEquals(
    mod.contributionContentTextSync({
      text: "text",
    }),
    "text",
  );
});

Deno.test(`contributionContentTextSync flexibleText`, () => {
  ta.assertEquals(
    mod.contributionContentTextSync({
      flexibleText: "flexibleText",
    }),
    "flexibleText",
  );
  ta.assertEquals(
    mod.contributionContentTextSync({
      flexibleText: () => "flexibleText()",
    }),
    "flexibleText()",
  );
});

Deno.test(`contributionContentTextSync flexibleContent`, () => {
  ta.assertEquals(
    mod.contributionContentTextSync({
      flexibleContent: "flexibleContent[string]",
    }),
    "flexibleContent[string]",
  );
  const te = new TextEncoder();
  ta.assertEquals(
    mod.contributionContentTextSync({
      flexibleContent: te.encode("flexibleContent[Uint8Array]"),
    }),
    "flexibleContent[Uint8Array]",
  );
  ta.assertEquals(
    mod.contributionContentTextSync({
      flexibleContent: () => "flexibleContent[string]()",
    }),
    "flexibleContent[string]()",
  );
  ta.assertEquals(
    mod.contributionContentTextSync({
      flexibleContent: () => te.encode("flexibleContent[Uint8Array]()"),
    }),
    "flexibleContent[Uint8Array]()",
  );
});

Deno.test(`contributionContentTextSync emit`, async () => {
  ta.assertEquals(
    await mod.contributionContentText({
      emit: async (writer) => {
        const te = new TextEncoder();
        await writer.write(te.encode("emit"));
      },
    }),
    "emit",
  );
});

Deno.test(`contributionContentTextSync emitSync`, () => {
  ta.assertEquals(
    mod.contributionContentTextSync({
      emitSync: (writer) => {
        const te = new TextEncoder();
        writer.write(te.encode("emitSync"));
      },
    }),
    "emitSync",
  );
});

Deno.test(`contributionContentTextSync unknown`, () => {
  ta.assertEquals(
    mod.contributionContentTextSync({}),
    [undefined, false],
  );
});

// Deno.test(`contributionContentTextSync flexibleSingleUseWriter`, () => {
//   ta.assertEquals(
//     mod.contributionContentTextSync({
//       flexibleSingleUseWriter: new io.StringWriter(),
//     }),
//     "contributionContentTextSync cannot handle async contributor content: keys flexibleSingleUseWriter",
//   );
//   ta.assertEquals(
//     mod.contributionContentTextSync({
//       flexibleSingleUseWriter: () => new io.StringWriter(),
//     }),
//     "contributionContentTextSync cannot handle async contributor content: keys flexibleSingleUseWriter",
//   );
// });

// Deno.test(`contributionContentTextSync flexibleWriter`, () => {
//   ta.assertEquals(
//     mod.contributionContentTextSync({
//       flexibleWriter: new io.StringWriter(),
//     }),
//     "contributionContentTextSync cannot handle async contributor content: keys flexibleWriter",
//   );
//   ta.assertEquals(
//     mod.contributionContentTextSync({
//       flexibleWriter: () => new io.StringWriter(),
//     }),
//     "contributionContentTextSync cannot handle async contributor content: keys flexibleWriter",
//   );
// });

// Deno.test(`contributionContentTextSync write`, () => {
//   const writer = new io.StringWriter();
//   ta.assertEquals(
//     mod.contributionContentTextSync({
//       write: writer.write,
//     }),
//     "contributionContentTextSync cannot handle async contributor content: keys write",
//   );
// });
