// Credit to https://gist.github.com/Yaffle/1088850

/*jslint regexp: true, white: true, maxerr: 50, indent: 2 */

function parseURI(url) {
  var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
  // authority = '//' + user + ':' + pass '@' + hostname + ':' port
  return (m ? {
    href     : m[0] || '',
    protocol : m[1] || '',
    authority: m[2] || '',
    host     : m[3] || '',
    hostname : m[4] || '',
    port     : m[5] || '',
    pathname : m[6] || '',
    search   : m[7] || '',
    hash     : m[8] || ''
  } : null);
}

function absolutizeURI(base, href) {// RFC 3986

  function removeDotSegments(input) {
    var output = [];
    input.replace(/^(\.\.?(\/|$))+/, '')
         .replace(/\/(\.(\/|$))+/g, '/')
         .replace(/\/\.\.$/, '/../')
         .replace(/\/?[^\/]*/g, function (p) {
      if (p === '/..') {
        output.pop();
      } else {
        output.push(p);
      }
    });
    return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
  }

  href = parseURI(href || '');
  base = parseURI(base || '');

  return !href || !base ? null : (href.protocol || base.protocol) +
         (href.protocol || href.authority ? href.authority : base.authority) +
         removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
         (href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
         href.hash;
}
;
// Polyfill for networkFetch() API. Does not handle cross-origin
// requests, because it uses XHR to emulate.
if (!('SameOriginResponse' in this))
    SameOriginResponse = function() { };

function networkFetch(urlOrRequest) {
    return new Promise(function(resolver) {
        var url;
        var method = 'GET';
        var body;
        if (typeof urlOrRequest == "string") {
            url = urlOrRequest;
        } else {
            url = urlOrRequest.url;
            method = urlOrRequest.method || method;
            body = urlOrRequest.body;
        }
        var xhr = new XMLHttpRequest();
        xhr.responseType = "arraybuffer";
        xhr.open(method, url, true);
        if (body)
            xhr.send(body);
        else
            xhr.send();
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                try {
                    var response = new SameOriginResponse();
                    // need to .reject based on statusCode?
                    response.statusCode = xhr.status;
                    response.statusText = xhr.statusText;
                    response.encoding = '';
                    response.method = method;

                    var headers = xhr.getAllResponseHeaders().split('\n'); //probably should be a dict?
                    response.headers = [];
                    for (var i = 0; i < headers.length; ++i) {
                        if (!headers[i])
                            continue;
                        var kv = headers[i].split(':');
                        if (kv && kv.length > 1) {
                            if ('setHeader' in response)
                                response.setHeader(kv[0], kv[1].slice(1).trim());
                            response.headers.push([kv[0], kv[1].slice(1).trim()]);
                        }
                    }
                    response.body = xhr.response;
                    if ('setBody' in response)
                        response.setBody(createBlob(xhr.response, xhr.getResponseHeader('content-type')));
                    resolver.fulfill(response);
                } catch (e) {
                    resolver.reject(e);
                }
            }
        };
    });
}

function createBlob(msg, type) {
    type = type ? type : "text/plain";
    return new Blob([msg], {"type" : type});
}

;

if (!('Request' in this))
    Request = function() {};


function CacheList() {
    this.caches = {};
}

CacheList.prototype._getCache = function(cache_name) {
    if (!(cache_name in this.caches))
        this.caches[cache_name] = new Cache(cache_name);
    return this.caches[cache_name];
};

CacheList.prototype.forEach = function(callback) {
    for (var name in this.caches) {
        callback(name, this.caches[name], this);
    }
};

CacheList.prototype.delete = function(name) {
    if (name in this.caches)
        delete this.caches.name;
};

CacheList.prototype.match = function(cache_name, url) {
    return this._getCache(cache_name).match(url);
};

CacheList.prototype.get = function(cache_name) {
    return this._getCache(cache_name);
};

CacheList.prototype.set = function(cache_name, cache) {
    if (cache.name != cache_name)
        throw "Cache names must match [polyfill restriction]";
    if (cache_name in this.caches &&
        this.caches[cache_name] !== cache)
        throw "Already have a cache named '" + cache_name + "'";

    this.caches[cache_name] = cache;
    return cache;
};

// translates a string or a request object into an object with a .url
// property
function _getRequest(urlOrRequest) {
    if (urlOrRequest.url) {
        urlOrRequest.url = absolutizeURI(location.toString(), urlOrRequest.url);
        return urlOrRequest;
    }
    var request = new SameOriginResponse();
    request.url = absolutizeURI(location.toString(), urlOrRequest);
    request.method = 'GET';
    return request;
}

// This differs slightly from the the explainer, in that the 'name' is
// passed as the first parameter - vastly simplified the implementation.
function Cache(name /*, url, url, ...*/) {
    var cache = this;
    var requestsOrUrls = Array.prototype.slice.call(arguments, 1);
    this.name = name;

    // These are promises we want to resolve before any future cache action.
    var pending = [];
    this.readyPromise = this._open().then(function(cache) {
        return cache._add(requestsOrUrls).then(function(addresults) {
            return addresults;
        });
    }).then(function(results) {
        // throw away the pending promises
        return cache;
    }).catch(function(e) {
        lasterr = e;
    });
}

// TODO - a basic cache consistency thing needs to be exposed here,
// since our promises may include network requests that may result in our gets/puts
// being executed slightly out of order from IDB itself.
//
// Consider:
// p1 = cache.add("http://google.com/");
// p2 = cache.match("http://google.com/");
//
// The add step may actually mean:
// networkFetch("http://google.com/").then(saveToIDB)
//
// But I think the effect we want is that p2 resolves after p1, which
// is how IDB works. Not sure.
//
// If this is how it should be implemented, then all outstanding
// requests need to be (functionally, if not actually) resolved before
// resolution of the next promise.
//
// Here is what needs to happen to make that work:
//
// 1) every time this api creats a new promise to write, it needs to
//    add it to a 'pending' list on Cache.
//
// 2) The first thing that such a promise needs to do when resolved is clear
//    itself from the pending promises list.
//
// 3) Every time ready() is called, we snapshot the outstanding
//    promises, and call Q.all() on them, probably returning that
//    here.
//
// [1] because promises are resolved with a separate resolver function, resolution doesn't technically even need to run until the first person calls then(), so
Cache.prototype.ready = function() {
    return this.readyPromise;
};

Cache.prototype._open = function () {
    var cache = this;
    if (!cache.db) {
        cache.db = new Promise(function(resolver) {
            var openReq = indexedDB.open("cache-" + cache.name, 1);
            openReq.onupgradeneeded = function(e) {
                var db = e.target.result;
                db.createObjectStore(cache.name);
            };
            openReq.onsuccess = function(e) {
                var db = cache.db = e.target.result;
                resolver.resolve(cache);
            };
            openReq.onerror = function(e) {
                resolver.reject("Error opening " + cache.name + ": " + e.name);
            };
        });
    }
    return cache.db;
};


// _get and _set are generic wrappers around idb, that assume the db is open and ready.
Cache.prototype._get = function(url) {
    var cache = this;
    url = _getRequest(url).url;
    return new Promise(function(resolver) {
        try {
            var req = cache.db.transaction(cache.name)
                    .objectStore(cache.name).get(url);
        } catch(ex) {
            resolver.reject("Couldn't load url '" + url + "': " + ex);
        }
        req.onsuccess = function(e) {
            if (!e.target.result) {
                resolver.reject("URL not found: " + url);
                return;
            }
            var result = {
                request: e.target.result.request,
                response: cache._makeResponse(e.target.result.response)
            };
            resolver.resolve(result);
        };
        req.onerror = function(e) {
            resolver.reject("Error in _get for " + url + ": " + e.name);
        };
    });
};

Cache.prototype._set = function(key, value) {
    var cache = this;
    return new Promise(function(resolver) {
        var req = cache.db.transaction(cache.name, 'readwrite')
                .objectStore(cache.name).put(value, key);
        req.onsuccess = function(e) {
            resolver.resolve(e.target.result);
        };
        req.onerror = function(e) {
            resolver.reject("Error in _get for " + key + ": " + e.name);
        };
    });
};

Cache.prototype._getKeys = function() {
    var cache = this;
    return new Promise(function(resolver) {
        var req = cache.db.transaction(cache.name)
                .objectStore(cache.name).openCursor();
        var resultkeys = [];
        req.onsuccess = function(e) {
            var cursor = e.target.result;
            if (cursor == null) {
                resolver.resolve(resultkeys);
                return;
            }
            resultkeys.push(cursor.key);
            cursor.continue();
        };
        req.onerror = function(e) {
            resolve.reject(e);
        };
    });
};

// Not sure what iteration looks like, so for now we just iterate here
Cache.prototype.getKeys = function() {
    return this.ready().then(function(cache) {
        return cache._getKeys();
    });
};

Cache.prototype._makeResponse = function (responseObj) {
    var response = new SameOriginResponse();
    for (var k in responseObj)
        response[k] = responseObj[k];
    var content_type;
    if ('setHeader' in response) {
        responseObj.headers.forEach(function(header) {
            if (header[0].toLowerCase() == 'content-type')
                content_type = header[1];
            response.setHeader(header[0], header[1]);
        });
    }
    if ('setBody' in response) {
        response.setBody(createBlob(response.body, content_type));
    }
    return response;
};

// Gives a response object suitable for passing to respondWith()
Cache.prototype.match = function(url) {
    var cache = this;
    return this.ready()
        .then(function(cache) {
            return cache._get(url);
        }).then(function(entry) {
            return entry.response;
        })
        .catch(function(ex) {
            var response = new SameOriginResponse();
            response.statusCode = 404;
            response.statusText = "Not Found: " + ex;
            lastex = ex;
            response.method = '';
            response.setBody("Not found in cache: " + ex, "text/plain");
            return response;
        });
};

// Gets the full entry, including a request and response object
Cache.prototype.get = function(url) {
    var cache = this;
    return this.ready()
        .then(function(cache) {
            return cache._get(url);
        });
};

// This returns a callback which binds the request to the response
Cache.prototype._setResponse = function(request) {
    var cache = this;
    var requestObj = {};
    for (var k in request) {
        if (typeof request[k] != 'function')
            requestObj[k] = request[k];
    }
    return function(response) {
        // the main object isn't clonable, but its subparts are
        var responseObj = {};
        for (var k in response) {
            if (typeof response[k] != 'function')
                responseObj[k] = response[k];
        }
        return cache._set(request.url,
                          { request: requestObj, response: responseObj });
    };
};

// Given a set of requests, fetch them and store them in the cache.
Cache.prototype._add = function(requests) {
    var pending = [];
    var cache = this;
    for (var i = 0; i < requests.length; ++i) {
        var request = _getRequest(requests[i]);
        pending.push(networkFetch(request.url)
                     .then(cache._setResponse(request)));
    }
    return Promise.every.apply(Promise, pending);
};

// Add one or more urls to the cache.
Cache.prototype.add = function(/* request, request, request, ...*/) {
    var requests = arguments;
    return this.ready().then(function(cache) {
        var result = cache._add(requests);
        if (requests.length == 1)
            return result[0];
        return result;
    });
};

Cache.prototype.addResponse = function(urlOrRequest, response) {
    var request = _getRequest(urlOrRequest);
    return this.ready().then(function(cache) {
        request = JSON.parse(JSON.stringify(request));
        response = JSON.parse(JSON.stringify(response));
        cache._set(request.url, { request: request, response: response });
    });
};

;
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