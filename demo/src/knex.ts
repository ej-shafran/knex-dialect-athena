import dotenv from "dotenv";
import Knex from "knex";
import { createAthenaDialect } from "knex-dialect-athena";

const result = dotenv.config({ path: ".env.local" });

if (result.error) {
  throw result.error;
}

const database = process.env.DATABASE;
if (!database) {
  throw new Error(
    "missing required environment variable `DATABASE`; please see the README",
  );
}

const outputLocation = process.env.OUTPUT_LOCATION;
if (!outputLocation) {
  throw new Error(
    "missing required environment variable `OUTPUT_LOCATION`; please see the README",
  );
}

export const knex = Knex({
  client: createAthenaDialect({
    database,
    outputLocation,
    region: process.env.AWS_REGION,
  }),
});
