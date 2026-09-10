FROM python:3.12-slim
ARG SOURCE_COMMIT=unknown
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080 SHIELDAI_SOURCE_COMMIT=$SOURCE_COMMIT
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./
COPY templates ./templates
COPY static ./static
RUN useradd --create-home appuser
USER appuser
CMD ["sh", "-c", "gunicorn --workers 1 --threads 4 --bind 0.0.0.0:${PORT} app:app"]
