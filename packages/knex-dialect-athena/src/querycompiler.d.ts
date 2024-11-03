declare module "knex/lib/query/querycompiler" {
  export default class QueryCompiler {
    constructor(
      client: import("knex").Knex.Client,
      builder: import("knex").QueryBuilder,
      bindings: unknown[],
    );

    grouped: { union?: { wrap: boolean }[] };
    onlyUnions(): boolean;
    with(): string;
    comments(self: this): string;
    columns(self: this): string;
    join(self: this): string;
    where(self: this): string;
    union(self: this): string;
    group(self: this): string;
    having(self: this): string;
    order(self: this): string;
    limit(self: this): string;
    offset(self: this): string;
    lock(self: this): string;
    waitMode(self: this): string;
  }
}
