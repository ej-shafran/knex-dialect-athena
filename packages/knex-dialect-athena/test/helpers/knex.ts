import Knex from "knex";
import { createAthenaDialect } from "../../src";

export const fakeAthenaKnex = () =>
  Knex({
    client: createAthenaDialect({
      database: "",
      outputLocation: "",
    }),
  });
