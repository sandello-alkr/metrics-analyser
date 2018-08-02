document.addEventListener("DOMContentLoaded", function () {
    fetch('py/data/speed.json')
        .then(response => response.json())
        .then(json => {
            productivityChart(json);
            // speedChart(json);
            cycleTime(json);
        })
        .catch(err => console.error(err));
    fetch('py/data/started_vs_finished.json')
        .then(response => response.json())
        .then(json => {
            startedVsFinished(json);
        })
        .catch(err => console.error(err));
    fetch('py/data/defect_age.json')
        .then(response => response.json())
        .then(json => {
            defectAge(json);
        })
        .catch(err => console.error(err));
    fetch('py/data/stories_age.json')
        .then(response => response.json())
        .then(json => {
            storiesAge(json);
        })
        .catch(err => console.error(err));
});

function productivityChart(json) {
    let data = Array();
    let color = {
        'Bug': 'rgba(255, 40, 40, 0.5)',
        'Story': 'rgba(98, 186, 60, 0.5)',
        'Task': 'rgba(75, 173, 232, 0.5)'
    };
    json.columns.forEach((issueType, i) => {
        data.push({
            x: Object.values(json.index).map(time => new Date(time * 1)),
            y: Object.values(json.data).map(data => data[i] ? data[i].amount : 0),
            marker: {color: color[issueType]},
            name: issueType,
            type: 'bar'
        })
    });

    let layout = {
        title: 'How much we deliver (velocity)',
        xaxis: {
            tickvals: Object.values(json.index).map(time => new Date(time * 1)),
            tickformat: "%d %b %y"
        },
        yaxis: {
            dtick: 1,
        },
        barmode: 'stack'
    };

    Plotly.newPlot('productivity', data, layout);
}

function speedChart(json) {
    let data = Array();
    let color = {
        'Bug': 'rgba(255, 40, 40, 0.5)',
        'Story': 'rgba(98, 186, 60, 0.5)',
        'Task': 'rgba(75, 173, 232, 0.5)'
    };
    let max = 0;
    let x = Object.values(json.index).map(time => new Date(time * 1));
    let y = {};

    json.columns.forEach((issueType, i) => {
        x = Array();
        y[issueType] = Object.values(json.data).reduce((prev, curr, timeIndex) => {
            if (curr[i] && curr[i].amount > 0) {
                for (let j = 0; j < curr[i].amount; j++) {
                    x.push(json.index[timeIndex]);
                }
            }
            return prev.concat(curr[i] ? curr[i].timeTotal.raw : []);
        }, []);
        data.push({
            x: x.map(time => new Date(time)),
            y: y[issueType],
            marker: {color: color[issueType]},
            name: issueType,
            type: 'box'
        });
        max = Math.max(Math.max.apply(null, y[issueType]), max);
    });
    let yValues = range(max, max / 10);
    let yTexts = formatY(yValues);
    let layout = {
        title: 'How fast we deliver',
        margin: {
            l: 120
        },
        xaxis: {
            tickvals: x.map(time => new Date(time)),
            tickformat: "%d %b %y"
        },
        yaxis: {
            tickvals: yValues,
            ticktext: yTexts,
            tickangle: 0
        },
        boxmode: 'group'
    };

    Plotly.newPlot('speed', data, layout);
}

function cycleTime(json) {
    let data = Array();
    let color = {
        'Bug': 'rgba(255, 40, 40, 0.5)',
        'Story': 'rgba(98, 186, 60, 0.5)',
        'Task': 'rgba(75, 173, 232, 0.5)'
    };
    let max = 0;
    let x = Object.values(json.index).map(time => new Date(time * 1));

    function cycleTimeDataProvider(issueType, i, kind, property, dash = false) {
        let y = Object.values(json.data).map(data => (data[i] && data[i].amount > 0) ? data[i][property].median : 0);
        let error = Object.values(json.data).map(data => data[i] ? data[i][property].deviation : 0);
        data.push({
            x: x.map(time => new Date(time)),
            y: y,
            text: y.map((time, i) => secondsToTime(time) + " ± " + secondsToTime(error[i])),
            error_y: {
                type: 'data',
                array: error,
                color: color[issueType],
            },
            hoverinfo:"text+name",
            marker: {color: color[issueType]},
            name: issueType + kind,
            type: 'scatter',
            line: {
                shape: 'spline',
                dash: dash ? 'dashdot' : 'solid'
            },
            connectgaps: false
        });
        max = Math.max(Math.max.apply(null, y), max);
    }

    json.columns.forEach((issueType, i) => {
        cycleTimeDataProvider(issueType, i, ' total', 'timeTotal');
        cycleTimeDataProvider(issueType, i, ' in work', 'timeInProgress');
        cycleTimeDataProvider(issueType, i, ' blocked', 'timeBlocked', true);
    });

    let yValues = range(max, max / 10);
    let yTexts = formatY(yValues);
    let layout = {
        title: 'How much time does it takes (cycletime)',
        xaxis: {
            tickvals: x.map(time => new Date(time)),
            tickformat: "%d %b %y"
        },
        yaxis: {
            tickvals: yValues,
            ticktext: yTexts,
        },
        margin: {
            l: 120
        }
    };

    Plotly.newPlot('cycle_time', data, layout);
}

function startedVsFinished(json) {
    let result = Array();
    let types = Array();
    let color = {
        'bugs': 'rgba(255, 40, 40, 0.5)',
        'stories': 'rgba(98, 186, 60, 0.5)',
        'tasks': 'rgba(75, 173, 232, 0.5)'
    };
    let base = {
        'bugs': 0,
        'stories': 0,
        'tasks': 0
    };
    let bases = Array();
    json.index.forEach((time, i) => {
        json.columns.forEach((type, j) => {
            let generalType = type.split(' ')[0];
            if (!types[generalType]) {
                types[generalType] = Array();
            }
            if (!types[generalType][time]) {
                types[generalType][time] = {};
            }
            let val;
            if (type.split(' ')[1] === 'started') {
                types[generalType][time]['val'] = json.data[i][j];
                val = json.data[i][j];
            } else {
                types[generalType][time]['base'] = -json.data[i][j];
                val = -json.data[i][j];
            }
            base[generalType] += val;
            if (!bases[i]) {
                bases[i] = Array();
            }
            if (bases[i][generalType]) {
                bases[i][generalType] = bases[i][generalType] + val;
            } else if (bases[i - 1] && bases[i - 1][generalType]) {
                bases[i][generalType] = bases[i - 1][generalType] + val;
            } else {
                bases[i][generalType] = val;
            }
        })
    });
    for (let type in types) {
        result.push({
            type: 'bar',
            name: type,
            x: Object.keys(types[type]).map(time => new Date(time * 1)),
            y: Object.values(types[type]).map(o => o.val - o.base),
            base: Object.values(types[type]).map(o => o.base),
            text: Object.values(types[type]).map(o => o.val + " " + type + " started; " + (-o.base) + " " + type + " finished"),
            hoverinfo:"text",
            marker: {color: color[type.split(' ')[0]]},
        })
    }


    ['bugs', 'tasks', 'stories'].forEach((type) => {
        result.push({
            type: 'scatter',
            name: type + ' in progress',
            x: json.index.map(time => new Date(time * 1)),
            y: bases.map(o => o[type]),
            marker: {color: color[type]},
            hoverinfo: 'none',
        });
    });

    let layout = {
        title: 'How much we deliver VS work in progress (WIP)',
        xaxis: {
            tickvals: json.index.map(time => new Date(time * 1)),
            tickformat: "%d %b %y"
        },
        yaxis: {
            dtick: 1,
        },
        bargap : 0.5
    };

    Plotly.newPlot('started_vs_finished', result, layout);
}

function defectAge(json) {
    let data = Array();
    let color = {
        'Bug': 'rgba(255, 40, 40, 0.5)',
        'Story': 'rgba(98, 186, 60, 0.5)',
        'Task': 'rgba(75, 173, 232, 0.5)'
    };
    let x = Object.values(json.index).map(time => new Date(time * 1));
    let y = Object.values(json.data).map(data => data[2] ? data[2] / 1000 : 0);
    let error = Object.values(json.data).map(data => data[3] ? data[3] / 1000 : 0);
    data.push({
        x: x.map(time => new Date(time)),
        y: y,
        text: y.map((time, i) => secondsToTime(time) + " ± " + secondsToTime(error[i])),
        error_y: {
            type: 'data',
            array: error,
            color: color['Bug'],
        },
        hoverinfo:"text+name",
        marker: {color: color['Bug']},
        name: 'Defect age',
        type: 'scatter',
        line: {
            shape: 'spline',
            dash: 'solid'
        },
        connectgaps: false
    });

    let defectsPerWeek = Object.values(json.data).map(data => data[0] ? data[0] : 0);
    data.push({
        x: x.map(time => new Date(time)),
        y: defectsPerWeek,
        // hoverinfo:"text+name",
        marker: {color: color['Bug']},
        name: 'Defects number',
        type: 'bar',
        yaxis: 'y2',
    });

    let max = Math.max.apply(null, Object.values(json.data).map(data => Math.max.apply(null, data))) / 1000;
    let yValues = range(max, max / 10);
    let yText = formatY(yValues);
    let layout = {
        title: 'Quality (defect age)',
        xaxis: {
            tickvals: x.map(time => new Date(time)),
            tickformat: "%d %b %y"
        },
        yaxis: {
            tickvals: yValues,
            ticktext: yText
        },
        yaxis2: {
            overlaying: 'y',
            side: 'right',
            dtick: 1
        },
        margin: {
            l: 120
        },
        bargap : 0.5
    };

    Plotly.newPlot('defect_age', data, layout);
}

function storiesAge(json) {
    let data = Array();
    let color = {
        'lead': 'rgba(98, 186, 60, 0.3)',
        'cycle': 'rgba(98, 186, 60, 0.7)'
    };
    let x = Object.values(json.index).map(time => new Date(time * 1));
    let cycleTime = Object.values(json.data).map(data => data[2] ? data[2] / 1000 : 0);
    let cycleTimeMean = Object.values(json.data).map(data => data[1] ? data[1] / 1000 : 0);
    let cycleTimeError = Object.values(json.data).map(data => data[3] ? data[3] / 1000  : 0);
    let leadTime = Object.values(json.data).map(data => data[5] ? data[5] / 1000 : 0);
    let leadTimeMean = Object.values(json.data).map(data => data[4] ? data[4] / 1000 : 0);
    let leadTimeError = Object.values(json.data).map(data => data[6] ? data[6] / 1000 : 0);
    let leadTimeErrorUp = Object.values(json.data).map(data => data[6] ? (data[6]+data[4]-data[5]) / 1000 : 0);
    let leadTimeErrorDown = Object.values(json.data).map(data => data[6] ? (data[6]-data[4]+data[5]) / 1000 : 0);

    data.push({
        x: x.map(time => new Date(time)),
        y: cycleTime,
        text: cycleTime.map((time, i) => secondsToTime(time)),
        hoverinfo:"text+name",
        marker: {color: color['cycle']},
        name: 'Median cycle time',
        type: 'scatter',
        line: {
            shape: 'spline',
            dash: 'dot'
        },
        connectgaps: false
    });
    data.push({
        x: x.map(time => new Date(time)),
        y: cycleTimeMean,
        text: cycleTimeMean.map((time, i) => secondsToTime(time) + " ± " + secondsToTime(cycleTimeError[i])),
        error_y: {
            type: 'data',
            array: cycleTimeError,
            color: color['cycle'],
        },
        hoverinfo:"text+name",
        marker: {color: color['cycle']},
        name: 'Average cycle time',
        type: 'scatter',
        line: {
            shape: 'spline',
            dash: 'solid'
        }
    });
    data.push({
        x: x.map(time => new Date(time)),
        y: leadTime,
        text: leadTime.map((time, i) => secondsToTime(time)),
        hoverinfo:"text+name",
        marker: {color: color['lead']},
        name: 'Median lead time',
        type: 'scatter',
        line: {
            shape: 'spline',
            dash: 'dot'
        }
    });
    data.push({
        x: x.map(time => new Date(time)),
        y: leadTimeMean,
        text: leadTimeMean.map((time, i) => secondsToTime(time) + " ± " + secondsToTime(leadTimeError[i])),
        error_y: {
            type: 'data',
            array: leadTimeError,
            color: color['lead'],
        },
        hoverinfo:"text+name",
        marker: {color: color['lead']},
        name: 'Average lead time',
        type: 'scatter',
        line: {
            shape: 'spline',
            dash: 'solid'
        }
    });


    let defectsPerWeek = Object.values(json.data).map(data => data[0] ? data[0] : 0);
    data.push({
        x: x.map(time => new Date(time)),
        y: defectsPerWeek,
        visible: 'legendonly',
        // hoverinfo:"text+name",
        marker: {color: color['lead']},
        name: 'Stories number',
        type: 'bar',
        yaxis: 'y2',
    });

    let max = Math.max.apply(null, Object.values(json.data).map(data => Math.max.apply(null, data))) / 1000;
    let yValues = range(max, max / 10);
    let yText = formatY(yValues);
    let layout = {
        title: 'Speed (stories age)',
        xaxis: {
            tickvals: x.map(time => new Date(time)),
            tickformat: "%d %b %y"
        },
        yaxis: {
            tickvals: yValues,
            ticktext: yText
        },
        yaxis2: {
            overlaying: 'y',
            side: 'right',
            dtick: 1
        },
        margin: {
            l: 120
        },
        bargap : 0.5
    };

    Plotly.newPlot('stories_age', data, layout);
}

function range(size, step, startAt = 0) {
    return [...Array(Math.ceil(size / step) + 1).keys()].map(i => i * step + startAt);
}

function formatY(yValues) {
    return yValues.map(time => secondsToTime(time));
}
