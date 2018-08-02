import requests
import base64
import config
import json
from pprint import pprint
import pandas as pd
import dateutil
import datetime

headers = {'Authorization': 'Basic ' + base64.b64encode((config.AUTH['username'] + ':' + config.AUTH['password']).encode('ascii')).decode('utf-8')}
jql = 'project = ' + config.SETTINGS['project'] + ((" and Sprint = " + config.SETTINGS['sprint']) if 'sprint' in config.SETTINGS else "") + " AND status not in (Backlog, Bin) ORDER BY priority DESC, updated DESC&expand=changelog&fields=id,key,status,issuetype,created,updated,priority,histories,summary,customfield_10602&maxResults=5000"
uri = config.SETTINGS['host'] + '/rest/api/2/search?jql=' + jql
response = requests.get(uri, headers=headers)
f = open("data/response.json", "w")
pprint(response)
f.write(json.dumps(response.json()))


# frequency = "1W"
# def start_date(startTime):
# 	return pd.Timestamp(startTime - datetime.timedelta(days=(startTime.weekday() + 1))).replace(tzinfo=datetime.timezone.utc)
# def add_period(start):
# 	return start + datetime.timedelta(days=7)


frequency = "1M"
def start_date(start_time):
    return pd.Timestamp(start_time - datetime.timedelta(days=(start_time.date().day + 1))).replace(tzinfo=datetime.timezone.utc)
def add_period(start):
    return pd.Timestamp((start.date().replace(day=1) + datetime.timedelta(days=32)).replace(day=1)).replace(tzinfo=datetime.timezone.utc)

with open('data/response.json') as f:
    data = json.load(f)

inProgress = ['In Progress','Code Review','Test']

statuses = set()
df = pd.DataFrame()
byStatus = pd.DataFrame()
for issue in data['issues']:
    now = datetime.datetime.now(datetime.timezone.utc)
    timeInProgress = datetime.timedelta(0)
    blockTime = datetime.timedelta(0)
    startTime = None
    liveTime = None
    blockStart = None
    doneTime = None
    timeTotal = None
    inProgressStart = None
    statusesData = dict()
    for change in issue['changelog']['histories']:
        for item in change['items']:
            if item['field'] == 'status':
                time = dateutil.parser.parse(change['created'])
                statuses.add(item['toString'])
                statuses.add(item['fromString'])

                # Calculate time spent in status
                if item['fromString'] not in statusesData:
                    statusesData[item['fromString']] = {}
                if 'start' in statusesData[item['fromString']]:
                    if 'total' not in statusesData[item['fromString']]:
                        statusesData[item['fromString']]['total'] = time - statusesData[item['fromString']]['start']
                    else:
                        statusesData[item['fromString']]['total'] += time - statusesData[item['fromString']]['start']
                    del statusesData[item['fromString']]['start']
                else:
                    statusesData[item['fromString']]['total'] = time - dateutil.parser.parse(issue['fields']['created'])

                if item['toString'] != 'Done':
                    if item['toString'] not in statusesData:
                        statusesData[item['toString']] = {}
                    statusesData[item['toString']]['start'] = time

                # Calculate cycle time, WIP time, etc.
                if item['toString'] in inProgress and item['fromString'] not in inProgress:
                    inProgressStart = time
                    if startTime is None:
                        startTime = time
                if item['toString'] not in inProgress and item['fromString'] in inProgress:
                    timeInProgress += time - inProgressStart
                if item['toString'] == 'Live':
                    liveTime = time
                if item['toString'] == 'Done':
                    doneTime = time
                    timeTotal = (time - dateutil.parser.parse(issue['fields']['created'])).total_seconds()
            if item['field'] == 'Flagged':
                if item['toString'] == 'Impediment':
                    blockStart = time
                else:
                    blockTime += time - blockStart
    df = df.append(pd.DataFrame(
        {
            "key": issue['key'],
            "type": issue['fields']['issuetype']['name'],
            "timeInProgress": timeInProgress.total_seconds(),
            "timeTotal": timeTotal,
            "doneTime": doneTime,
            "liveTime": liveTime,
            "startTime": startTime,
            "blockTime": blockTime.total_seconds(),
            "created": dateutil.parser.parse(issue['fields']['created'])
        },
        [issue['key']]
    ), True, False, False)

open('data/productivity.json', 'w').write(df.set_index('timeInProgress').to_json(orient='split'))
print(df)

# for status, data in statusesData.items():
# 	pprint(data)
# 	byStatus = byStatus.append(pd.DataFrame(
# 		{"status": status, "total": data['total']},
# 		[status]
# 	), True, False, False)
#
# pprint(byStatus)

result = pd.DataFrame()
for issueType in ['Task', 'Bug', 'Story']:
    level_values = df.index.get_level_values
    notNullDf = df[df['doneTime'].notnull()]
    typeDf = notNullDf[notNullDf.type == issueType].set_index('doneTime').groupby([pd.Grouper(freq=frequency)]).apply(lambda x: pd.Series({
        issueType: dict(
            amount=(x.type == issueType).sum(),
            timeInProgress=dict(
                raw=list(x.timeInProgress),
                mean=x.timeInProgress.mean(),
                median=x.timeInProgress.median(),
                deviation=x.timeInProgress.std(ddof=0)
            ),
            timeTotal=dict(
                raw=list(x.timeTotal),
                mean=x.timeTotal.mean(),
                median=x.timeTotal.median(),
                deviation=x.timeTotal.std(ddof=0)
            ),
            timeBlocked=dict(
                raw=list(x.blockTime),
                mean=x.blockTime.mean(),
                median=x.blockTime.median(),
                deviation=x.blockTime.std(ddof=0)
            ),
        )

    }))
    try:
        old
    except NameError:
        old = typeDf
    else:
        if not typeDf.empty:
            old = old.merge(typeDf, left_index=True, right_index=True, how='outer', suffixes=['_l', '_' + issueType]).fillna(value={'amount': 0})
open('data/speed.json', 'w').write(old.to_json(orient='split'))


started = df[df['startTime'].notnull()].set_index('startTime').groupby(pd.Grouper(freq=frequency)).apply(lambda x: pd.Series({
    'bugs': (x.type == 'Bug').sum(),
    'tasks': (x.type == 'Task').sum(),
    'stories': (x.type == 'Story').sum()
})).merge(df[df['doneTime'].notnull()].set_index('doneTime').groupby(pd.Grouper(freq=frequency)).apply(lambda x: pd.Series({
    'bugs': (x.type == 'Bug').sum(),
    'tasks': (x.type == 'Task').sum(),
    'stories': (x.type == 'Story').sum()
})), left_index=True, right_index=True, how='outer', suffixes=[' started', ' finished']).fillna(0);
open('data/started_vs_finished.json', 'w').write(started.to_json(orient='split'))


startTime = df[(df.type == 'Bug') & (df['startTime'].notnull())]['startTime'].min()
time = start_date(startTime)
defectsAge = pd.DataFrame()
storiesAge = pd.DataFrame()
while time < datetime.datetime.now(datetime.timezone.utc):
    endOfPeriod = add_period(time)
    bugsByPeriod = pd.DataFrame(df[(df['doneTime'].isnull()) | ((df['doneTime'] < endOfPeriod) & (df['doneTime'] >= time))]
                     [df.type == 'Bug']
                     [df.created < endOfPeriod])
    storiesByPeriod = pd.DataFrame(df[(((df['doneTime'].isnull()) & (df['liveTime'].isnull())) | ((df['doneTime'] >= time) | (df['liveTime'] >= time)))]
                                 [df.type == 'Story']
                                 [df.created < endOfPeriod])
    defectsAge = defectsAge.append(pd.DataFrame({
        'date': time.date(),
        'count': bugsByPeriod.apply(lambda x: (endOfPeriod if x['doneTime'] is None else min(x['doneTime'], endOfPeriod)).replace(tzinfo=datetime.timezone.utc) - x['created'].replace(tzinfo=datetime.timezone.utc), axis=1).count(),
        'mean': bugsByPeriod.apply(lambda x: (endOfPeriod if x['doneTime'] is None else min(x['doneTime'], endOfPeriod)).replace(tzinfo=datetime.timezone.utc) - x['created'].replace(tzinfo=datetime.timezone.utc), axis=1).mean(),
        'median': bugsByPeriod.apply(lambda x: (endOfPeriod if x['doneTime'] is None else min(x['doneTime'], endOfPeriod)).replace(tzinfo=datetime.timezone.utc) - x['created'].replace(tzinfo=datetime.timezone.utc), axis=1).median(),
        'deviation': bugsByPeriod.apply(lambda x: (endOfPeriod if x['doneTime'] is None else min(x['doneTime'], endOfPeriod)).replace(tzinfo=datetime.timezone.utc) - x['created'].replace(tzinfo=datetime.timezone.utc), axis=1).std(ddof=0),
    }, [time.date()]), ignore_index=True)
    storiesAge = storiesAge.append(pd.DataFrame({
        'date': time.date(),
        'count': storiesByPeriod.apply(lambda x: (endOfPeriod if x['liveTime'] is None else (min(x['liveTime'], endOfPeriod) if x['doneTime'] is None else(min(x['doneTime'], endOfPeriod)))).replace(tzinfo=datetime.timezone.utc) - x['startTime'].replace(tzinfo=datetime.timezone.utc), axis=1).count(),
        'cycleTime.mean': storiesByPeriod[storiesByPeriod['startTime'] < endOfPeriod].apply(lambda x: (endOfPeriod if x['liveTime'] is None else (min(x['liveTime'], endOfPeriod) if x['doneTime'] is None else(min(x['doneTime'], endOfPeriod)))).replace(tzinfo=datetime.timezone.utc) - x['startTime'].replace(tzinfo=datetime.timezone.utc), axis=1).mean(),
        'cycleTime.median': storiesByPeriod[storiesByPeriod['startTime'] < endOfPeriod].apply(lambda x: (endOfPeriod if x['liveTime'] is None else (min(x['liveTime'], endOfPeriod) if x['doneTime'] is None else(min(x['doneTime'], endOfPeriod)))).replace(tzinfo=datetime.timezone.utc) - x['startTime'].replace(tzinfo=datetime.timezone.utc), axis=1).median(),
        'cycleTime.deviation': storiesByPeriod[storiesByPeriod['startTime'] < endOfPeriod].apply(lambda x: (endOfPeriod if x['liveTime'] is None else (min(x['liveTime'], endOfPeriod) if x['doneTime'] is None else(min(x['doneTime'], endOfPeriod)))).replace(tzinfo=datetime.timezone.utc) - x['startTime'].replace(tzinfo=datetime.timezone.utc), axis=1).std(ddof=0),
        'leadTime.mean': storiesByPeriod.apply(lambda x: (endOfPeriod if x['doneTime'] is None else min(x['doneTime'], endOfPeriod)).replace(tzinfo=datetime.timezone.utc) - x['created'].replace(tzinfo=datetime.timezone.utc), axis=1).mean(),
        'leadTime.median': storiesByPeriod.apply(lambda x: (endOfPeriod if x['doneTime'] is None else min(x['doneTime'], endOfPeriod)).replace(tzinfo=datetime.timezone.utc) - x['created'].replace(tzinfo=datetime.timezone.utc), axis=1).median(),
        'leadTime.deviation': storiesByPeriod.apply(lambda x: (endOfPeriod if x['doneTime'] is None else min(x['doneTime'], endOfPeriod)).replace(tzinfo=datetime.timezone.utc) - x['created'].replace(tzinfo=datetime.timezone.utc), axis=1).std(ddof=0),
    }, [time.date()]), ignore_index=True)
    time = endOfPeriod
open('data/defect_age.json', 'w').write(defectsAge.set_index('date').to_json(orient='split'))
open('data/stories_age.json', 'w').write(storiesAge.set_index('date').to_json(orient='split'))


