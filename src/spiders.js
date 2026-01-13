import {fetchHistoryList, getUrlQueryParams, attachDataTableUrlHandlers, availableSupplierNames} from './shared.js';
import $ from "jquery";
import DataTable from 'datatables.net-dt';

function getColorGradient(percentage) {
    if (percentage > 98) {
        // Don't mess around with colour gradients for "obviously" good.
        return "rgb(0,255,0)";
    } else if (percentage < 70) {
        // Don't mess around with colour gradients for "obviously" bad.
        return "rgb(255,0,0)";
    }
    // We give the inbetween scenario a colour gradient.
    let inflection = 90
    let red = (percentage > inflection ? 1 - 2 * (percentage - inflection) / 100.0 : 1.0) * 255;
    let green = (percentage > inflection ? 1.0 : 2 * percentage / 100.0) * 255;
    return "rgb(" + red + "," + green + ",0)";
}

const LINK_FORMAT_OPTIONS = [
    ['map', 'Map'],
    ['geojson', 'Feature GeoJSON'],
    ['statistics', 'Spider stats JSON'],
    ['logs', 'Spider error logs'],
];
const GITHUB_URL = "https://github.com/alltheplaces/alltheplaces/tree/master";
let NUM_BUILDS = 5; // Maximum number of builds to display.
let JOSM_AVAILABLE = false;

fetch("http://127.0.0.1:8111/version")
    .then(resp => resp.json())
    .then((resp) => {
        JOSM_AVAILABLE = true;
    })
    .catch((err) => {
        JOSM_AVAILABLE = false;
    });

function calculateStability(row) {
    // Normalise the POI count data such that each run outputs the same maximum number.
    let NORMALISED_MAX_POIS = 10000.0
    let maxFeatures = 0;
    for (let i = 2; i <= NUM_BUILDS + 1; i++) {
        if (row[i] > maxFeatures) {
            maxFeatures = row[i]
        }
    }
    if (maxFeatures > 0) {
        let multiplier = NORMALISED_MAX_POIS / maxFeatures;
        let sumSqDeviations = 0;
        let runCount = 0;
        // Calculate the variance from the MAXIMUM value for each (normalised count) run that occurred.
        for (let i = 2; i <= NUM_BUILDS + 1; i++) {
            if (row[i] != null) {
                let dev = NORMALISED_MAX_POIS - (multiplier * row[i]);
                sumSqDeviations += (dev * dev);
                runCount++;
            }
        }
        const stDev = Math.sqrt(sumSqDeviations / runCount);
        // Set a stability number from 0 to 100.
        row[1] = 100 - ((Math.min(stDev, NORMALISED_MAX_POIS) / NORMALISED_MAX_POIS) * 100);
    }
}

// Fetch the stats JSON for a particular run.
async function fetchStatsForHistoryListEntry(entry) {
    const statsResponse = await window.fetch(entry["stats_url"])
    const stats = await statsResponse.json()
    stats["name"] = entry["name"]
    return stats
}

(async function () {
    const URL_QUERY_PARAMS = getUrlQueryParams();
    let selectedSupplierName = URL_QUERY_PARAMS['supplier_name'] || null;
    const historyList = await fetchHistoryList(selectedSupplierName);
    historyList.splice(NUM_BUILDS)
    // Fetch the stats JSON for the runs we will be rendering.
    const statsList = await Promise.all(historyList.map(fetchStatsForHistoryListEntry))

    // Re-pivot the build data by spider.
    const spiderToFilename = {};
    const buildsBySpider = {};
    statsList.forEach(statsRun => {
        let runName = statsRun["name"]
        statsRun.results.forEach(spiderEntry => {
            let spiderName = spiderEntry["spider"];
            spiderToFilename[spiderName] = spiderEntry["filename"];
            buildsBySpider[spiderName] ||= {}
            buildsBySpider[spiderName][runName] = {
                errors: spiderEntry["errors"],
                features: spiderEntry["features"],
                elapsed: spiderEntry["elapsed_time"],
            }
        })
    })

    // Compute standard deviation and convert to flat tabular format.
    let data = [];
    Object.entries(buildsBySpider).forEach(entry => {
        // Set spider name as the first entry in the row, second entry is for the run stability calculation.
        const row = [entry[0], null];
        // Now push the number of features in each run for this spider on to the row.
        statsList.forEach(statsRun => {
            let runName = statsRun["name"]
            row.push(entry[1][runName]?.features ?? null)
        })
        // Calculate how "stable" we think the runs have been for this spider based on historical POI counts.
        calculateStability(row)
        // Finally add the row to the data table
        data.push(row);
    });

    // Default link format is Feature GeoJSON, the selector in the table header can change this.
    let linkFormat = Number.isFinite(parseFloat(URL_QUERY_PARAMS['link_format']))
        ? LINK_FORMAT_OPTIONS[parseFloat(URL_QUERY_PARAMS['link_format']) - 1]?.[0]
        : URL_QUERY_PARAMS['link_format']?.trim();
    linkFormat ||= "geojson";

    function onLinkFormatChange() {
        linkFormat = document.getElementById('format-select').value
        dataTable.draw("page")
    }

    function onSupplierNameChange() {
        const selectedValue = document.getElementById('supplier-select').value;
        const url = new URL(window.location);
        if (selectedValue === 'null') {
            url.searchParams.delete('supplier_name');
        } else {
            url.searchParams.set('supplier_name', selectedValue);
        }
        window.location.href = url.toString();
    }

    // Render with datatable
    let dataTable = $("#spider-table").DataTable({
        data,
        lengthMenu: [
            [10, 15, 20, 25, 50, 75, 100, -1],
            [10, 15, 20, 25, 50, 75, 100, "All"],
        ],
        pageLength: parseInt(URL_QUERY_PARAMS['page_length']) || 10,
        layout: {
            topStart: [
                'pageLength',
                { div: { className: 'selector-div' } },
            ],
            topEnd: 'search',
            bottomStart: 'info',
            bottomEnd: 'paging'
        },
        order: [[2, 'desc']],
        search: {search: URL_QUERY_PARAMS['search'] || ''},
        columns: [
            {
                title: "Spider",
                createdCell(cell) {
                    $(cell).html(`${cell.innerText}<a target="_blank" href="${GITHUB_URL}/${spiderToFilename[cell.innerText]}">✎</a>`);
                }
            },
            {
                title: "Stability",
                createdCell(cell, cellData) {
                    const box = $("<div>").addClass("stability-box");
                    if (Number.isFinite(cellData)) {
                        box.css("background-color", getColorGradient(cellData));
                    }
                    $(cell).empty().append(box);
                },
            },
            ...historyList.map(historyEntry => ({
                title: historyEntry["name"],
                createdCell(cell, cellData, rowData) {
                    if (cellData || cellData === 0) {
                        cell.setAttribute("data-value", cellData);
                    }
                },
            })),
        ],
        columnDefs: [
            {
                className: 'dt-center', targets: [1]
            },
            {
                className: 'dt-right', targets: [2, 3, 4, 5, 6]
            },
            {
                targets: statsList.map((_, i) => i + 2),
                createdCell(cell, cellData) {
                    cell.dataset.value = cellData;
                },
            }
        ],
        "footerCallback": function (row, data, start, end, display) {
            let api = this.api()
            // Total up the numeric columns (all next to each)
            let columns = [2, 3, 4, 5, 6]
            for (let i in columns) {
                let total = api
                    .column(columns[i], {filter: "applied"})
                    .data()
                    .reduce(function (a, b) {
                        return a + b;
                    }, 0);
                // Update total in footer
                $(api.column(columns[i]).footer()).html(total.toLocaleString("us-US"));
            }
        },
        "rowCallback": function (row, data, displayNum, displayIndex, dataIndex) {
            for (let i = 2; i <= 7; i++) {
                if (data[i] || data[i] === 0) {
                    let linkUrl = null
                    if ((linkFormat === "map") && historyList[i - 2]["output_url"]) {
                        let mapUrl = new URL("https://alltheplaces-data.openaddresses.io/map.html");
                        mapUrl.searchParams.set("show", new URL("output/" + data[0] + ".geojson", historyList[i - 2]["output_url"]).toString());
                        linkUrl = mapUrl.toString();
                    } else if ((linkFormat === "geojson") && historyList[i - 2]["output_url"]) {
                        linkUrl = new URL("output/" + data[0] + ".geojson", historyList[i - 2]["output_url"]).toString()
                    } else if ((linkFormat === "statistics") && historyList[i - 2]["stats_url"]) {
                        linkUrl = new URL(data[0] + ".json", historyList[i - 2]["stats_url"]).toString()
                    } else if ((linkFormat === "logs") && historyList[i - 2]["output_url"]) {
                        linkUrl = new URL("logs/" + data[0] + ".txt", historyList[i - 2]["output_url"]).toString()
                    }

                    let linkData = data[i].toLocaleString("us-US")

                    if (linkUrl) {
                        linkHtml = '<a href ="' + linkUrl + '">' + linkData + '</a>';
                        if ((linkFormat === "geojson") && JOSM_AVAILABLE) {
                            linkHtml += ' <a href="http://127.0.0.1:8111/import?new_layer=true&download_policy=never&upload_policy=never&url=' + linkUrl + '" target="_blank">J</a>';
                        }
                        $('td:eq(' + i + ')', row).html(linkHtml);
                    } else {
                        $('td:eq(' + i + ')', row).html(linkData);
                    }
                }
            }
        },
    });

    const linkFormatOptionsHtml = LINK_FORMAT_OPTIONS.map(([val, label], i) => `<option value="${val}">${label}</option>`).join('');
    let selectorHtml = `<label class="selector-label">Links give <select id="format-select" aria-controls="spider-table">${linkFormatOptionsHtml}</select></label>`;

    // Add supplier name selector if there are multiple supplier sources available
    if (availableSupplierNames.length > 1) {
        const supplierOptionsHtml = '<option value="null">All</option>' +
            availableSupplierNames.map(name => `<option value="${name}">${name}</option>`).join('');
        selectorHtml += `<label class="selector-label">Supplier <select id="supplier-select" aria-controls="spider-table">${supplierOptionsHtml}</select></label>`;
    }

    $('div.selector-div').html(selectorHtml);
    document.getElementById('format-select').value = linkFormat;
    document.getElementById('format-select').onchange = onLinkFormatChange;

    // Set up supplier selector if it exists
    if (availableSupplierNames.length > 1) {
        const supplierSelect = document.getElementById('supplier-select');
        supplierSelect.value = selectedSupplierName || 'null';
        supplierSelect.onchange = onSupplierNameChange;
    }

    // Attach URL update handlers
    attachDataTableUrlHandlers(dataTable, 10);
})();
