import { knex } from "./knex";

interface User {
  id: number;
  name: string;
  age: number;
}

async function main() {
  return await knex<User>("users").where("id", 1).first();
}

main()
  .then(console.log)
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
