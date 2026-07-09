FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD gunicorn app:app -b 0.0.0.0:${PORT:-8000} -w 1 --timeout 120
