const project = 'CHI';
const sprintNames = [
    "Sprint 1",
    "Sprint 2",
    "Sprint 3",
    "Sprint 4",
    "Sprint 5",
    "Sprint 6"/*,
    "Sprint 16",
    "Sprint 17",
    "Sprint 18"*/
];
let sprintsArr = [];
let currentSprint = null;
let sprint = null;

document.addEventListener("DOMContentLoaded", function () {
    Promise.all(sprintNames.map(name => fetch('data/' + project + '-' + name + '-a.json').then(response => Promise.resolve(response.json())))).then(
        result => {
             sprintsArr = result.map((sprint, i) => {
                sprint.key = sprintNames[i].replace("Sprint ", "");
                return sprint;
            });

            currentSprint = sprintsArr.length - 1;
            sprint = sprintsArr[currentSprint];

            let columns = [
                ['laps'].concat(sprintsArr.map(function (sprint) {
                    return (sprint.issues.reduce(function (sum, issue) {
                        return valuesToArray(issue.statuses).reduce(function (prev, curr) {
                            return prev < curr.lap ? curr.lap : prev
                        }, 0) + sum
                    }, 0) / sprint.issues.length).toFixed(2)
                })),
                ['story points'].concat(sprintsArr.map(function (sprint) {
                    return sprint.issues.reduce(function (prev, curr) {
                        return prev + curr.storyPoints;
                    }, 0)
                })),
                ['efforts'].concat(sprintsArr.map(function (sprint) {
                    return sprint.average.efforts.seconds
                })),
                ['efforts blocked'].concat(sprintsArr.map(function (sprint) {
                    return sprint.average.efforts.blocked.seconds
                })),
                ['cycletime'].concat(sprintsArr.map(function (sprint) {
                    return sprint.average.lifecycle.seconds
                })),
                ['cycletime blocked'].concat(sprintsArr.map(function (sprint) {
                    return sprint.average.lifecycle.blocked.seconds
                })),
                ['bug'].concat(sprintsArr.map(function (sprint) {
                    return sprint.issues.reduce(function (prev, curr) {
                        return curr.type === 'Bug' ? prev + 1 : prev;
                    }, 0)
                })),
                ['task'].concat(sprintsArr.map(function (sprint) {
                    return sprint.issues.reduce(function (prev, curr) {
                        return curr.type === 'Task' ? prev + 1 : prev;
                    }, 0)
                })),
                ['story'].concat(sprintsArr.map(function (sprint) {
                    return sprint.issues.reduce(function (prev, curr) {
                        return curr.type === 'Story' ? prev + 1 : prev;
                    }, 0)
                })),
            ];
            c3.generate({
                bindto: '#cycle_time',
                data: {
                    columns: columns,
                    type: "spline",
                    hide: ['laps', 'efforts blocked', 'cycletime blocked'],
                    types: {
                        'efforts blocked': 'area-spline',
                        'cycletime blocked': 'area-spline',
                        bug: 'bar',
                        task: 'bar',
                        story: 'bar'
                    },
                    colors: {
                        bug: 'rgba(229, 73, 58, 0.5)',
                        task: 'rgba(75, 173, 232, 0.5)',
                        story: 'rgba(98, 186, 60, 0.5)'
                    },
                    axes: {
                        efforts: 'y',
                        cycletime: 'y',
                        bug: 'y2',
                        task: 'y2',
                        story: 'y2',
                        "story points": 'y2',
                        'laps': 'y2'
                    }
                },
                axis: {
                    y: {
                        label: {
                            text: 'time',
                            position: 'outer-middle'
                        },
                        tick: {
                            format: secondsToTime
                        }
                    },
                    y2: {
                        show: true,
                        tick: {
                            format: function (val) {
                                return Number.isInteger(val) ? val : val.toFixed(2)
                            }
                        }
                    },
                    x: {
                        type: 'category',
                        tick: {
                            fit: true,
                            format: function (o) {
                                return "Sprint " + sprintsArr[o].key;
                            }
                        }
                    }
                }
            });


            c3.generate({
                bindto: '#statuses',
                data: {
                    json: valuesToArray(sprint.average.statuses),
                    keys: {
                        value: ["seconds", "tickets"]
                    },
                    names: {
                        seconds: 'average time spent'
                    },
                    axes: {
                        seconds: 'y',
                        tickets: 'y2'
                    },
                    type: 'bar',
                    onclick: function (e) {
                        console.log(arguments)
                    }
                },
                axis: {
                    y: {
                        label: {
                            text: 'time',
                            position: 'outer-middle'
                        },
                        tick: {
                            format: secondsToTime
                        }
                    },
                    y2: {
                        show: true
                    },
                    x: {
                        type: 'category',
                        tick: {
                            fit: true,
                            count: Object.keys(sprint.average.statuses).length,
                            format: function (o) {
                                return valuesToArray(sprint.average.statuses)[o].key;
                            }
                        }
                    }
                }
            });

            let issuesChart = createIssuesGraph();

            loadIssuesGraph(issuesChart);

            document.getElementById('show_cycletime').addEventListener('click', function () {
                issuesChart.hide(["Requires Analysis", "Discovery", "Ready for 3 Amigos", "New Ideas", "Ideation", "No Longer Required", "Backlog"]);

            });
            document.getElementById('show_all_statuses').addEventListener('click', function () {
                issuesChart.show(statuses);
            });

            let storyPointsGraph = createStoryPointsGraph();

            loadStoryPointsGraph(storyPointsGraph, getCurrentSprint());

            let prevSprintButton = document.getElementById('prev_sprint');
            let nextSprintButton = document.getElementById('next_sprint');

            prevSprintButton.addEventListener('click', function () {
                currentSprint--;
                loadStoryPointsGraph(storyPointsGraph, getCurrentSprint());
                loadIssuesGraph(issuesChart, getCurrentSprint());
                if (currentSprint === 0) {
                    prevSprintButton.disabled = true;
                }
                nextSprintButton.disabled = false;
            });

            nextSprintButton.addEventListener('click', function () {
                currentSprint++;
                loadStoryPointsGraph(storyPointsGraph, getCurrentSprint());
                loadIssuesGraph(issuesChart, getCurrentSprint());
                if (currentSprint === sprintsArr.length - 1) {
                    nextSprintButton.disabled = true;
                }
                prevSprintButton.disabled = false;
            });

        }, err => {
            console.error(err);
        }
    );
});

function createIssuesGraph() {
    return c3.generate({
        bindto: '#issues',
        data: {
            type: 'bar',
            columns: []
        },
        axis: {
            y: {
                label: {
                    text: 'time',
                    position: 'outer-middle'
                },
                tick: {
                    format: secondsToTime
                }
            },
            x: {
                type: 'category',
                tick: {
                    fit: true,
                    format: formatIssueX
                }
            }
        },
        tooltip: {
            format: {
                title: issueTooltip
            }
        }
    });
}

function createStoryPointsGraph() {

    return c3.generate({
        bindto: '#story_points',
        data: {
            columns: [],
            axes: {
                tickets: 'y2',
                'average time': 'y'
            },
            types: {
                'average time': 'spline',
                'tickets': 'bar'
            },
            onclick: onStoryPointsDataClick
        },
        bar: {
            width: {
                ratio: 0.2 // this makes bar width 50% of length between ticks
            }
        },
        line: {
            connectNull: true
        },
        axis: {
            y: {
                label: {
                    text: 'time',
                    position: 'outer-middle'
                },
                tick: {
                    format: secondsToTime
                }
            },
            y2: {
                label: {
                    text: 'tickets'
                },
                show: true
            },
            x: {
                label: {
                    text: 'story points'
                },
                tick: {
                    fit: true,
                    values: [0, 1, 2, 3, 5, 8]
                }
            }
        },
        tooltip: {
            format: {
                title: function (d) {
                    return d + ' story points';
                }
            }
        }
    });
}

function onStoryPointsDataClick(e) {
    console.log(e)
}

function loadStoryPointsGraph(storyPointsGraph, sprint) {
    let storyPointsArray = [];
    valuesToArray(sprint.storyPoints).forEach(a => {
        storyPointsArray[a.key] = a;
    });
    for (let i = 0; i < storyPointsArray.length; i++) {
        storyPointsArray[i] = storyPointsArray[i] ? storyPointsArray[i] : {amount: null, average: {time: null}};
    }
    storyPointsGraph.load({
        columns: [
            ['average time'].concat(storyPointsArray.map(sp => sp.average.time)),
            ['tickets'].concat(storyPointsArray.map(sp => sp.amount))
        ]
    });
}

function loadIssuesGraph(issuesGraph) {
    let sprint = getCurrentSprint();
    let statuses = valuesToArray(getCurrentSprint().average.statuses).map(function (s) {
        return s.key
    });
    let data = [];
    statuses.forEach(function (s) {
        data.push([s].concat(sprint.issues
            .filter(i => i.type != "Sub-task")
            .map(i => i.statuses.hasOwnProperty(s) ? i.statuses[s].total.seconds : 0)));
    });
    console.log(data);
    issuesGraph.unload();
    issuesGraph.load({
        columns: data
    });
    issuesGraph.groups([statuses]);
}


function issueTooltip(o) {
    return getCurrentSprint().issues[o]?getCurrentSprint().issues[o].summary:"";
}

function formatIssueX(o) {
    return getCurrentSprint().issues[o]?getCurrentSprint().issues[o].key:o;
}

function getCurrentSprint() {
    return sprintsArr[currentSprint];
}
