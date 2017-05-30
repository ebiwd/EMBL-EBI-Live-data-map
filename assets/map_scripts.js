// handy things:
// https://www.mapbox.com/mapbox.js/example/v1.0.0/markercluster-multiple-groups/
// https://github.com/Leaflet/Leaflet.markercluster#usage
// http://wwwdev.ebi.ac.uk/ebiwebtrafficmap/kmlvector.html

L.mapbox.accessToken = 'pk.eyJ1Ijoia2hhd2tpbnNlYmkiLCJhIjoiY2ludTZ2M3ltMDBtNXczbTJueW85ZmJjNyJ9.u6SIfnrYvGe6WFP3fOtaVQ';

var map = L.mapbox.map('map');

// process passed params
// shows just one type or make types a distinct colour?
// options: unified, portals, uniprot, ebi, distinct
var passedParam = location.search.split('legend=')[1];
// does the user want to hide the legend?
var passedParamLegend = location.search.split('hideLegend=')[1];
if ((passedParamLegend != 'false') && (passedParamLegend != undefined)) {
  passedParamLegend = passedParamLegend.split('&')[0]; // drop anything after &
  $('.legend.modal').hide();
}
// throttle the display for older devices (like the south building monoliths)
var passedParamSlimClient = location.search.split('slimClient=')[1];
if ((passedParamSlimClient != undefined)) {
  // passedParamSlimClient = passedParamSlimClient.split('&')[0]; // drop anything after &
  var lifeSpan = 24000;
}
// debug metrics
var debug = false;
var passedParamDebugMetrics = location.search.split('debug=')[1];
if ((passedParamDebugMetrics != 'false') && (passedParamDebugMetrics != undefined)) {
  // passedParamDebugMetrics = passedParamSlimClient.split('&')[0]; // drop anything after &
  debug = true;
}

// show sunrise and sunset
// http://joergdietrich.github.io/Leaflet.Terminator/
var daynightoverlay = L.terminator({className:'daynightoverlay'});
map.setView([30, daynightoverlay.getLatLngs()[0][700]['lng']], 2);
// map.setView([30, 10], 3);
daynightoverlay.addTo(map);

setInterval(function(){updateTerminator(daynightoverlay)}, 12000);
function updateTerminator(t) {
  var t2 = L.terminator();
  t.setLatLngs(t2.getLatLngs());
  t.redraw();
}

L.tileLayer(
  'https://api.mapbox.com/styles/v1/khawkinsebi/cio2mav7q0018c2nk2vvg8xgt/tiles/{z}/{x}/{y}?access_token=' + L.mapbox.accessToken, {
      // maxZoom: 6,
      // minZoom: 3,
      tileSize: 512,
      zoomOffset: -1,
      attribution: '© <a href="//www.ebi.ac.uk/about">EMBL-EBI</a> © <a href="https://www.mapbox.com/map-feedback/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

map.options.maxZoom = 6;
map.options.minZoom = 1;

var clusterSizeFactor = function(passedClusterSize) { // how we size the clusters
  pixelIncrease = 20; // constant to ensure a minimum size
  return (Math.sqrt(passedClusterSize) * 5) + pixelIncrease;
}

function newMarkerClusterGroup(clusterColors,targetClusterCSSClass,clusterPopUpHTML) {
  var clusterName = new L.MarkerClusterGroup({
    spiderfyOnMaxZoom: false,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: false,
    maxClusterRadius: 20,
    // chunkedLoading: true,
    // chunkDelay: 5,
    // chunkInterval: 10,
    // animate: true,
    // animateAddingMarkers: true,
    iconCreateFunction: function(cluster) {
      var numberToShow = '',
          sizeClass = '';
      // show the number of results for more than 15
      if (cluster.getChildCount() > 15) {
        numberToShow = cluster.getChildCount();
      }
      // make it "big" if more than 35
      if (cluster.getChildCount() > 40) {
        sizeClass = 'big-cluster';
      }
      var factoredSize = clusterSizeFactor(cluster.getChildCount());
      return markerIcon = new L.DivIcon({
        iconSize: [factoredSize, factoredSize],
        html: '<div class="' + targetClusterCSSClass + ' ' + sizeClass + '" style="border-radius:'+ factoredSize + 'px; line-height:'+ factoredSize + 'px; border: 1px solid rgb(202,210,211); ">' + numberToShow + '</div>'
      });

    }
  });

  clusterName.on('clustermouseover', function(ev) {
    // Child markers for this cluster are a.layer.getAllChildMarkers()
    L.popup().setLatLng(ev.latlng).setContent(clusterPopUpHTML).openOn(map);
  });
  clusterName.on('clustermouseout', function(ev) {
    map.closePopup();
  });

  return clusterName;
}

function processData(fetchedData) {
  var markerClustersTemporary = [];

  fetchedData.eachLayer( function(marker) {
    if (typeof marker.feature !== 'undefined') {
      // add to marker group
      var a = marker.feature.geometry.coordinates;
      // var title = 'tesdt';
      var markerNode = L.circleMarker(new L.LatLng(a[1], a[0]), {
        stroke: true,
        color: 'rgb(202,210,211)',
        weight: '1',
        // fillColor: targetClusterGroupColor,
        fillOpacity: '.4'
      });
      markerNode.setRadius(5);
      // markerNode.bindPopup(title);
      // group the layers by data source
      var targetLayer = marker.feature.properties['target-layer'];
      if (markerClustersTemporary[targetLayer] == undefined) { markerClustersTemporary[targetLayer] = []; }
      markerClustersTemporary[targetLayer].push(markerNode);
    }
  });

  // process new nodes
  for(var index in markerClustersTemporary) {
    removeAndAddNodes(index,markerClustersTemporary[index]);
  }
}

// Progressivley load and unload nodes based on the number of nodes to move, and how quickly we pull data.
// We do this so the maps is less chunky adding and removing data.
function removeAndAddNodes(targetClusterGroup,queueToAdd) {

  targetClusterGroup = window[targetClusterGroup]; // reattach passed string to mapbox layer

  function addNodes() {
    if (mainLoopPause === true) return;

    if (queueToAdd.length == 0) {
      clearInterval(addNodesVar); // we're done
    } else {
      var nodeToProcess = queueToAdd.pop();

      if ((nodeToProcess._latlng.lat == '0') && (nodeToProcess._latlng.lng == '0')) {
        return false; // exit if the location didn't geocode
      }

      // add dot to map
      targetClusterGroup.addLayer(nodeToProcess);
      // Performance note:
      // If things get sluggish, we should consider using the plural function "addLayers"
      // view-source:http://leaflet.github.io/Leaflet.markercluster/example/marker-clustering-realworld.50000.html
      // We could also group the source CSV to say how many occurances of each lat/long there is

      // schedule marker removal
      setTimeout(function() {
        scheduledNodeRemoval(targetClusterGroup,nodeToProcess);
      }, lifeSpan * 2);
    }
  }

  // run the queue
  var addNodesVar = window.setInterval(addNodes, lifeSpan / queueToAdd.length+1);
}

function scheduledNodeRemoval(targetClusterGroup,targetNode) {
  if (mainLoopPause === false) {
    targetClusterGroup.removeLayer(targetNode);
  } else {
    // wait XXms and check again
    setTimeout(function() {
      scheduledNodeRemoval(targetClusterGroup,targetNode);
    }, lifeSpan);
  }
}

// loop to keep clusters updating
function runClusters() {
  if (debug) { console.log(window.performance.memory); }

  if (mainLoopPause === true) return;

  // we just ask the server and it will return all desired data sets
  $('.data-freshness').fadeTo( "fast", 0.5 );

  $.ajax({
    type: "GET",
    url: 'parseLogMap.php?file=all&cachebust='+Math.floor((Math.random() * 1000) + 1),
    dataType: "text",
    success: function(data, textStatus, request) {
      // compare the cache file time to request server time and if it's out of step, take steps to align with "Fresh" server time
      var offset = 0;
      if (request.getResponseHeader('Map-cache-creation') > 0) {
        offset = request.getResponseHeader('Map-cache-server-time') - request.getResponseHeader('Map-cache-creation');
      }
      if (offset === 0) {
        // tell user map is fresh, but wait for old dots to sync up first
        setTimeout(function() {
          if (passedParamSlimClient != undefined) {
            $('.leaflet-control-attribution .data-freshness').html('Map is fresh ');
          }
        }, lifeSpan - 500 );
      } else {
        // inch closer to actual time
        window.clearInterval(mainLoop);
        mainLoopPause = true;
        setTimeout(function() {
          mainLoop = window.setInterval(runClusters, lifeSpan); // schedule future updates
          mainLoopPause = false;
        }, 500 );

        if (passedParamSlimClient != undefined) {
          $('.leaflet-control-attribution .data-freshness').html('Data is ' + offset + ' seconds stale ... compensating. ');
        }

      }
      parseDate(data,offset);
    }
  });

  function parseDate(data) {
    var readyData = omnivore.csv.parse(data, null);
    processData(readyData);
    $('.data-freshness').fadeTo( "fast", 1 );
  }

}

// setup colours and markercluster objects
var counter = 0;
var markerClustersEBIColor = 'rgba(168,200,19,.8)',
    markerClustersPortalsColor = 'rgba(235,98,9,.8)',
    markerClustersUniprotColor = 'rgba(29,92,116,.8)';
// var markerClustersTemporary = newMarkerClusterGroup(markerClustersEBIColor); // we use for data processing only
var markerClustersEBI = newMarkerClusterGroup(markerClustersEBIColor,'markerClustersEBI','<span style="color:' + markerClustersEBIColor + '">EMBL-EBI request</span>'),
    markerClustersPortals = newMarkerClusterGroup(markerClustersPortalsColor,'markerClustersPortals','<span style="color:' + markerClustersPortalsColor + '">Portal request</span>'),
    markerClustersUniprot = newMarkerClusterGroup(markerClustersUniprotColor,'markerClustersUniprot','<span style="color:' + markerClustersUniprotColor + '">UniProt request</span>');

map.addLayer(markerClustersEBI);
map.addLayer(markerClustersPortals);
map.addLayer(markerClustersUniprot);

var lifeSpan = lifeSpan || 6000; // how quickly we fetch data, and how long each dot lasts
if (debug) { console.log('Data track loop is', lifeSpan); }
var mainLoopPause = false; // functionality for a "pause button"
var mainLoop = window.setInterval(runClusters, lifeSpan); // schedule future updates

// add a holder for data freshness
$('.leaflet-control-attribution').prepend('<span class="data-freshness"></span> ');

// run the data pull immediately on strap
runClusters();

// legend stuff
function createLegend () {
  var legendHtml = '<h4>Request type</h4>' +
      '<div class="markerClustersEBI"><a href="#" class="display-toggle ebi"><span class="legend-icon"></span>EMBL-EBI</a></div>' +
      '<div class="markerClustersPortals"><a href="#" class="display-toggle portals"><span class="legend-icon"></span>Portals</a></div>' +
      '<div class="markerClustersUniprot"><a href="#" class="display-toggle uniprot"><span class="legend-icon"></span>Uniprot</a></div>' +
      '<div><a href="#" class="display-toggle unified"><span class="legend-icon icon icon-functional" data-icon="/"></span>Use only one colour</a></div>' +
      '<div><a href="#" class="pause"><span class="icon icon-functional" data-icon="o"></span>Pause</a></div>';
  $('.legend').html(legendHtml);

  // Pause toggling
  $('a.pause').on('click',function(){
    if (mainLoopPause === false) {
      mainLoopPause = true;
      $('a.pause').html('<span class="icon icon-functional" data-icon="v"></span>Play');
    } else {
      mainLoopPause = false;
      $('a.pause').html('<span class="icon icon-functional" data-icon="o"></span>Pause');
    }
  });

  // toggle button state with opacity
  function invokeLegendIcon(request) {
    var invokedLegendIcon = 'a.display-toggle.'+request+' span.legend-icon';
    if ($(invokedLegendIcon).css('opacity')== 1) {
      $(invokedLegendIcon).css('opacity',.25);
      $('body').removeClass('display-'+request);
    } else {
      $(invokedLegendIcon).css('opacity',1);
      $('body').addClass('display-'+request);
    }
  }

  // Legend toggling
  $('a.display-toggle').on('click',function() {
    // which has the user requested?
    if ($(this).hasClass('unified')) { invokeLegendIcon('unified'); }
    if ($(this).hasClass('ebi')) { invokeLegendIcon('ebi'); }
    if ($(this).hasClass('portals')) { invokeLegendIcon('portals'); }
    if ($(this).hasClass('uniprot')) { invokeLegendIcon('uniprot'); }
  });

  // parse a passed param
  if (passedParam != undefined) {
    passedParam = passedParam.split('&')[0]; // drop anything after &
    // now we disable all portals
    invokeLegendIcon('unified');
    invokeLegendIcon('portals');
    invokeLegendIcon('uniprot');
    invokeLegendIcon('ebi');

    // enable jsut the one the user wants
    if (passedParam != 'distinct') {
      invokeLegendIcon(passedParam);
    }

    if (passedParam == 'distinct') {
      // we've already turned off unified, show just show all protals
      invokeLegendIcon('portals');
      invokeLegendIcon('uniprot');
      invokeLegendIcon('ebi');
    }
  }

}


createLegend();

function handleVisibilityChange() {
  if (document[hidden]) {
    // only pause if the tab is playing
    if (mainLoopPause === false) { $('a.pause').click(); }
    // $('#pause-message').remove();
    // $('body').append('<div id="pause-message" class="message modal">Noticed you switched away, we\'ll resume the map</div>');
  } else {
    $('a.pause').click();
    // $('#pause-message').hide(1500);
  }
}

// Bonus: on IE10+ (and other modern browsers), pause the map when the tab doesn't show
// https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API

// Set the name of the hidden property and the change event for visibility
var hidden, visibilityChange;
if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
  hidden = "hidden";
  visibilityChange = "visibilitychange";
} else if (typeof document.msHidden !== "undefined") {
  hidden = "msHidden";
  visibilityChange = "msvisibilitychange";
} else if (typeof document.webkitHidden !== "undefined") {
  hidden = "webkitHidden";
  visibilityChange = "webkitvisibilitychange";
}


// Warn if the browser doesn't support addEventListener or the Page Visibility API
if (typeof document.addEventListener === "undefined" || typeof document[hidden] === "undefined") {
  // console.log("This demo requires a browser, such as Google Chrome or Firefox, that supports the Page Visibility API.");
} else {
  // Handle page visibility change
  document.addEventListener(visibilityChange, handleVisibilityChange, false);
}
