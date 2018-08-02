<?php
if (!file_exists(__DIR__ . "/config.php")) {
    throw new Exception("Create config.php file from config.php.dist");
}
include_once("config.php");

foreach (SPRINTS as $SPRINT) {
//    print_r($SPRINT);
    saveJsonForSprint($SPRINT);
}

function saveJsonForSprint($sprint)
{
    if (file_exists(__DIR__ . "/data/original/" . PROJECT . "-" . $sprint . ".json")) {
        $string = file_get_contents(__DIR__ . "/data/original/" . PROJECT . "-" . $sprint . ".json");
    } else {
        $ch = curl_init(str_replace(' ', '+', "https://jira-ise.server.traveljigsaw.com/rest/api/2/search?jql=project = " . PROJECT . " AND Sprint = \"" . $sprint . "\" AND resolution = Done ORDER BY priority DESC, updated DESC&expand=changelog&fields=id,key,status,issuetype,created,updated,priority,histories,summary,customfield_10602&maxResults=5000"));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Basic ' . base64_encode(USERNAME . ':' . PASSWORD)]);
        $string = curl_exec($ch);
        file_put_contents(__DIR__ . "/data/original/" . PROJECT . "-" . $sprint . ".json", $string);
        curl_close($ch);
    }

    date_default_timezone_set("Europe/London");
    //$string = file_get_contents("data/ACS-Sprint-15.json");
    $json_a = json_decode($string, true);

    $issues = $json_a['issues'];
    $result = [
        'issues' => [],
        'average' => [
            'tickets' => 0,
            'lifecycle' => 0,
            'efforts' => 0,
            'blocked' => [
                'lifecycle' => 0,
                'efforts' => 0
            ],
            'statuses' => []
        ],
        'storyPoints' => []
    ];
    foreach ($issues as $issue) {
        $resultIssue = [
            'key' => $issue['key'],
            'summary' => $issue['fields']['summary'],
            'type' => $issue['fields']['issuetype']['name'],
            'created' => strtotime($issue['fields']['created']),
            'changed' => strtotime($issue['fields']['created']),
            'storyPoints' => $issue['fields']['customfield_10602'],
            'statuses' => [],
            'lifecycle' => [
                'blocked' => []
            ],
            'efforts' => [
                'blocked' => []
            ],
            'blocked' => [
                'from' => 0,
                'till' => 0
            ]
        ];

        $blocked = false;
        foreach ($issue['changelog']['histories'] as $change) {
            $created = strtotime($change['created']);
            foreach ($change['items'] as $item) {
                if ($item['field'] == 'Flagged') {
                    $blocked = $item['toString'] == 'Impediment';
                    if ($blocked) {
                        $resultIssue['blocked']['from'] = $created;
                    } else {
                        $resultIssue['blocked']['till'] = $created;
                    }
                }
                if ($item['field'] == 'status') {
                    if (!isset($resultIssue['statuses'][$item['fromString']])) {
                        $resultIssue['statuses'][$item['fromString']] = ['blocked' => 0, 'total' => 0, 'lap' => 0];
                    }
                    $resultIssue['statuses'][$item['fromString']]['total'] += ($created - $resultIssue['changed']);
                    $resultIssue['statuses'][$item['fromString']]['lap']++;
                    if ($blocked) {
                        $resultIssue['statuses'][$item['fromString']]['blocked'] += ($created - $resultIssue['blocked']['from']);
                        $resultIssue['blockedFrom'] = $created;
                    } elseif ($resultIssue['blocked']['from'] == $resultIssue['changed']) {
                        $resultIssue['statuses'][$item['fromString']]['blocked'] += ($resultIssue['blocked']['till'] - $resultIssue['changed']);
                        $resultIssue['blockedFrom'] = $created;
                    }
                    $resultIssue['changed'] = $created;
                    $resultIssue['lastStatus'] = $item['fromString'];
                }
            }
        }

        if (!in_array($resultIssue['type'], ['Sub-task'])) {
            foreach ($resultIssue['statuses'] as $status => $time) {
                $resultIssue['statuses'][$status] = [
                    'total' => [
                        'seconds' => $time['total'],
                        'humanReadable' => secondsToTime($time['total'])
                    ],
                    'blocked' => [
                        'seconds' => $time['blocked'],
                        'humanReadable' => secondsToTime($time['blocked'])
                    ],
                    'lap' => $time['lap']
                ];
                if (in_array($status, LIFECYCLE_STATUSES)) {
                    $resultIssue['lifecycle']['seconds'] += $time['total'];
                    $resultIssue['lifecycle']['blocked']['seconds'] += $time['blocked'];
                    $resultIssue['lifecycle']['humanReadable'] = secondsToTime($resultIssue['lifecycle']['seconds']);
                    $resultIssue['lifecycle']['blocked']['humanReadable'] = secondsToTime($resultIssue['lifecycle']['blocked']['seconds']);
                }
                if (in_array($status, EFFORT_STATUSES)) {
                    $resultIssue['efforts']['seconds'] += $time['total'];
                    $resultIssue['efforts']['blocked']['seconds'] += $time['blocked'];
                    $resultIssue['efforts']['humanReadable'] = secondsToTime($resultIssue['efforts']['seconds']);
                    $resultIssue['efforts']['blocked']['humanReadable'] = secondsToTime($resultIssue['efforts']['blocked']['seconds']);
                }
                if (!isset($result['average']['statuses'][$status])) {
                    $result['average']['statuses'][$status] = [
                        'seconds' => 0,
                        'tickets' => 0,
                        'blocked' => [
                            'seconds' => 0
                        ],
                        'min' => $time['total'],
                        'max' => $time['total']
                    ];
                }
                $result['average']['statuses'][$status]['tickets']++;
                $result['average']['statuses'][$status]['seconds'] += $time['total'];
                $result['average']['statuses'][$status]['blocked']['seconds'] += $time['blocked'];
                if ($time < $result['average']['statuses'][$status]['min']) {
                    $result['average']['statuses'][$status]['min'] = $time['total'];
                }
                if ($time > $result['average']['statuses'][$status]['max']) {
                    $result['average']['statuses'][$status]['max'] = $time['total'];
                }
            }

            $result['average']['tickets']++;
            $result['average']['lifecycle'] += $resultIssue['lifecycle']['seconds'];
            $result['average']['blocked']['lifecycle'] += $resultIssue['lifecycle']['blocked']['seconds'];
            $result['average']['efforts'] += $resultIssue['efforts']['seconds'];
            $result['average']['blocked']['efforts'] += $resultIssue['efforts']['blocked']['seconds'];
        }
        $result['issues'][] = $resultIssue;
    }
    usort($result['issues'], function ($a, $b) {
        return $a['lifecycle']['second'] < $b['lifecycle']['seconds'];
    });

    $result['average']['lifecycle'] = [
        'seconds' => $result['average']['lifecycle'] / $result['average']['tickets'],
        'humanReadable' => secondsToTime($result['average']['lifecycle'] / $result['average']['tickets']),
        'blocked' => [
            'seconds' => $result['average']['blocked']['lifecycle'] / $result['average']['tickets'],
            'humanReadable' => secondsToTime($result['average']['blocked']['lifecycle'] / $result['average']['tickets']),
        ]
    ];

    $result['average']['efforts'] = [
        'seconds' => $result['average']['efforts'] / $result['average']['tickets'],
        'humanReadable' => secondsToTime($result['average']['efforts'] / $result['average']['tickets']),
        'blocked' => [
            'seconds' => $result['average']['blocked']['efforts'] / $result['average']['tickets'],
            'humanReadable' => secondsToTime($result['average']['blocked']['efforts'] / $result['average']['tickets']),
        ]
    ];

    foreach ($result['average']['statuses'] as $status => $time) {
        $result['average']['statuses'][$status] = [
            'tickets' => $time['tickets'],
            'humanReadable' => secondsToTime($time['seconds'] / $time['tickets']),
            'seconds' => $time['seconds'] / $time['tickets'],
            'blocked' => [
                'seconds' => $time['blocked']['seconds'] / $time['tickets'],
                'humanReadable' => secondsToTime($time['blocked']['seconds'] / $time['tickets']),
            ],
            'min' => secondsToTime($time['min']),
            'max' => secondsToTime($time['max'])
        ];
    }
    uasort($result['average']['statuses'], function ($a, $b) {
        return $a['seconds'] < $b['seconds'];
    });

    foreach ($result['issues'] as $issue) {
        if (in_array($issue['type'], ['Sub-task'])) {
            continue;
        }
        if (!isset($result['storyPoints'][(int)$issue['storyPoints']])) {
            $result['storyPoints'][(int)$issue['storyPoints']] = [];
        }
        $result['storyPoints'][(int)$issue['storyPoints']]['amount']++;
        $result['storyPoints'][(int)$issue['storyPoints']]['seconds'] += $issue['lifecycle']['seconds'];
    }

    foreach ($result['storyPoints'] as $storyPoint => $point) {
        if ($point['amount'] < 1) {
            var_dump($result['storyPoints']);
        }
        $result['storyPoints'][$storyPoint]['average'] = [
            'time' => $point['seconds'] / $point['amount'],
            'humanReadable' => secondsToTime($point['seconds'] / $point['amount'])
        ];
    }

    ksort($result['storyPoints']);

    file_put_contents(__DIR__ . "/data/" . PROJECT . "-" . $sprint . "-a.json", json_encode($result));
    print_r("Saved " . PROJECT . "-" . $sprint . "-a.json" . PHP_EOL);
}

function secondsToTime($inputSeconds)
{

    $secondsInAMinute = 60;
    $secondsInAnHour = 60 * $secondsInAMinute;
    $secondsInADay = 24 * $secondsInAnHour;

    // extract days
    $days = floor($inputSeconds / $secondsInADay);

    // extract hours
    $hourSeconds = $inputSeconds % $secondsInADay;
    $hours = floor($hourSeconds / $secondsInAnHour);

    // extract minutes
    $minuteSeconds = $hourSeconds % $secondsInAnHour;
    $minutes = floor($minuteSeconds / $secondsInAMinute);

    // extract the remaining seconds
    $remainingSeconds = $minuteSeconds % $secondsInAMinute;
    $seconds = ceil($remainingSeconds);

    // return the final array
    $obj = array(
        'd' => (int)$days,
        'h' => (int)$hours,
        'm' => (int)$minutes,
        's' => (int)$seconds,
    );
    return $obj['d'] . " days, " . $obj['h'] . " hours";
}