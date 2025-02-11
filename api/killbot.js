import KillBot from 'killbot.to';

const apiKey = '225e7b97-524c-45d6-800c-aa7e3831a1ab'; // Remplace par TA clé API
const config = 'default'; // Ou un autre config si tu en as un
const killBot = new KillBot(apiKey, config);

export default async function handler(req, res) {
  try {
    const result = await killBot.checkReq(req);

    if (result.block) {
      // Si c'est un bot : renvoyer une page “404 Not Found” (factice)
      const fake404 = `
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>404 Not Found</title>
</head><body>
<h1>Not Found</h1>
<p>The requested URL was not found on this server.</p>
<hr>
<address>Apache/2.4.57 (Debian) Server at vercel.app Port 80</address>
</body></html>`;

      // Renvoyer un statut 404
      res.status(404).send(fake404);
    } else {
      // Si c'est un humain, on le redirige (ex. Google)
      res.writeHead(302, { Location: 'https://google.com' });
      res.end();
    }
  } catch (err) {
    console.error('KillBot error:', err);
    // En cas d'erreur, on peut renvoyer un 500
    res.status(500).send('Internal Server Error');
  }
}