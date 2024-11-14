import {
  AthenaClient,
  AthenaClientConfig,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  QueryExecution,
  QueryExecutionState,
  ResultSet,
  StartQueryExecutionCommand,
} from "@aws-sdk/client-athena";
import { assert } from "./assert";
import { packageDebug } from "./debug";

const debug = packageDebug.extend("connection");

export interface AthenaConnectionConfig extends AthenaClientConfig {
  database: string;
  outputLocation: string;
  workGroup?: string;
  maxTimeoutMilliseconds?: number;
}

export class AthenaConnection {
  private readonly client: AthenaClient;
  private readonly database: string;
  private readonly outputLocation: string;
  private readonly workGroup?: string;
  private readonly maxTimeoutMilliseconds: number;

  constructor({
    database,
    outputLocation,
    workGroup,
    maxTimeoutMilliseconds,
    ...config
  }: AthenaConnectionConfig) {
    this.client = new AthenaClient(config);
    this.database = database;
    this.outputLocation = outputLocation;
    this.workGroup = workGroup;
    this.maxTimeoutMilliseconds = maxTimeoutMilliseconds ?? 30_000;
  }

  // Athena Commands

  private startQueryExecutionCommand(
    queryString: string,
    parameters: string[],
  ) {
    return new StartQueryExecutionCommand({
      QueryString: queryString,
      ExecutionParameters: parameters.length <= 0 ? undefined : parameters,
      QueryExecutionContext: {
        Database: this.database,
      },
      WorkGroup: this.workGroup,
      ResultConfiguration: {
        OutputLocation: this.outputLocation,
      },
    });
  }

  private getQueryExecutionCommand(queryExecutionId: string) {
    return new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId,
    });
  }

  private getQueryResultsCommand(queryExecutionId: string) {
    return new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
    });
  }

  // Query execution waiting logic

  private isQueryExecutionUnfinished(queryExecution: QueryExecution) {
    return (
      !queryExecution.Status?.State ||
      queryExecution.Status.State === QueryExecutionState.QUEUED ||
      queryExecution.Status.State === QueryExecutionState.RUNNING
    );
  }

  private async waitForQueryExecution(queryExecutionId: string) {
    debug("starting wait for query execution (id %s)", queryExecutionId);

    const backoffStepMilliseconds = 250;

    let overallTimeElapsedMilliseconds = 0;
    let retryInMilliseconds = 0;
    let queryExecution: QueryExecution;
    do {
      if (overallTimeElapsedMilliseconds < this.maxTimeoutMilliseconds) {
        retryInMilliseconds += backoffStepMilliseconds;
        overallTimeElapsedMilliseconds += retryInMilliseconds;
      }
      debug("waiting for %dms (id %s)", retryInMilliseconds, queryExecutionId);
      await new Promise((resolve) => setTimeout(resolve, retryInMilliseconds));
      const executionResponse = await this.client.send(
        this.getQueryExecutionCommand(queryExecutionId),
      );
      debug(
        "query execution state (id %s): %o",
        queryExecutionId,
        executionResponse.QueryExecution?.Status?.State,
      );

      assert(
        !!executionResponse.QueryExecution,
        executionResponse,
        "missing QueryExecution",
      );
      queryExecution = executionResponse.QueryExecution;
    } while (this.isQueryExecutionUnfinished(queryExecution));

    assert(
      !this.isQueryExecutionUnfinished(queryExecution),
      queryExecution,
      `query did not finish in ${this.maxTimeoutMilliseconds.toString()}ms`,
    );

    return queryExecution;
  }

  // Mapping query results

  private mapQueryResults<T extends Record<string, unknown>>(
    resultSet: ResultSet,
  ) {
    debug("mapping over result set: %o", resultSet);

    assert(!!resultSet.Rows, resultSet, "missing Rows");

    const columns = resultSet.ResultSetMetadata?.ColumnInfo;
    assert(!!columns, resultSet.ResultSetMetadata, "missing column specifiers");

    debug("using columns: %o", columns);

    return resultSet.Rows.slice(1).map((row) => {
      const result: Record<string, unknown> = {};

      let index = 0;
      for (const column of columns) {
        const datum = row.Data?.[index++]?.VarCharValue ?? null;

        assert(!!column.Name, column, "missing Name");

        // See:
        // - https://docs.aws.amazon.com/athena/latest/ug/data-types-examples.html
        // - https://docs.aws.amazon.com/athena/latest/ug/data-types.html
        // TODO: figure out what to do for date-related types
        switch (column.Type) {
          case "boolean":
            result[column.Name] = datum === null ? datum : datum === "true";
            break;
          case "tinyint":
          case "smallint":
          case "integer":
          case "int":
          case "bigint":
            result[column.Name] = datum === null ? datum : parseInt(datum);
            break;
          case "real":
          case "double":
          case "decimal":
            result[column.Name] = datum === null ? datum : parseFloat(datum);
            break;
          case "json":
            result[column.Name] = datum === null ? datum : JSON.parse(datum);
            break;
          case "varbinary":
            result[column.Name] =
              datum === null
                ? datum
                : new Uint8Array(
                    datum.split(" ").map((byte) => parseInt(byte, 16)),
                  );
            break;
          default:
            result[column.Name] = datum;
            break;
        }
      }
      return result as T;
    });
  }

  // Public API

  async query<T extends Record<string, unknown>>(
    queryString: string,
    parameters: string[] = [],
  ) {
    debug("starting query execution");
    debug("query: %o", queryString);
    debug("parameters: %o", parameters);

    const startQueryExecutionResponse = await this.client.send(
      this.startQueryExecutionCommand(queryString, parameters),
    );
    debug(
      "got start query execution response: %o",
      startQueryExecutionResponse,
    );
    assert(
      !!startQueryExecutionResponse.QueryExecutionId,
      startQueryExecutionResponse,
      "missing QueryExecutionId",
    );

    const queryExecution = await this.waitForQueryExecution(
      startQueryExecutionResponse.QueryExecutionId,
    );
    debug(
      "final query execution state (id %s): %o",
      startQueryExecutionResponse.QueryExecutionId,
      queryExecution.Status?.State,
    );
    assert(
      queryExecution.Status?.State === QueryExecutionState.SUCCEEDED,
      queryExecution,
      "query failed",
    );

    const resultsResponse = await this.client.send(
      this.getQueryResultsCommand(startQueryExecutionResponse.QueryExecutionId),
    );
    debug("got full results response: %o", resultsResponse);

    if (!resultsResponse.ResultSet?.Rows?.[0]) {
      debug("no rows (or column specifiers); returning update count");
      return resultsResponse.UpdateCount;
    }

    const results = this.mapQueryResults<T>(resultsResponse.ResultSet);
    debug("mapped results: %o", results);
    return results;
  }
}
