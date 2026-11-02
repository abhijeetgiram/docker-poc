import os
import socket

import redis
from flask import Flask, jsonify

app = Flask(__name__)

# "redis" is the service name from docker-compose.yml; Docker turns it into a hostname that resolves to the container's IP address.
db = redis.Redis(host=os.getenv("REDIS_HOST", "redis"), port=6379, socket_connect_timeout=1)


@app.get("/api/hello")
def hello():
    try:
        visits = db.incr("visits")
    except redis.exceptions.ConnectionError:
        visits = "no database connected"

    return jsonify(
        message=os.getenv("GREETING", "Hello from inside a container!"),
        visits=visits,
        container=socket.gethostname(),
    )


if __name__ == "__main__":
    # 0.0.0.0 makes the app reachable from outside the container, not just from inside it.
    app.run(host="0.0.0.0", port=5000)
