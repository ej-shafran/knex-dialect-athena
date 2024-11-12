import { describe, expect } from "vitest";
import { it } from "@fast-check/vitest";
import { ColumnInfo, ResultSet } from "@aws-sdk/client-athena";
import fc from "fast-check";
import {
  mockAthenaSelectingQuery,
  mockAthenaUpdatingQuery,
} from "./helpers/mock";
import { fakeAthenaKnex } from "./helpers/knex";

interface User {
  id: string;
  age: number;
  net_worth: number;
  roles: unknown;
  is_alive: boolean;
  raw_data: Uint8Array;
}

const typeArb = (type: string | undefined): fc.Arbitrary<string> => {
  if (type === "json") return fc.object().map(JSON.stringify);
  if (type === "integer" || type === "int" || type === "bigint")
    return fc.integer().map(String);
  if (type === "decimal" || type === "double" || type === "real")
    return fc.float().map(String);
  if (type === "boolean") return fc.boolean().map(String);
  if (type === "varbinary")
    return fc.uint8Array().map(
      (array) =>
        `X${Array.from(array)
          .map((byte) => byte.toString(16))
          .join(" ")}`,
    );
  return fc.string();
};

interface ResultSetConstraints {
  minRows?: number;
  maxRows?: number;
}

const defaultResultSetConstraints: ResultSetConstraints = {
  minRows: 0,
  maxRows: undefined,
};

const resultSetArb = (
  columnInfo: ColumnInfo[],
  constraints?: ResultSetConstraints,
): fc.Arbitrary<ResultSet> => {
  const fullConstraints = { ...defaultResultSetConstraints, ...constraints };

  return fc.record({
    ResultSetMetadata: fc.record({
      ColumnInfo: fc.constant(columnInfo),
    }),
    Rows: fc
      .array(
        fc.record({
          Data: fc.tuple(
            ...columnInfo.map((column) =>
              typeArb(column.Type).map((value) => ({
                VarCharValue: value,
              })),
            ),
          ),
        }),
        {
          minLength: fullConstraints.minRows,
          maxLength: fullConstraints.maxRows,
        },
      )
      .map((rows) => [
        { Data: columnInfo.map((column) => ({ VarCharValue: column.Name })) },
        ...rows,
      ]),
  });
};

const userResultSetArb = () =>
  resultSetArb(
    [
      { Name: "id", Type: "varchar" },
      { Name: "age", Type: "integer" },
      { Name: "net_worth", Type: "real" },
      { Name: "is_alive", Type: "boolean" },
      { Name: "raw_data", Type: "varbinary" },
      { Name: "roles", Type: "json" },
    ],
    {
      minRows: 1,
    },
  );

const updateCountArb = () => fc.nat();

const userResultSetProperty = it.prop([userResultSetArb()], { numRuns: 40 });
const updateCountProperty = it.prop([updateCountArb()], { numRuns: 40 });

describe("mapping over results", () => {
  const knex = fakeAthenaKnex();

  describe("selecting queries", () => {
    userResultSetProperty(
      "should transform things to their correct type",
      async (resultSet) => {
        mockAthenaSelectingQuery(resultSet);

        const result = await knex<User>("users").select("*").first();
        expect(result).toBeDefined();
        expect(result?.id).toBeTypeOf("string");
        expect(result?.age).toBeTypeOf("number");
        expect(result?.net_worth).toBeTypeOf("number");
        expect(result?.is_alive).toBeTypeOf("boolean");
        expect(result?.raw_data).toBeInstanceOf(Uint8Array);
        expect(result?.roles).toBeDefined();
      },
    );
  });

  describe("updating queries", () => {
    updateCountProperty("should not do any mapping", async (updateCount) => {
      mockAthenaUpdatingQuery(updateCount);

      const result = await knex.insert({}).into("users");
      expect(result).toBe(updateCount);
    });
  });
});
