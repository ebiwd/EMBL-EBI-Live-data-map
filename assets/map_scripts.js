// handy things:
// https://www.mapbox.com/mapbox.js/example/v1.0.0/markercluster-multiple-groups/
// https://github.com/Leaflet/Leaflet.markercluster#usage
// http://wwwdev.ebi.ac.uk/ebiwebtrafficmap/kmlvector.html

L.mapbox.accessToken = 'pk.eyJ1Ijoia2hhd2tpbnNlYmkiLCJhIjoiY2ludTZ2M3ltMDBtNXczbTJueW85ZmJjNyJ9.u6SIfnrYvGe6WFP3fOtaVQ';

var map = L.mapbox.map('map');

// show sunrise and sunset
// http://joergdietrich.github.io/Leaflet.Terminator/
var daynightoverlay = L.terminator({className:'daynightoverlay'});
map.setView([30, daynightoverlay.getLatLngs()[0][700]['lng']], 3);
// map.setView([30, 10], 3);
daynightoverlay.addTo(map);

setInterval(function(){updateTerminator(daynightoverlay)}, 2000);
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
      attribution: '© <a href="http://wwwdev.ebi.ac.uk/web_guidelines/map-test/clustered.html">EMBL-EBI</a> © <a href="https://www.mapbox.com/map-feedback/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

map.options.maxZoom = 6;
map.options.minZoom = 1;

var clusterSizeFactor = function(passedClusterSize) { // how we size the clusters
  pixelIncrease = 20; // constant to ensure a minimum size
  return (passedClusterSize * 1.3) + pixelIncrease;
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
      if (cluster.getChildCount() > 35) {
        sizeClass = 'big-cluster';
      }
      return markerIcon = new L.DivIcon({
        iconSize: [clusterSizeFactor(cluster.getChildCount()), clusterSizeFactor(cluster.getChildCount())],
        html: '<div class="' + targetClusterCSSClass + ' ' + sizeClass + '" style="border-radius:'+ clusterSizeFactor(cluster.getChildCount()) + 'px; line-height:'+ clusterSizeFactor(cluster.getChildCount()) + 'px; border: 1px solid rgb(202,210,211); ">' + numberToShow + '</div>'
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

function processData(fetchedData, targetClusterGroup, targetClusterGroupColor) {
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
        fillColor: targetClusterGroupColor,
        fillOpacity: '.4'
      });
      markerNode.setRadius(5);
      // markerNode.bindPopup(title);
      markerClustersTemporary.push(markerNode);
    }
  });

  // process new nodes
  removeAndAddNodes(targetClusterGroup,markerClustersTemporary);
}

// Progressivley load and unload nodes based on the number of nodes to move, and how quickly we pull data.
// We do this so the maps is less chunky adding and removing data.
function removeAndAddNodes(targetClusterGroup,queueToAdd) {

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
      }, lifeSpan*feedsToPull.length); 
    }
  }

  // run the queue
  var addNodesVar = window.setInterval(addNodes, lifeSpan * feedsToPull.length / queueToAdd.length+1);
}

function scheduledNodeRemoval(targetClusterGroup,targetNode) {
  if (mainLoopPause === false) {
    targetClusterGroup.removeLayer(targetNode);
  } else {
    // wait XXms and check again
    setTimeout(function() { 
      scheduledNodeRemoval(targetClusterGroup,targetNode);
    }, lifeSpan * feedsToPull.length); 
  }
}

// loop to keep clusters updating
function runClusters() {

  if (mainLoopPause === true) return;

  counter++;
  if (counter >= feedsToPull.length + 1) counter = 1;

  // we rotate between each log file to update
  // Keep in mind the frequency of this function is set by the var lifeSpan
  switch (counter) {
    case 1:
      // omnivore.kml('/ebiwebtrafficmap/fcgi-bin/ebi.fcgi', null)
      omnivore.csv('parseLogMap.php?file='+feedsToPull[counter], null)
        .on('ready', function(layer) {
          processData(this,markerClustersEBI,markerClustersEBIColor);      
        });
      break;
    case 2:
      // omnivore.kml('/ebiwebtrafficmap/fcgi-bin/portals.fcgi', null)
      omnivore.csv('parseLogMap.php?file='+feedsToPull[counter], null)
        .on('ready', function(layer) {
          processData(this,markerClustersPortals,markerClustersPortalsColor);      
        });
      break;
    case 3:
      // omnivore.kml('/ebiwebtrafficmap/fcgi-bin/uniprot.fcgi', null)
      omnivore.csv('parseLogMap.php?file='+feedsToPull[counter], null)
        .on('ready', function(layer) {
          processData(this,markerClustersUniprot,markerClustersUniprotColor);      
        });
      break;
    default:
      break;
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

var lifeSpan = 7000; // how quickly we fetch data, and how long each dot lasts
var feedsToPull = ['ebi','portals','uniprot']; // the endpoint from parseLogMap.php?file= that we want
var mainLoopPause = false; // functionality for a "pause button"
var mainLoop = window.setInterval(runClusters, lifeSpan); // schedule futur updates  

// run the data pull immediately on strap for each feed
for (var i = 0; i < feedsToPull.length; i++) { runClusters(); }

$('a.pause').on('click',function(){
  if (mainLoopPause === false) {
    mainLoopPause = true;
    $('a.pause').html('<span class="icon icon-functional" data-icon="v"></span>Play');
  } else {
    mainLoopPause = false;
    $('a.pause').html('<span class="icon icon-functional" data-icon="o"></span>Pause');
  }
});
