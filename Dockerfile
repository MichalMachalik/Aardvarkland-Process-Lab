FROM python:3.12-slim
WORKDIR /app
COPY server/monitor.py ./monitor.py
RUN mkdir /data && chown 65534:65534 /data
USER 65534:65534
ENV TRACE_HOST=0.0.0.0 TRACE_DB=/data/runs.sqlite PYTHONUNBUFFERED=1
EXPOSE 4188
CMD ["python", "monitor.py"]
