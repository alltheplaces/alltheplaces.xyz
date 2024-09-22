import * as pmtiles from "https://unpkg.com/pmtiles@3.2.0/dist/index.js";
const protocol = new pmtiles.Protocol({ metadata: true });
maplibregl.addProtocol("pmtiles", protocol.tile);

const { pmtiles_url } = await fetch("https://data.alltheplaces.xyz/runs/latest.json").then(r => r.json());
const style = await fetch("./style.json").then(r => r.json());
style.sources.alltheplaces.url = `pmtiles://${pmtiles_url}`;

export const map = (window.map = new maplibregl.Map({
  container: "map",
  style,
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
        const center = [
          feature.bbox[0] +
          (feature.bbox[2] - feature.bbox[0]) / 2,
          feature.bbox[1] +
          (feature.bbox[3] - feature.bbox[1]) / 2
        ];
        const point = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: center
          },
          place_name: feature.properties.display_name,
          properties: feature.properties,
          text: feature.properties.display_name,
          place_type: ['place'],
          center
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

map.addControl(
  new MaplibreGeocoder(geocoderApi, {
    maplibregl,
  })
);
