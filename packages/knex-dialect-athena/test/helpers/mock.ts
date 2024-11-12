import nock from "nock";
import {
  GetQueryExecutionCommandOutput,
  GetQueryResultsCommandOutput,
  ResultSet,
  StartQueryExecutionCommandOutput,
} from "@aws-sdk/client-athena";

// Create fake AWS credentials so the credential provider does not error
process.env.AWS_ACCESS_KEY_ID = crypto.randomUUID();
process.env.AWS_SECRET_ACCESS_KEY = crypto.randomUUID();
process.env.AWS_REGION = crypto.randomUUID();

export const mockAthenaSelectingQuery = (resultSet: ResultSet) =>
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

export const mockAthenaUpdatingQuery = (updateCount: number) =>
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
