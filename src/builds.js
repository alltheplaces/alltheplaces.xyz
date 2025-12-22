import {fetchHistoryList, getUrlQueryParams, attachDataTableUrlHandlers} from './shared.js';
import $ from "jquery";
import DataTable from 'datatables.net-dt';

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

(async function () {
    const URL_QUERY_PARAMS = getUrlQueryParams();
    const data = await fetchHistoryList();

// Render with datatable
    let dataTable = $("#spider-table").DataTable({
        data,
        lengthMenu: [
            [10, 15, 20, 25, 50, 75, 100, -1],
            [10, 15, 20, 25, 50, 75, 100, "All"],
        ],
        pageLength: parseInt(URL_QUERY_PARAMS['page_length']) || 10,
        order: [[0, 'desc']],
        search: {search: URL_QUERY_PARAMS['search'] || ''},
        columns: [
            {"title": "Run", "data": "name"},
            {
                "title": "Run statistics",
                "data": "stats_url",
                "render": function (data, type, row, meta) {
                    if (type === 'display') {
                        if (data) {
                            return '<a href="' + data + '">Summary</a>'
                        }
                        return ""
                    }
                    return data;
                }
            },
            {
                "title": "Spider count",
                "data": "spiders",
                "render": function (data, type, row, meta) {
                    if (type === 'display' && data) {
                        data = data.toLocaleString("us-US")
                    }
                    return data;
                }
            },
            {
                "title": "Feature count",
                "data": "total_lines",
                "render": function (data, type, row, meta) {
                    if (type === 'display' && data) {
                        data = data.toLocaleString("us-US")
                    }
                    return data;
                }
            },
            {
                "title": "Download features",
                "data": "size_bytes",
                "render": function (data, type, row, meta) {
                    if (type === 'display') {
                        if (data && (data > 0)) {
                            let text = "Download " + formatBytes(data)
                            return '<a href="' + row["output_url"] + '">' + text + '</a>'
                        }
                        return ""
                    }
                    return data;
                }
            },
        ],
        columnDefs: [
            {className: 'dt-center', targets: [1, 4]},
            {className: 'dt-right', targets: [2, 3]},
        ],
        "footerCallback": function (row, data, start, end, display) {
            let api = this.api()
            // Total up the numeric columns (all next to each)
            let columns = [3]
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
    });

    // Attach URL update handlers
    attachDataTableUrlHandlers(dataTable, 10);
})();
