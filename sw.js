/* Service Worker da Barbearia Prieto — cobre as duas instalações do PWA
 * ----------------------------------------------------------------------
 * (1) instalação geral do site (manifest.json) e
 * (2) instalação exclusiva da Área Restrita (manifest-barbeiros.json).
 *
 * Único propósito: satisfazer o requisito técnico de instalabilidade
 * (o Chrome só considera um site/app instalável com um service worker
 * ativo). Registrado uma única vez, no carregamento da página — como as
 * duas instalações vivem no mesmo escopo "/", esse único SW serve pras
 * duas.
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
