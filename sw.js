const CACHE_NAME = 'okome-game-v2.1.0';

// GitHub Pages向けの設定 - リポジトリ名を含むパス
const isGitHubPages = location.hostname.includes('github.io');
const basePath = isGitHubPages ? '/okome-game' : '';

const urlsToCache = [
  `${basePath}/`,
  `${basePath}/index.html`,
  `${basePath}/style.css`,
  `${basePath}/game.js`,
  `${basePath}/manifest.json`,
  `${basePath}/favicon.ico`,
  `${basePath}/image/okome1.png`,
  `${basePath}/image/okome2.png`,
  `${basePath}/image/okome3.png`,
  `${basePath}/image/okome4.png`,
  `${basePath}/image/okome5.png`,
  `${basePath}/image/okome6.png`,
  `${basePath}/image/okome7.png`,
  `${basePath}/image/okome8.png`,
  `${basePath}/image/okome9.png`,
  `${basePath}/image/okome10.png`,
  `${basePath}/image/okome11.png`,
  `${basePath}/icons/icon-57.png`,
  `${basePath}/icons/icon-72.png`,
  `${basePath}/icons/icon-114.png`,
  `${basePath}/icons/icon-144.png`,
  `${basePath}/icons/icon-192.png`,
  `${basePath}/icons/icon-512.png`,
  `${basePath}/sound/okomebgm.mp3`,
  `${basePath}/sound/okomebgm2.mp3`,
  `${basePath}/sound/okomebgm3.mp3`,
  'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js'
];

// Install event - キャッシュを作成
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Failed to cache resources:', error);
      })
  );
});

// Activate event - 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - キャッシュファーストストラテジー（パフォーマンス最適化）
self.addEventListener('fetch', (event) => {
  // パフォーマンス最適化: 特定のURLを除外
  const url = new URL(event.request.url);
  
  // クロスオリジンのCDNリクエストの特別処理
  if (url.origin !== location.origin && !url.hostname.includes('cdnjs.cloudflare.com')) {
    return; // キャッシュ対象外
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュヒット時は即座に返す
        if (response) {
          // バックグラウンドでキャッシュ更新をチェック（stale-while-revalidate）
          if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
            fetch(event.request).then((freshResponse) => {
              if (freshResponse && freshResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, freshResponse);
                });
              }
            }).catch(() => {/* エラーを無視 */});
          }
          return response;
        }
        
        // ネットワークから取得
        return fetch(event.request)
          .then((response) => {
            // 無効なレスポンスの場合
            if (!response || response.status !== 200 || 
                (response.type !== 'basic' && response.type !== 'cors')) {
              return response;
            }
            
            // キャッシュすべきリソースのみ保存
            const shouldCache = url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|html)$/i) ||
                               url.pathname === '/' || url.pathname === '/index.html';
            
            if (shouldCache) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                })
                .catch(() => {/* キャッシュエラーを無視 */});
            }
            
            return response;
          })
          .catch(() => {
            // オフライン時のフォールバック（GitHub Pages対応）
            if (event.request.destination === 'document') {
              return caches.match(`${basePath}/index.html`) || caches.match(`${basePath}/`);
            }
            // 画像リソースのフォールバック
            if (event.request.destination === 'image') {
              return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#f0f0f0"/></svg>', {
                headers: { 'Content-Type': 'image/svg+xml' }
              });
            }
          });
      })
  );
});

// アプリ更新通知
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// バックグラウンド同期（将来の機能拡張用）
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered');
  }
});

// プッシュ通知（将来の機能拡張用）
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// 通知クリック処理
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received.');
  
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});