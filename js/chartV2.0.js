document.addEventListener("DOMContentLoaded", function () {
    fetch('py/data/productivity.json')
        .then(response => response.json())
        .then(json => {
            prod = json;
            productivityChart(json);
            speedChart(json);

        })
        .catch(err => console.error(err));
});

function productivityChart(json) {
    c3.generate({
        bindto: '#productivity',
        data: {
            x: 'x',
            columns: [
                ['x'].concat(Object.keys(json.key).map(time => time * 1)),
                ['bugs'].concat(Object.values(json.bugs)),
                ['tasks'].concat(Object.values(json.tasks)),
                ['bugs'].concat(Object.values(json.bugs)),
                ['stories'].concat(Object.values(json.stories)),
                ['total'].concat(Object.values(json.total))
            ],
            type: "bar",
            types: {
                total: 'line'
            },
            colors: {
                bugs: 'rgba(255, 40, 40, 0.5)',
                tasks: 'rgba(75, 173, 232, 0.5)',
                stories: 'rgba(98, 186, 60, 0.5)'
            },
            groups: [['bugs', 'tasks', 'stories']]
        },
        axis: {
            x: {
                type: 'timeseries',
                tick: {
                    format: function (timestamp) {
                        return moment(timestamp).format("YYYY-MM-DD");
                    }
                }
            }
        }
    });
}

function speedChart(json) {
    console.log(['time in progress deviation'].concat(Object.values(json.timeInProgressDeviation).map(v => v * 1)));
    c3.generate({
        bindto: '#speed',
        data: {
            x: 'x',
            columns: [
                ['x'].concat(Object.keys(json.key).map(time => time * 1)),
                ['timeInProgressMean'].concat(Object.values(json.timeInProgressMean)),
                ['time in progress deviation'].concat(Object.values(json.timeInProgressDeviation).map(v => v * 1)),
                ['timeTotalMean'].concat(Object.values(json.timeTotalMean))
            ],
            type: "line",
            types: {
                'time in progress deviation': 'bar'
            }
        },
        bar: {
          zerobased: false
        },
        axis: {
            x: {
                type: 'timeseries',
                tick: {
                    format: function (timestamp) {
                        return moment(timestamp).format("YYYY-MM-DD");
                    }
                }
            },
            y: {
                label: {
                    text: 'time',
                    position: 'outer-middle'
                },
                tick: {
                    format: secondsToTime
                }
            }
        }

    });
}
