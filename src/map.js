import maplibregl from 'maplibre-gl';
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder';
import * as pmtiles from 'pmtiles';
import style_json from './style.json';

(async function () {
    const protocol = new pmtiles.Protocol({metadata: true});
    maplibregl.addProtocol("pmtiles", protocol.tile);

    const {pmtiles_url} = await fetch("https://data.alltheplaces.xyz/runs/latest.json").then(r => r.json());
    style_json.sources.alltheplaces.url = `pmtiles://${pmtiles_url}`;

    const map = (window.map = new maplibregl.Map({
        container: "map",
        style: style_json,
        center: [0, 0],
        zoom: 1,
        hash: true,
    }));

    map.addControl(new maplibregl.ScaleControl());
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.touchPitch.disable();
    map.keyboard.disableRotation();
    map.getCanvas().focus();

    map.on("click", "output", (e) => {
        const cluster = e.features.find((x) => x.properties.clustered);
        if (cluster) {
            map.easeTo({
                center: cluster.geometry.coordinates,
                zoom: 1 + map.getZoom(),
            });
        } else {
            const popupContents = document.createElement("div");
            for (let i = 0; i < e.features.length; i++) {
                const feature = e.features[i];
                popupContents.append(renderFeature(feature));
                if (i + 1 < e.features.length) {
                    popupContents.append(document.createElement("hr"));
                }
            }

            var popup = new maplibregl.Popup({
                className: "places-popup",
                maxWidth: "80%",
            })
                .setLngLat(e.lngLat)
                .setDOMContent(popupContents)
                .addTo(map);

            popup.once("close", () => map.getCanvas().focus());

            const first = e.features[0];
            map.easeTo({
                center: first.geometry.coordinates,
            });
        }
    });

    map.on("mouseenter", "output", function () {
        map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "output", function () {
        map.getCanvas().style.cursor = "";
    });

    function renderFeature(feature) {
        const [x, y] = feature.geometry.coordinates.map((p) => +p.toFixed(6));
        const props = Object.entries(feature.properties);
        props.sort((a, b) => a[0].localeCompare(b[0]));
        const formatValue = (k, v) => {
            switch (k) {
                case "website": {
                    const a = document.createElement("a");
                    a.target = "_blank";
                    a.href = a.textContent = v;
                    return a;
                }
                case "brand:wikidata": {
                    const a = document.createElement("a");
                    a.target = "_blank";
                    a.href = `https://www.wikidata.org/wiki/${v}`;
                    a.textContent = v;
                    return a;
                }
                case "nsi_id": {
                    const a = document.createElement("a");
                    a.target = "_blank";
                    const u = new URL("https://nsi.guide/");
                    u.searchParams.set("id", v);
                    a.href = u;
                    a.textContent = v;
                    return a;
                }
                case "@spider": {
                    const a = document.createElement("a");
                    a.target = "_blank";
                    const u = new URL(
                        "https://github.com/alltheplaces/alltheplaces/search"
                    );
                    u.searchParams.set("q", `path:locations/spiders /name = "${v}"/`);
                    a.href = u;
                    a.textContent = v;
                    return a;
                }
                default:
                    return v;
            }
        };
        const e = document.createElement("pre");
        const coord = document.createElement("a");
        coord.target = "_blank";
        coord.href = `https://www.openstreetmap.org/?mlat=${y}&mlon=${x}`;
        coord.textContent = `${x},${y}`;
        e.append(coord, "\n");
        for (let i = 0; i < props.length; i++) {
            const [k, v] = props[i];
            e.append(k, "=", formatValue(k, v));
            if (i + 1 < props.length) {
                e.append("\n");
            }
        }
        return e;
    }

    const geocoderApi = {
        forwardGeocode: async (config) => {
            const features = [];
            try {
                const request =
                    `https://nominatim.openstreetmap.org/search?q=${config.query
                    }&format=geojson&polygon_geojson=1&addressdetails=1`;
                const response = await fetch(request);
                const geojson = await response.json();
                for (const feature of geojson.features) {
                    let center;
                    
                    // If the geometry is already a Point, use its coordinates directly
                    if (feature.geometry.type === 'Point') {
                        center = feature.geometry.coordinates;
                    } else {
                        // For other geometries, calculate center from bbox
                        center = [
                            feature.bbox[0] +
                            (feature.bbox[2] - feature.bbox[0]) / 2,
                            feature.bbox[1] +
                            (feature.bbox[3] - feature.bbox[1]) / 2
                        ];
                    }
                    
                    const point = {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: center
                        },
                        place_name: feature.properties.display_name,
                        properties: {
                            ...feature.properties,
                            // Store the bounding box for potential map fitting
                            bbox: feature.bbox
                        },
                        text: feature.properties.display_name,
                        place_type: ['place'],
                        center,
                        bbox: feature.bbox
                    };
                    features.push(point);
                }
            } catch (e) {
                console.error(`Failed to forwardGeocode with error: ${e}`);
            }

            return {
                features
            };
        }
    };

    const geocoder = new MaplibreGeocoder(geocoderApi, {
        maplibregl,
    });
    
    map.addControl(geocoder);
    
    // Listen for when a geocoding result is selected
    geocoder.on('result', (event) => {
        const result = event.result;
        
        // Always focus on the bounding box that Nominatim provides
        // This ensures we see the full extent of the searched location
        if (result.bbox && result.bbox.length === 4) {
            const [minLng, minLat, maxLng, maxLat] = result.bbox;
            
            map.fitBounds([
                [minLng, minLat],
                [maxLng, maxLat]
            ], {
                padding: 50,
                maxZoom: 15
            });
        } else {
            // Fallback to centering on the point only if no bounding box is available
            map.easeTo({
                center: result.center,
                zoom: 12
            });
        }
    });
})();

import './scale.fix.js';
