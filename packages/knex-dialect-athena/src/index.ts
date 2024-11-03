import Knex from "knex";
import { AthenaConnection } from "./athena-connection";
import { AthenaClientConfig } from "@aws-sdk/client-athena";
// Fixes "non-portable" issue with PNPM
import type {} from "tarn";
import { assert } from "./assert";

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noOp = () => {};

export function createAthenaDialect(
  options: AthenaClientConfig & {
    database: string;
    outputLocation: string;
  },
): typeof Knex.Knex.Client {
  return class Client_Athena extends Knex.Client {
    dialect = "athena";
    driverName = "athena";

    // TODO: add query cancelling behavior
    canCancelQuery = false;

    acquireConnection() {
      return new AthenaConnection(options);
    }

    releaseConnection = noOp;

    async _query(
      connection: AthenaConnection,
      obj: Knex.Knex.Sql & { response: unknown[] },
    ) {
      if (!obj.sql) throw new Error("The query is empty");

      const response = await connection.query(
        obj.sql,
        // TODO: actually map non-basic elements correctly
        (obj.bindings as unknown[]).map((value) => value?.toString() ?? ""),
      );

      obj.response = response;
      return obj;
    }

    _processRow(row: Record<string, string | null>) {
      const result: Record<string, unknown> = {};
      for (const key of Object.getOwnPropertyNames(row)) {
        const value = row[key];

        if (value === undefined) continue;

        if (value === null) {
          result[key] = null;
          continue;
        }

        const parsedAsNumber = Number(value);
        if (value && !Number.isNaN(parsedAsNumber)) {
          result[key] = parsedAsNumber;
          continue;
        }

        if (["true", "false"].includes(value.toLowerCase())) {
          result[key] = value.toLowerCase() === "true";
          continue;
        }

        result[key] = value;
      }
      return result;
    }

    processResponse(
      obj: Knex.Knex.Sql & {
        response: Record<string, string>[];
        pluck?: string;
      },
    ) {
      if (obj.method === "raw") return obj.response;
      if (obj.method === "first") {
        if (!obj.response[0])
          throw new Error("Called `.first` but no rows were returned");
        return this._processRow(obj.response[0]);
      }

      if (obj.method === "pluck")
        return obj.response.map((row) => {
          assert(!!obj.pluck, obj);
          return this._processRow(row)[obj.pluck];
        });

      return obj.response.map((row) => this._processRow(row));
    }
  };
}
