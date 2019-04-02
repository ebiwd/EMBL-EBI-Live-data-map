# EMBL-EBI-Live-data-map
The EMBL-EBI Live Data Map shows utilisation of various services.

[View the map](https://www.ebi.ac.uk/web/livemap)

For usage guidance, view the source of https://www.ebi.ac.uk/web/livemap/live-data-map.html

## Developing locally?

There are two aspects to the map, the web interface (HTML, CSS, JS) and the backend
processing of the requests to EBI data resources (PHP).

To develop the latter, you'll need not only PHP but also be on the EBI network.

With that in mind there are two development scenarios.

1. You're on the EBI network and have PHP:
  - `php -S localhost:8000`
  - open `http://localhost:8000/live-data-map.html`
2. You're outside the EBI network and only want to develop the web interface
  - You won't see any live data, but you'll be able to test the map and query paramaters
  - You'll be [using Browsersync](https://www.browsersync.io/#install):
  - `npm install -g browser-sync`
  - `browser-sync start --server --index live-data-map.html --port 5000`
  - `node localDevelopment.js`
