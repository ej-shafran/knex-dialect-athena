export function assert(
  condition: boolean,
  contextObject: unknown,
  message = "",
): asserts condition {
  if (!condition)
    throw new Error(
      `Assertion failed${message ? `: ${message}` : ""}: ${JSON.stringify(contextObject)}`,
    );
}
