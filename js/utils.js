function secondsToTime(seconds) {
    let numdays = Math.floor(seconds / 86400);
    let numhours = Math.floor((seconds % 86400) / 3600);
    return numdays + " days " + numhours + " hours";
}

function valuesToArray(obj) {
    return Object.keys(obj).map(function (key) { obj[key]['key'] = key; return obj[key]; });
}

function hideIssue(index, chart) {
    chart.load({
        columns: chart.data().map(function(st) { st.values = st.values.filter(function(val) { return val.index != index;}); return st;}),
        type: 'bar',
        groups: [
            statuses
        ],
        onclick: function(e) { hideIssue(e.index, chart) }
    })
}
