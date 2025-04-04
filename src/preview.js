import maplibregl from 'maplibre-gl';


document.addEventListener('DOMContentLoaded', function () {
    // Get the URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const geoJsonUrl = urlParams.get('show');
    console.log('Fetching GeoJSON at ' + geoJsonUrl);

    if (!geoJsonUrl) {
        console.error('No GeoJSON URL specified in the "show" parameter.');
        return;
    }

    // Initialize the map
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://api.protomaps.com/styles/v2/dark.json?key=a19ca255a685ed70',
        center: [0, 0],
        zoom: 2
    });

    // Add the GeoJSON source
    map.on('load', function () {
        map.addSource('points', {
            type: 'geojson',
            data: geoJsonUrl,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50
        });

        // Add a layer for clustered points
        map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'points',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': [
                    'step',
                    ['get', 'point_count'],
                    '#51bbd6',
                    100,
                    '#f1f075',
                    750,
                    '#f28cb1'
                ],
                'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    20,
                    100,
                    30,
                    750,
                    40
                ]
            }
        });

        // Add a layer for individual points
        map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'points',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': '{point_count_abbreviated}',
                'text-font': ['Noto Sans Medium'],
                'text-size': 12
            }
        });

        // Add a layer for unclustered points
        map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'points',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': '#11b4da',
                'circle-radius': 6,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        });

        // Show a popup when hovering over an unclustered point
        const popup = new maplibregl.Popup({
            closeOnClick: false,
            maxWidth: '400px'
        });
        let stickyPopup = false;

        map.on('mouseenter', 'unclustered-point', function (e) {
            map.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice();
            let description = "<table>";
            // Sort the properties by key
            const sortedProperties = {};
            Object.keys(feature.properties).sort().forEach(function (key) {
                sortedProperties[key] = feature.properties[key];
            });
            for (let [key, value] of Object.entries(sortedProperties)) {
                // If the value is a URL, make it a link
                if (/^http[s]?:\/\//.test(value)) {
                    value = `<a referrerpolicy="no-referrer" target="_blank" href="${value}">${value}</a>`;
                }

                // If the key is "brand:wikidata", "network:wikidata", etc.
                // make it a link to Wikidata
                if (key.endsWith(":wikidata")) {
                    value = `<a referrerpolicy="no-referrer" target="_blank" href="https://www.wikidata.org/wiki/${value}">${value}</a>`;
                }

                description += `<tr><th>${key}</th><td>${value}</td></tr>`;
            }
            description += "</table>";

            // Ensure that if the map is zoomed out such that multiple
            // copies of the feature are visible, the popup appears
            // over the copy being pointed to
            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            popup
                .setLngLat(coordinates)
                .setHTML(description)
                .addTo(map);
        });

        // Click on the point to keep the popup open
        map.on('click', 'unclustered-point', function (e) {
            map.getCanvas().style.cursor = 'pointer';
            stickyPopup = true;
        });

        // Unset the sticky popup when the popup is closed
        popup.on('close', function () {
            stickyPopup = false;
        });

        // Hide the popup when the mouse leaves the point
        map.on('mouseleave', 'unclustered-point', function () {
            map.getCanvas().style.cursor = '';
            if (!stickyPopup) popup.remove();
        });

        // Click on a clustered point to zoom to that cluster
        map.on('click', 'clusters', function (e) {
            const features = map.queryRenderedFeatures(e.point, {
                layers: ['clusters']
            });
            const clusterId = features[0].properties.cluster_id;
            map.getSource('points').getClusterExpansionZoom(
                clusterId,
                function (err, zoom) {
                    if (err) return;
                    map.easeTo({
                        center: features[0].geometry.coordinates,
                        zoom: zoom
                    });
                }
            );
        });
    });
});
