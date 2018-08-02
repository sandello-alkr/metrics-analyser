# Metrics Analyzer
by Aliaksei Krychko

## Prerequisites:
Docker, Docker compose

## To start:
If you're doing Kanban, v3 will be better for you, it will group data by month (or week, commented).
1. Pull this repo, create `py/config.py` from `py/config.py.dist`, set username, password and project name.
2. Make sure to uncomment `COMPOSE_FILE=docker-compose.yml:docker-compose-v3.yml` in `.env`
3. Run `docker-compose up`
4. go to [http://localhost:8080/v3.0.html](http://localhost:8080/v3.0.html)

To update data without restarting the web container, run `docker-compose -f docker-compose-v3.yml run --rm python`

If you're doing scram with sprints, v1 might be your choise.
1. Pull this repo, create `config.php` from `config.php.dist`, set all info needed.
2. Sprints needed are specified as constant arrays in two(TODO) places: `config.php` and `chart.js`
3. Make sure to uncomment `COMPOSE_FILE=docker-compose.yml:docker-compose-v1.yml` in `.env`
4. Run `docker-compose up`
5. go to [http://localhost:8080/](http://localhost:8080/)

To update data without restarting the web container, run `docker-compose -f docker-compose-v1.yml run --rm php`


