Railway deployment notes for Gorille bot

1) Create a new Railway project
- Go to https://railway.app and create a new project.

2) Add a PostgreSQL plugin (Managed PostgreSQL)
- In Railway project -> "New Plugin" -> Postgres.
- Wait for the database to be created; Railway provides a `DATABASE_URL`.

3) Add environment variables
- In the Railway project -> Settings -> Variables, add:
  - `DISCORD_TOKEN` = <your bot token>
  - `DISCORD_CLIENT_ID` = <your application client id>
  - `DATABASE_URL` = <value provided by Railway Postgres plugin>
  - `DB_SSL` = `true` (if Railway Postgres requires SSL; safe to set true)

4) Build & Start
- Railway will run `npm install` then `npm start` by default.
- Ensure `package.json` has the `start` script (`node src/index.js`) — it does.

5) Persistence & Migrations
- On first startup the bot will create necessary tables automatically (see `src/utils/postgres.js`).
- No extra migration step is required for initial deploy.

6) Notes & tips
- Keep `DISCORD_TOKEN` secret; never commit it to the repo.
- If you want global slash commands instead of guild-scoped, change registration method in `src/index.js`.
- If you add the web API (`apps/api`), deploy it separately or as subservice and set `API_URL` env var.

7) Troubleshooting
- If the bot fails to connect to DB, check Railway's `DATABASE_URL` and set `DB_SSL=true`.
- To view logs: Railway project -> Logs.

That's it — once your Railway env vars are set the bot will persist saved players and other data across deployments automatically.