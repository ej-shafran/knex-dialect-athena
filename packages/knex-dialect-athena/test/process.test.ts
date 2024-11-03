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

const dateProperty = it.prop([fc.date()]);

describe("_processRow", () => {
  dateProperty("always processes date strings correctly", (date) => {
    const dateString = date.toISOString();
    const response = client._processRow({ dateString });
    expect(response.dateString).toBe(dateString);
  });
});
