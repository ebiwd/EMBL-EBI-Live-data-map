<?php
  // A proxy for the EMBL-EBI Live Data Map
  // fetch KML and return as simple CSV

  // No automatic caching ...
  header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
  header("Cache-Control: post-check=0, pre-check=0", false);
  header("Pragma: no-cache");

  // Don't allow direct use of the file, and don't allow non-ebi hosted use of file
  if (strpos(parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST),'ebi.ac.uk') < 1) {
    // exit;
  }

  // Which file(s) is the requester after?
  $desiredFile = htmlspecialchars($_GET["file"]);

  // set up a local file based cache
  $cacheFileName = 'cache/' . $desiredFile . '.csv';
  // is the data already cahced?
  if (file_exists($cacheFileName)) {
    // use cache if less than XXX seconds old
    if (time() - filemtime($cacheFileName) < 6) {
      header("Map-cache-creation: ". urlencode(filemtime($cacheFileName)));
      header("Map-cache-server-time: ". urlencode(time()));
      require $cacheFileName; 
      exit; // dump the cahced contents and go home
    }
  }

  // OK then, we're getting new data...
  switch ($desiredFile) {
    case 'all':
    default: 
      $desiredFile = 'all'; // cleanup wild url requests
      $desiredFiles = array('http://ves-ebi-0f.ebi.ac.uk/ebiwebtrafficmap/fcgi-bin/ebi.fcgi',
                            'http://ves-ebi-0f.ebi.ac.uk/ebiwebtrafficmap/fcgi-bin/portals.fcgi',
                            'http://ves-ebi-0f.ebi.ac.uk/ebiwebtrafficmap/fcgi-bin/uniprot.fcgi');
      $pointType = array('markerClustersEBI','markerClustersPortals','markerClustersUniprot');
      break;
    case 'ebi':
      $desiredFiles = array('http://ves-ebi-0f.ebi.ac.uk/ebiwebtrafficmap/fcgi-bin/ebi.fcgi');
      $pointType = array('markerClustersEBI');
      break;
    case 'portals':
      $desiredFiles = array('http://ves-ebi-0f.ebi.ac.uk/ebiwebtrafficmap/fcgi-bin/portals.fcgi');
      $pointType = array('markerClustersPortals');
      break;
    case 'uniprot':
      $desiredFiles = array('http://ves-ebi-0f.ebi.ac.uk/ebiwebtrafficmap/fcgi-bin/uniprot.fcgi');
      $pointType = array('markerClustersUniprot');
      break;
  }

  // Function to fetch the file
  // We use curl as we can't use nicer functions on our infrastructure
  function curlFileAsXml($url) {
    $curl_handle=curl_init();
    curl_setopt($curl_handle,CURLOPT_URL,$url);
    curl_setopt($curl_handle,CURLOPT_CONNECTTIMEOUT,2);
    curl_setopt($curl_handle,CURLOPT_RETURNTRANSFER,1);
    $buffer = curl_exec($curl_handle); 
    curl_close($curl_handle);
  
    if (empty($buffer)) {
      return "Nothing returned from url.";
    } else {
      return simplexml_load_string($buffer);
    }
  }

  // Write the data CSV
  // -----------
  // CSV header
  $output = "target-layer,longitude,latitude,point-type \r\n";
  // to do: in the future, we could add a column to indicate the number of times a lat/lon combination appears so we can add N number of dots instead of one at a time. Would offer over the wire savings, and perhaps speed up the JS

  foreach ($desiredFiles as $key => $desiredFile) {
    // Get the data
    $fetchedData = curlFileAsXml($desiredFile);

    // Results
    $rowCounter = 0;
    foreach($fetchedData as $item) {
      $rowCounter++;
      $output .= $pointType[$key] . ",".$item->Point->coordinates . "\r\n";
    }
  }

  // write the new contents
  echo $output;

  // save to the cache
  file_put_contents($cacheFileName, $output);

?>