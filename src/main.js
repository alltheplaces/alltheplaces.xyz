import maplibregl from 'maplibre-gl';
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder';
import * as pmtiles from 'pmtiles';

// Import your existing viewer.js code or add it directly here
import './viewer.js';

// Export any necessary objects for global access if needed
window.maplibregl = maplibregl;
window.MaplibreGeocoder = MaplibreGeocoder;
window.pmtiles = pmtiles;
