
// Return a list of history entries, sorted by most recent first.
async function fetchHistoryList() {
    // The default configuration is the direct ATP history.json
    let my_histories = [
        {
            "name": "ATP",
            "url": "https://data.alltheplaces.xyz/runs/history.json",
        },
    ]
    try {
        // Try and load a config.json file from the serving context. If present then this
        // will override the default configuration above.
        const response = await window.fetch('./config.json')
        if (response.status === 200) {
            let json_response = await response.json()
            my_histories = json_response["histories"]
        }
    } catch (error) {
        // We catch the exception and proceed here as it enables the HTML to be used by the browser
        // on the local file system without crashing out. Handy for development sometimes.
        console.error(error)
    }
    let history_runs = []
    for (let i = 0; i < my_histories.length; i++) {
        // Now for each history list go and retrieve the full list and filter down to those with
        // an "insights" URL.
        let history_response = await window.fetch(my_histories[i].url)
        if (history_response.status === 200) {
            let history_json_response = await history_response.json()
            for (let j = 0; j < history_json_response.length; j++) {
                let run_data = history_json_response[j]
                // It's better that URLs in the JSON are relative as that helps when we
                // may need to move things around etc, so cope with it.
                for (const field of ["insights_url", "output_url", "stats_url"]) {
                    if (field in run_data) {
                        // Make URL absolute with respect to serving history.json
                        if (!run_data[field].startsWith("http")) {
                            run_data[field] = new URL(run_data[field], history_response.url).toString()
                        }
                    }
                }
                // It's good to create expected fields in the JSON, some old runs did not have these!
                for (const field of ["size_bytes", "spiders", "stats_url", "total_lines"]) {
                    if (! (field in run_data)) {
                        run_data[field] = null
                    }
                }
                run_data["name"] = run_data["start_time"].replace(/T.*$/,"") + " (" + my_histories[i].name + ")"
                history_runs.push(run_data)
            }
        }
    }
    // Sort into most recent first order.
    history_runs.sort((a, b) => (a["run_id"] < b["run_id"]) ? 1 : ((b["run_id"] < a["run_id"]) ? -1 : 0))
    return history_runs
}
