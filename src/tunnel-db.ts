import dotenv from 'dotenv';
dotenv.config();

import ngrok from 'ngrok';

// Expose local Postgres (5432) and MySQL (3306) via ngrok TCP tunnels
// so Papermap cloud can connect to your local databases.
//
// Usage: npm run tunnel:db
// Then copy the printed hosts into your Papermap workspace connection strings.

(async () => {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.error('NGROK_AUTH_TOKEN not set in .env');
    process.exit(1);
  }

  await ngrok.authtoken(process.env.NGROK_AUTH_TOKEN);

  const [pgUrl, mysqlUrl] = await Promise.all([
    ngrok.connect({ proto: 'tcp', addr: 5432 }),
    ngrok.connect({ proto: 'tcp', addr: 3306 }),
  ]);

  // Parse host:port from tcp://X.tcp.ngrok.io:PORT
  const parseNgrok = (url: string) => url.replace('tcp://', '');
  const pgHostPort = parseNgrok(pgUrl);
  const mysqlHostPort = parseNgrok(mysqlUrl);

  console.log('\nngrok DB tunnels active:');
  console.log('─'.repeat(60));
  console.log('\n  PostgreSQL:');
  console.log(`    ngrok URL  : ${pgUrl}`);
  console.log(`    Connection : postgresql://minibank:minibank_dev@${pgHostPort}/minibank`);
  console.log('\n  MySQL:');
  console.log(`    ngrok URL  : ${mysqlUrl}`);
  console.log(`    Connection : mysql://minibank:minibank_dev@${mysqlHostPort}/minibank`);
  console.log('\n  Use these connection strings when creating Papermap workspaces.');
  console.log('  Ctrl+C to stop tunnels\n');
})();
