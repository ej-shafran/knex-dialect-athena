import QueryCompiler from "knex/lib/query/querycompiler";
import compact from "lodash/compact";

const components = [
  "comments",
  "columns",
  "join",
  "where",
  "union",
  "group",
  "having",
  "order",
  "offset",
  "limit",
  // TODO: remove
  "lock",
  "waitMode",
] as const;

// NOTE:
// Copied from `knex/lib/query/querycompiler`;
// the `components` field is not editable, but the order of it needs to be changed to match Athena's syntax;
// thus, this code has been copied over
export class QueryCompiler_Athena extends QueryCompiler {
  // Compiles the `select` statement, or nested sub-selects by calling each of
  // the component compilers, trimming out the empties, and returning a
  // generated query string.
  select() {
    let sql = this.with();

    let unionStatement = "";

    const firstStatements = [] as string[];
    const endStatements = [] as string[];

    components.forEach((component) => {
      const statement = this[component](this);
      // We store the 'union' statement to append it at the end.
      // We still need to call the component sequentially because of
      // order of bindings.
      switch (component) {
        case "union":
          unionStatement = statement;
          break;
        case "comments":
        case "columns":
        case "join":
        case "where":
          firstStatements.push(statement);
          break;
        default:
          endStatements.push(statement);
          break;
      }
    });

    // Check if we need to wrap the main query.
    // We need to wrap main query if one of union have wrap options to true
    // to avoid error syntax (in PostgreSQL for example).
    const wrapMainQuery = this.grouped.union?.map((u) => u.wrap).some((u) => u);

    if (this.onlyUnions()) {
      const statements = compact(firstStatements.concat(endStatements)).join(
        " ",
      );
      sql += unionStatement + (statements ? " " + statements : "");
    } else {
      const allStatements =
        (wrapMainQuery ? "(" : "") +
        compact(firstStatements).join(" ") +
        (wrapMainQuery ? ")" : "");
      const endStat = compact(endStatements).join(" ");
      sql +=
        allStatements +
        (unionStatement ? " " + unionStatement : "") +
        (endStat ? " " + endStat : endStat);
    }
    return sql;
  }
}
