// this should be here by default
this.caches = new CacheList();


caches.set('core', new Cache('core',
  '/sprite-cow-navcontroller/',
  '/sprite-cow-navcontroller/static/js/all.js',
  '/sprite-cow-navcontroller/static/css/all.css',
  '/sprite-cow-navcontroller/static/css/fonts/oswald.ttf',
  '/sprite-cow-navcontroller/static/css/imgs/sprites1.png',
  '/sprite-cow-navcontroller/static/tutorial-sprite.png',
  '/sprite-cow-navcontroller/static/favicon.ico'
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