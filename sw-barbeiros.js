/* Service Worker da Área Restrita dos Barbeiros (Barbearia Prieto)
 * --------------------------------------------------------------
 * Único propósito: satisfazer o requisito técnico de instalabilidade do
 * PWA (o Chrome só considera um site instalável com um service worker
 * ativo e um manifest válido).
 *
 * DE PROPÓSITO não faz cache de nada: login, sessão, agendamentos,
 * financeiro e relatórios sempre precisam vir da rede, nunca de uma cópia
 * antiga guardada no dispositivo. Por isso os eventos abaixo são só
 * passthrough puro — toda requisição vai direto pra rede, sem interceptar
 * nem guardar resposta em cache.
 */

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // passthrough: sempre busca na rede, nunca serve nem grava cache.
    event.respondWith(fetch(event.request));
});
