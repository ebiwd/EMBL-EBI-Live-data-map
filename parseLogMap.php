<?php
  // A proxy for the EMBL-EBI Live Data Map
  // fetch KML and return as simple CSV

  // Don't allow direct use of the file, and don't allow non-ebi hosted use of file
  if (strpos(parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST),'ebi.ac.uk') < 1) {
    exit;
  }

  // Which file is the user after?
  $desiredFile = htmlspecialchars($_GET["file"]);
  switch ($desiredFile) {
    case 'ebi':
    default: 
      $desiredFile = 'http://ves-ebi-0f.ebi.ac.uk/ebiwebtrafficmap/fcgi-bin/ebi.fcgi';
      break;
    case 'portals':
      $desiredFile = 'http://ves-ebi-0f.ebi.ac.uk/ebiwebtrafficmap/fcgi-bin/portals.fcgi';
      break;
    case 'uniprot':
      $desiredFile = 'http://ves-ebi-0f.ebi.ac.uk/ebiwebtrafficmap/fcgi-bin/uniprot.fcgi';
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

  // Get the data
  $fetchedData = curlFileAsXml($desiredFile);

  // Write the data CSV
  // -----------
  // CSV header
  echo "name,longitude,latitude,junk \r\n";
  // to do: in the future, we could use the "junk" column to indicate the number of times a lat/lon combination appears so we can add N number of dots instead of one at a time. Would offer over the wire savings, and perhaps speed up the JS

  // Results
  $rowCounter = 0;
  foreach($fetchedData as $item) {
    $rowCounter++;
    print "result-".$rowCounter. ",".$item->Point->coordinates . "\r\n";
  }

?>