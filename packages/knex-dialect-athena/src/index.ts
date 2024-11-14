import Knex from "knex";
import { AthenaConnection, AthenaConnectionConfig } from "./athena-connection";
import { QueryCompiler_Athena as QueryCompiler } from "./athena-querycompiler";
// Fixes "non-portable" issue with PNPM
import type {} from "tarn";
import { assert } from "./assert";

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noOp = () => {};

export function createAthenaDialect(
  config: AthenaConnectionConfig,
): typeof Knex.Knex.Client {
  return class Client_Athena extends Knex.Client {
    dialect = "athena";
    driverName = "athena";

    // TODO: add query cancelling behavior
    canCancelQuery = false;

    acquireConnection() {
      return new AthenaConnection(config);
    }

    releaseConnection = noOp;

    queryCompiler = ((builder: Knex.QueryBuilder, bindings: unknown[]) =>
      new QueryCompiler(
        this,
        builder,
        bindings,
      )) as Knex.Knex.Client["queryCompiler"];

    processBinding(binding: Knex.Knex.Value): string {
      if (binding === null) return "null";
      // TODO: figure out how to stringify dates
      if (binding instanceof Date)
        throw new Error("Date bindings are not (yet) supported");
      // TODO: figure out how to stringify arrays, and if we should even do it
      if (Array.isArray(binding))
        throw new Error("Array bindings are not supported");
      return String(binding);
    }

    async _query(
      connection: AthenaConnection,
      obj: Knex.Knex.Sql & { response: unknown },
    ) {
      if (!obj.sql) throw new Error("The query is empty");

      const response = await connection.query(
        obj.sql,
        obj.bindings.flatMap((binding) => this.processBinding(binding)),
      );

      obj.response = response;
      return obj;
    }

    processResponse(
      obj: Knex.Knex.Sql & {
        response: Record<string, unknown>[];
        pluck?: string;
      },
    ) {
      if (obj.method === "raw") return obj.response;
      if (obj.method === "first") {
        if (!obj.response[0])
          throw new Error("Called `.first` but no rows were returned");
        return obj.response[0];
      }

      if (obj.method === "pluck")
        return obj.response.map((row) => {
          assert(!!obj.pluck, obj);
          return row[obj.pluck];
        });

      return obj.response;
    }
  };
}
