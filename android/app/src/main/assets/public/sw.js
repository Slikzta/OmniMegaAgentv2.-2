/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "index.html",
    "revision": "9c83d79e7ebf45c27c6bcafc756b875d"
  }, {
    "url": "assets/web-DxrYcmLm.js",
    "revision": null
  }, {
    "url": "assets/index-D9PxJ7KV.js",
    "revision": null
  }, {
    "url": "assets/index-B-meSCeG.css",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "e5adad2b8125e18885e2bb0950668163"
  }, {
    "url": "favicon.ico",
    "revision": "41634877277565a7fc11a1bd35795144"
  }, {
    "url": "icon.svg",
    "revision": "a372450dfeb24e8781d9a60c8ea25002"
  }, {
    "url": "pwa-192x192.png",
    "revision": "fca29532114e8dd6fd9177b077d8b003"
  }, {
    "url": "pwa-512x512.png",
    "revision": "d85fb83da7127d837906915ce756fcad"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "8e140b8d497b2bf7a8efd2ded447fa61"
  }, {
    "url": "manifest.webmanifest",
    "revision": "77db985471fa103ff737751e28660ff2"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
