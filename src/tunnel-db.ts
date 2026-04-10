import dotenv from 'dotenv';
dotenv.config();

import ngrok from 'ngrok';

// Expose local Postgres and/or MySQL via ngrok TCP tunnels
// so Papermap cloud can connect to your local databases.
//
// Usage:
//   npm run tunnel:db              # both (requires paid ngrok)
//   npm run tunnel:db -- postgres  # Postgres only (free tier OK)
//   npm run tunnel:db -- mysql     # MySQL only   (free tier OK)
//   npm run tunnel:postgres        # shortcut for Postgres only
//   npm run tunnel:mysql           # shortcut for MySQL only

const POSTGRES_PORT = 5433; // host port mapped in docker-compose
const MYSQL_PORT = 3306;

type Target = 'postgres' | 'mysql' | 'both';

function getTarget(): Target {
  const arg = process.argv[2]?.toLowerCase();
  if (arg === 'postgres' || arg === 'pg') return 'postgres';
  if (arg === 'mysql' || arg === 'sql') return 'mysql';
  if (arg === 'both' || !arg) return 'both';
  console.error(`Unknown target "${arg}". Use: postgres, mysql, or both`);
  process.exit(1);
}

const parseNgrok = (url: string) => url.replace('tcp://', '');

(async () => {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.error('NGROK_AUTH_TOKEN not set in .env');
    process.exit(1);
  }

  await ngrok.authtoken(process.env.NGROK_AUTH_TOKEN);

  const target = getTarget();

  console.log('\nngrok DB tunnel(s) starting...');
  console.log('─'.repeat(60));

  if (target === 'postgres' || target === 'both') {
    const pgUrl = await ngrok.connect({ proto: 'tcp', addr: POSTGRES_PORT });
    const pgHostPort = parseNgrok(pgUrl);
    console.log('\n  PostgreSQL:');
    console.log(`    ngrok URL  : ${pgUrl}`);
    console.log(`    Host:Port  : ${pgHostPort}`);
    console.log(`    Connection : postgresql://minibank:minibank_dev@${pgHostPort}/minibank`);
  }

  if (target === 'mysql' || target === 'both') {
    const mysqlUrl = await ngrok.connect({ proto: 'tcp', addr: MYSQL_PORT });
    const mysqlHostPort = parseNgrok(mysqlUrl);
    console.log('\n  MySQL:');
    console.log(`    ngrok URL  : ${mysqlUrl}`);
    console.log(`    Host:Port  : ${mysqlHostPort}`);
    console.log(`    Connection : mysql://minibank:minibank_dev@${mysqlHostPort}/minibank`);
  }

  console.log('\n  Use these connection strings when creating Papermap workspaces.');
  console.log('  Ctrl+C to stop tunnel(s)\n');
})();
