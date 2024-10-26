# knex-dialect-athena demo

To run the demo:

1. Be authenticated with AWS for your current shell session (i.e. logged in to the CLI, and with the proper MFA if you have it set up)
2. Setup a `.env.local` file (which will be ignored by git) with the `DATABASE` and `OUTPUT_LOCATION` environment variables set to the relevant values for the Athena database you want to run the demo on.
3. Edit `src/index.ts` to fit whatever database you want to run the demo on.
4. Run `pnpm install && turbo build` in this directory, if you haven't installed and built yet.
5. Run `node dist/index.js` and enjoy seeing the results!
