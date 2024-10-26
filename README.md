# knex-dialect-athena

A [Knex](https://knexjs.org/) dialect for [AWS Athena](https://docs.aws.amazon.com/athena).

## Installation

Using your favorite package manager, install `knex-dialect-athena`:

```bash
npm install knex-dialect-athena
```

## Usage

This package exports the `createAthenaDialect` function, the result of which can be passed to `knex`'s `client` option:

```ts
import Knex from "knex";
import { createAthenaDialect } from "knex-dialect-athena";

const knex = Knex({
  client: createAthenaDialect({
    database: "my-database-name",
    outputLocation: "s3://my/output/location",
    // Additional `AthenaClient` options can go here:
    // region: "..."
  }),
});

interface User {
  id: number;
  name: string;
  age: number;
}

// Retrieves the data from the provided Athena database
const user = await knex<User>("users").where("id", 1).first();
```
