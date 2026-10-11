FROM python:3.14-slim
RUN apt-get update && apt-get install -y --no-install-recommends iptables ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY scanner.py server.py entrypoint.py ./
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 RES_OPTIONS="attempts:1 timeout:2"
EXPOSE 4100
ENTRYPOINT ["python", "/app/entrypoint.py"]
