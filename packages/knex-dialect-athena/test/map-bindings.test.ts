import fc from "fast-check";
import { it } from "@fast-check/vitest";
import { beforeEach, describe, expect, vi } from "vitest";
import { fakeAthenaKnex } from "./helpers/knex";

const querySpy = vi.hoisted(() => vi.fn().mockResolvedValue(1));
vi.mock("../src/athena-connection", () => ({
  AthenaConnection: function () {
    (this as { query: unknown }).query = querySpy;
  },
}));

const numberProperty = it.prop([fc.float()]);
const stringProperty = it.prop([fc.string()]);

describe("mapping over bindings", () => {
  beforeEach(() => {
    querySpy.mockClear();
  });

  const knex = fakeAthenaKnex();

  it("should turn `null` into 'null'", async () => {
    await knex.insert({ value: null }).into("table");
    expect(querySpy).toHaveBeenCalledWith(expect.anything(), ["null"]);
  });

  stringProperty("should always leave strings alone", async (str) => {
    await knex.insert({ value: str }).into("table");
    expect(querySpy).toHaveBeenCalledWith(expect.anything(), [str]);
  });

  numberProperty("should stringify numbers", async (num) => {
    await knex.insert({ value: num }).into("table");
    expect(querySpy).toHaveBeenCalledWith(expect.anything(), [num.toString()]);
  });
});
