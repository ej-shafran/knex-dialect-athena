import Knex from "knex";
import nock from "nock";
import { describe, expect } from "vitest";
import { it } from "@fast-check/vitest";
import { createAthenaDialect } from "../src";
import {
  ColumnInfo,
  GetQueryExecutionCommandOutput,
  GetQueryResultsCommandOutput,
  ResultSet,
  StartQueryExecutionCommandOutput,
} from "@aws-sdk/client-athena";
import fc from "fast-check";

// Create fake AWS credentials so the credential provider does not error
process.env.AWS_ACCESS_KEY_ID = crypto.randomUUID();
process.env.AWS_SECRET_ACCESS_KEY = crypto.randomUUID();
process.env.AWS_REGION = crypto.randomUUID();

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

const mockAthenaSelectingQuery = (resultSet: ResultSet) =>
  nock(/.*/)
    .post("/")
    .matchHeader("x-amz-target", "AmazonAthena.StartQueryExecution")
    .reply(
      200,
      (): StartQueryExecutionCommandOutput => ({
        $metadata: {},
        QueryExecutionId: "123",
      }),
    )
    .post("/")
    .matchHeader("x-amz-target", "AmazonAthena.GetQueryExecution")
    .reply(
      200,
      (): GetQueryExecutionCommandOutput => ({
        $metadata: {},
        QueryExecution: { Status: { State: "SUCCEEDED" } },
      }),
    )
    .post("/")
    .matchHeader("x-amz-target", "AmazonAthena.GetQueryResults")
    .reply(
      200,
      (): GetQueryResultsCommandOutput => ({
        $metadata: {},
        ResultSet: resultSet,
      }),
    );

const mockAthenaUpdatingQuery = (updateCount: number) =>
  nock(/.*/)
    .post("/")
    .matchHeader("x-amz-target", "AmazonAthena.StartQueryExecution")
    .reply(
      200,
      (): StartQueryExecutionCommandOutput => ({
        $metadata: {},
        QueryExecutionId: "123",
      }),
    )
    .post("/")
    .matchHeader("x-amz-target", "AmazonAthena.GetQueryExecution")
    .reply(
      200,
      (): GetQueryExecutionCommandOutput => ({
        $metadata: {},
        QueryExecution: { Status: { State: "SUCCEEDED" } },
      }),
    )
    .post("/")
    .matchHeader("x-amz-target", "AmazonAthena.GetQueryResults")
    .reply(
      200,
      (): GetQueryResultsCommandOutput => ({
        $metadata: {},
        UpdateCount: updateCount,
      }),
    );

describe("mapping over results", () => {
  const knex = Knex({
    client: createAthenaDialect({
      database: "",
      outputLocation: "",
    }),
  });

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
