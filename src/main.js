import maplibregl from 'maplibre-gl';
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder';
import * as pmtiles from 'pmtiles';

import './viewer.js';
import './scale.fix.js';

// Export any necessary objects for global access if needed
window.maplibregl = maplibregl;
window.MaplibreGeocoder = MaplibreGeocoder;
window.pmtiles = pmtiles;
