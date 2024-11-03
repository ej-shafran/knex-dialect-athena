import { describe, expect } from "vitest";
import { fc, it } from "@fast-check/vitest";
import { createAthenaDialect } from "../src";

const Client_Athena = createAthenaDialect({
  database: "",
  outputLocation: "",
});

const client = new Client_Athena({ client: "athena" }) as unknown as {
  _processRow(row: Record<string, string | null>): Record<string, unknown>;
};

const integerProperty = it.prop([fc.integer()]);
const nonNumberStringProperty = it.prop([
  fc.string({ unit: fc.stringMatching(/^\D$/) }),
]);
const dateProperty = it.prop([fc.date()]);

describe("_processRow", () => {
  integerProperty("always processes number strings as numbers", (integer) => {
    const integerString = integer.toString();
    const response = client._processRow({ integerString });
    expect(response.integerString).toBe(integer);
  });

  nonNumberStringProperty(
    "never processes non-number strings as numbers",
    (string) => {
      const response = client._processRow({ string });
      expect(response.string).not.toBeTypeOf("number");
    },
  );

  dateProperty("never processes date strings as numbers", (date) => {
    const dateString = date.toISOString();
    const response = client._processRow({ dateString });
    expect(response.dateString).toBe(dateString);
  });
});
