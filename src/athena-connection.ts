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

export class AthenaConnection {
  private readonly client: AthenaClient;
  private readonly database: string;
  private readonly outputLocation: string;
  private readonly workGroup?: string;

  constructor({
    database,
    outputLocation,
    workGroup,
    ...config
  }: AthenaClientConfig & {
    database: string;
    outputLocation: string;
    workGroup?: string;
  }) {
    this.client = new AthenaClient(config);
    this.database = database;
    this.outputLocation = outputLocation;
    this.workGroup = workGroup;
  }

  // Athena Commands

  private startQueryExecutionCommand(
    queryString: string,
    parameters: string[],
  ) {
    return new StartQueryExecutionCommand({
      QueryString: queryString,
      ExecutionParameters: parameters,
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
    // TODO: make configurable by constructor
    const maxWaitMilliseconds = 30_000;
    const backoffStepMilliseconds = 250;

    let overallTimeElapsedMilliseconds = 0;
    let retryInMilliseconds = 0;
    let queryExecution: QueryExecution;
    do {
      if (overallTimeElapsedMilliseconds < maxWaitMilliseconds) {
        retryInMilliseconds += backoffStepMilliseconds;
        overallTimeElapsedMilliseconds += retryInMilliseconds;
      }
      await new Promise((resolve) => setTimeout(resolve, retryInMilliseconds));
      const executionResponse = await this.client.send(
        this.getQueryExecutionCommand(queryExecutionId),
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
      `query did not finish in ${maxWaitMilliseconds.toString()}ms`,
    );

    return queryExecution;
  }

  // Mapping query results

  private mapQueryResults<T extends Record<string, string | null>>(
    resultSet: ResultSet,
  ) {
    assert(!!resultSet.Rows, resultSet, "missing Rows");

    const columns = resultSet.Rows[0]?.Data?.map(
      (datum) => datum.VarCharValue,
    ).filter((value): value is string => !!value);
    assert(!!columns, resultSet.Rows, "missing column specifiers");

    return resultSet.Rows.slice(1).map((row) => {
      const result: Record<string, string | null> = {};

      let index = 0;
      for (const column of columns) {
        const datum = row.Data?.[index++]?.VarCharValue ?? null;
        result[column] = datum;
      }
      return result as T;
    });
  }

  // Public API

  async query<T extends Record<string, string | null>>(
    queryString: string,
    parameters: string[] = [],
  ) {
    const startQueryExecutionResponse = await this.client.send(
      this.startQueryExecutionCommand(queryString, parameters),
    );
    assert(
      !!startQueryExecutionResponse.QueryExecutionId,
      startQueryExecutionResponse,
      "missing QueryExecutionId",
    );

    const queryExecution = await this.waitForQueryExecution(
      startQueryExecutionResponse.QueryExecutionId,
    );
    assert(
      queryExecution.Status?.State === QueryExecutionState.SUCCEEDED,
      queryExecution,
      "query failed",
    );

    const resultsResponse = await this.client.send(
      this.getQueryResultsCommand(startQueryExecutionResponse.QueryExecutionId),
    );
    assert(!!resultsResponse.ResultSet, resultsResponse, "missing ResultSet");

    return this.mapQueryResults<T>(resultsResponse.ResultSet);
  }
}
