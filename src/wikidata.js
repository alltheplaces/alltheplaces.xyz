import {fetchHistoryList, getUrlQueryParams, attachDataTableUrlHandlers} from './shared.js';
import $ from "jquery";
import DataTable from 'datatables.net-dt';

function isInt(value) {
    if (isNaN(value)) {
        return false;
    }
    let x = parseFloat(value);
    return (x | 0) === x;
}

(async function () {

    async function loadInsights(url) {
        dataTable.clear()
        dataTable.draw()
        const insightsResponse = await window.fetch(url)
        const insightsJson = await insightsResponse.json()
        let data = insightsJson["data"]
        if (!("atp_country_count" in data[0])) {
            // If we encounter an insights JSON without the newer fields then we add them dynamically
            // so that the new DataTables config does not error i.e. backwards compatability for now.
            for (let i = 0; i < data.length; i++) {
                data[i]["atp_country_count"] = ""
                data[i]["atp_supplier_count"] = ""
            }
        }
        else {
            // Re-calculate the "atp_count" (number of POIs) based on the sum across all countries
            // of the largest contributing spider in each area.
            // It might be that we move this calculation to the "insights" command at some point
            // but for now as it is here we preserve backwards compatibility.
            for (let i = 0; i < data.length; i++) {
                if (data[i]["atp_count"]) {
                    let new_atp_count = 0
                    Object.keys(data[i]["atp_splits"]).forEach(function (country) {
                        let country_max = 0
                        Object.keys(data[i]["atp_splits"][country]).forEach(function (spider) {
                            let count = data[i]["atp_splits"][country][spider]
                            if (count > country_max) {
                                country_max = count
                            }
                        })
                        new_atp_count += country_max
                    })
                    data[i]["atp_count"] = new_atp_count
                }
            }
        }
        // Old insights.json had attributes "nsi_brand" and "nsi_description".
        // These were misnamed and should in fact be references to Wikidata values.
        // Fix these, leaving an "nsi_brand" field which will be incorrect but
        // will be good in later insights.json.
        if ("nsi_description" in data[0]) {
            for (let i = 0; i < data.length; i++) {
                data[i]["q_title"] = data[i]["nsi_brand"]
                data[i]["q_description"] = data[i]["nsi_description"]
            }
        }
        dataTable.rows.add(insightsJson["data"])
        dataTable.draw()
    }

    function newInsightsJsonSelected() {
        loadInsights(document.getElementById('insight-select').value)
    }

    const URL_QUERY_PARAMS = getUrlQueryParams();
    const historyList = await fetchHistoryList()

    let dataTable = $("#spider-table").DataTable({
        lengthMenu: [10, 15, 20, 25, 50, 75, 100],
        pageLength: parseInt(URL_QUERY_PARAMS['page_length']) || 10,
        layout: {
            topStart: [
                'pageLength',
                { div: { className: 'insight-files' } },
            ],
            topEnd: 'search',
            bottomStart: 'info',
            bottomEnd: 'paging'
        },
        order: [[1, 'desc']],
        search: {search: URL_QUERY_PARAMS['search'] || ''},
        columnDefs: [
            { className: 'dt-center', targets: [0,5,6,7] },
            { className: 'dt-right', targets: [1,2,3,4] },
        ],
        columns: [
            {
                "title": "Q-code",
                "data": "code",
                "render": function (data, type, row, meta) {
                    if (type === 'display' && data.startsWith("Q")) {
                        data = '<a href="https://www.wikidata.org/wiki/' + data + '">' + data + '</a>';
                    }
                    return data;
                }
            },
            {"title": "OSM count", "data": "osm_count"},
            {"title": "ATP count", "data": "atp_count"},
            {
                "title": "Countries",
                "data": "atp_country_count",
                "render": function (data, type, row, meta) {
                    if (type === 'display' && row["atp_country_count"]) {
                        let dataUrl = URL.createObjectURL(
                            new Blob([JSON.stringify(row["atp_splits"], null, 6)], { type: "application/json" })
                        );
                        data = "<a target='_blank' href='"+dataUrl+"'>" + data + "</a>";
                    }
                    return data;
                }
            },
            {"title": "Spiders", "data": "atp_supplier_count"},
            {"title": "ATP brand", "data": "atp_brand"},
            {
                "title": "NSI brand",
                "data": "nsi_brand",
                "render": function (data, type, row, meta) {
                    if (type === 'display' && data) {
                        data = '<a href="https://nsi.guide/map.html?t=brands&tt=' + row["code"] + '">' + data + '</a>';
                    }
                    return data;
                }
            },
            {"title": "Q-title", "data": "q_title"},
            {
                "title": "Q-description",
                "data": "q_description",
                "render": function (data, type, row, meta) {
                    if (type === 'display') {
                        data = '<a href="https://www.wikidata.org/wiki/' + row["code"] + '">' + data + '</a>';
                    }
                    return data;
                }
            },
        ],
        "footerCallback": function (row, data, start, end, display) {
            let api = this.api()
            // Total up the numeric columns (all next to each)
            let columns = [1,2,3,4]
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
        "createdRow": function (row, data, dataIndex, cells) {
            // TODO: have an issue column and mark it if anything triggers in this method?
            if (!data['code'].startsWith("Q")) {
                // For sure we do not have a valid wikidata Q-code, highlight this line.
                $(row).css('background-color', 'Pink')
            }
            if (isInt(data['atp_count']) && data['osm_count'] > data['atp_count']) {
                // More data in OSM than ATP, highlight this line and the ATP count cell.
                $(cells[2]).css('color', 'Red')
                $(row).css('background-color', 'Pink')
            }
            if (data['atp_brand'] && data['nsi_brand'] && !data['nsi_brand'].startsWith(data['atp_brand'])) {
                // ATP brand name is only allowed to be a strict or leading match of the NSI brand name
                // If not then highlight the ATP brand name cell and the whole line.
                $(cells[5]).css('color', 'Red')
                $(row).css('background-color', 'Pink')
            }
            if (data['atp_count'] > 0 && !data['nsi_brand']) {
                // Something is in ATP but not in NSI, if it's valid then perhaps add to NSI?
                // Highlight the line as worthy of possible attention.
                $(row).css('background-color', 'Pink')
            }
        },
    });

    $('div.insight-files').html('<label class="insight-label">Select <select id="insight-select" aria-controls="spider-table" class></select> run</label>');
    let selectElement = document.getElementById('insight-select');
    for (let i = 0; i < historyList.length; i++) {
        selectElement.add(new Option(historyList[i]["name"], historyList[i]["insights_url"]));
    }
    selectElement.onchange = newInsightsJsonSelected;
    // Select the most recent run to display initially.
    await loadInsights(historyList[0]["insights_url"])

    // Attach URL update handlers
    attachDataTableUrlHandlers(dataTable, 10);
})();
