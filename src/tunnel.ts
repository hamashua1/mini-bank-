import dotenv from 'dotenv';
dotenv.config();

import ngrok from 'ngrok';

const PORT = Number(process.env.PORT ?? 3000);

(async () => {
  if (!process.env.NGROK_AUTH_TOKEN) {
    console.error('NGROK_AUTH_TOKEN not set. Get your token at https://dashboard.ngrok.com/get-started/your-authtoken');
    process.exit(1);
  }

  await ngrok.authtoken(process.env.NGROK_AUTH_TOKEN);
  const url = await ngrok.connect(PORT);

  console.log('\nngrok tunnel active:');
  console.log(`  Public URL : ${url}`);
  console.log(`  Local      : http://localhost:${PORT}`);
  console.log(`\nPaste this URL into Papermap cloud workspace settings: ${url}`);
  console.log('\nCtrl+C to stop the tunnel\n');
})();
