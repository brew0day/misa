const express = require('express');
const KillBot = require('killbot.to');

const app = express();

// Remplacez par votre véritable clé API et configuration pour KillBot.to
const apiKey = '225e7b97-524c-45d6-800c-aa7e3831a1ab';
const config = 'default';
const killBot = new KillBot(apiKey, config);

app.get('/', (req, res) => {
  // Vérifie la requête avec KillBot
  killBot.checkReq(req)
    .then(result => {
      if (result.block) {
        // Si le visiteur est bloqué, renvoyer une page HTML de type "404 Not Found"
        const html = `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html>
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>Not Found</h1>
    <p>The requested URL ${req.originalUrl} was not found on this server.</p>
    <hr>
    <address>Apache/2.4.57 (Debian) Server at ${req.hostname} Port 80</address>
  </body>
</html>`;
        res.status(404).send(html);
      } else {
        // Si le visiteur est valide, le rediriger vers Google
        res.redirect('https://google.com');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send("Internal Server Error");
    });
});

app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
