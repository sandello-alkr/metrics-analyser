# Metrics Analyzer
by Aliaksey Krychko

## Prerequisites:
Docker compose

## To start:
1. Pull this repo, create `py/config.py` from `py/config.py.dist`, set username, password and project name.
2. Run `docker-compose up`
3. go to [http://localhost:8080/v3.0.html](http://localhost:8080/v3.0.html)

To update data without restarting the web container, run `docker-compose run --rm python`

Sprints needed are specified as constant arrays in two(TODO) places: `config.php` and `chart.js`