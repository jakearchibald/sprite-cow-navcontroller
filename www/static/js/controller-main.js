// this should be here by default
this.caches = new CacheList();


caches.set('core', new Cache('core',
  '/',
  '/static/js/all.js',
  '/static/css/all.css',
  '/static/css/fonts/oswald.ttf',
  '/static/css/imgs/sprites1.png',
  '/static/tutorial-sprite.png',
  '/static/favicon.ico'
));

this.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match('core', event.request.url).catch(function() {
      var response = new SameOriginResponse();
      response.setBody(
        new Blob(['Cache fetch failed'], {
          type: 'text/plain'
        })
      );
      return response;
    })
  );
});