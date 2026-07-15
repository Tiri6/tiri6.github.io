// Genera il file /ads.txt richiesto da Google AdSense per la verifica
// dell'editore. Si attiva da solo quando in data/ads.json c'è il client ID.
import type { APIRoute } from 'astro';
import ads from '../../data/ads.json';

export const GET: APIRoute = () => {
  if (!ads.adsenseClient) {
    return new Response('# AdSense non ancora configurato\n', {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  const pub = ads.adsenseClient.replace('ca-', ''); // ca-pub-123 → pub-123
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'Content-Type': 'text/plain' },
  });
};
