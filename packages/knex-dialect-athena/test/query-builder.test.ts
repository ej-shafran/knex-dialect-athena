import { describe, expect } from "vitest";
import { it } from "@fast-check/vitest";
import fc from "fast-check";
import { fakeAthenaKnex } from "./helpers/knex";

const limitAndOffsetProperty = it.prop([
  fc.integer({ min: 1 }),
  fc.integer({ min: 1 }),
]);

const knex = fakeAthenaKnex();

describe("toQuery", () => {
  limitAndOffsetProperty("should put offset before limit", (limit, offset) => {
    const query = knex("table")
      .select("*")
      .limit(limit)
      .offset(offset)
      .toQuery();

    expect(query).toBe(
      `select * from "table" offset ${offset.toString()} limit ${limit.toString()}`,
    );
  });
});
