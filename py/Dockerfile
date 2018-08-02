FROM python:3

COPY . /app
WORKDIR /app

RUN pip install pipenv
RUN pipenv install requests pandas plotly

RUN pipenv install --system

CMD ["python", "main.py"]