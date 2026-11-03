# Docker POC

A small Docker Compose project for learning how a web frontend, API, and datastore work together in containers.

## Current stack

- **Frontend:** React 19 app built with Vite and served by Nginx.
- **Backend:** Flask API that increments a visit counter.
- **Datastore:** Redis, with its data stored in a named Docker volume.
- **Orchestration:** Docker Compose starts the services on a shared network.

## Project structure

- `frontend/src/` — React app and styles
- `frontend/vite.config.js` — Vite development server and API proxy
- `frontend/Dockerfile` — multi-stage frontend build (Node.js build stage, Nginx runtime stage)
- `frontend/nginx.conf` — serves the built app, supports SPA routes, and proxies API requests
- `backend/` — Flask API service
- `docker-compose.yml` — service configuration, ports, Redis health check, and data volume

## How it works

1. Open the frontend at `http://localhost:8080`.
2. The React app requests `/api/hello` from the same origin.
3. Nginx forwards `/api/` requests to the `backend` service on the Compose network.
4. Flask increments the `visits` key in Redis and returns JSON, including the backend container name.
5. Redis stores its data in the `redis-data` volume so the counter survives container removal.

Compose waits for Redis's health check before starting the backend. The frontend is served on port 80 inside its container and published as port 8080 on the host. The backend listens on port 5000 inside its container and is optionally published as port 5050. Redis has no host-published port.

## Run the full stack

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:8080
- Backend API: http://localhost:5050/api/hello

Stop the foreground stack with `Ctrl+C`. To start it in the background, use `docker compose up --build -d`.

## Run only the backend container

Build the backend image from its directory, then start a single container:

```bash
cd backend
docker build -t hello-api .
docker run --rm -p 5050:5000 hello-api
```

Visit http://localhost:5050/api/hello to call the API. This runs only the backend; no database is connected, so the response's `visits` field will say `"no database connected"`. Stop the container with `Ctrl+C`.

You can change the greeting without changing the code by stopping the container and running it again with a `GREETING` environment variable:

```bash
docker run --rm -p 5050:5000 -e GREETING="Hi John" hello-api
```

The response's `message` field will now be `"Hi John"`. The `--rm` option removes the container when it stops; the built `hello-api` image remains available.

## Run the frontend in Vite development mode

```bash
cd frontend
npm ci
npm run dev
```

The Vite proxy in `vite.config.js` forwards `/api` to `http://localhost:5000`. Make the Flask API available on that host port when using the Vite dev server. The Compose setup publishes the backend on port 5050 instead; the simplest way to test the complete stack is to use the Docker Compose instructions above.

## Things to try with Docker and Docker Compose

```bash
docker --version                               # Show the installed Docker version
docker compose version                         # Show the installed Docker Compose version
docker compose build                           # Build the frontend and backend images
docker compose up -d                           # Start the services in the background
docker compose ps                              # Show service and container status
docker compose logs -f backend                 # Follow backend logs (Ctrl+C stops following)
docker compose exec redis redis-cli GET visits # Read the visit counter from Redis
docker compose down                            # Stop and remove containers and network; keep the Redis volume
docker compose down -v                         # Also remove the Redis volume and its stored data
```

### Try scaling the backend

The backend service publishes host port 5050, and a fixed host port cannot be shared by multiple replicas. Temporarily remove or comment out the backend `ports` mapping in `docker-compose.yml`, then run:

```bash
docker compose up --build -d --scale backend=3 # Start three backend replicas
docker compose ps                              # Confirm the backend replicas are running
```

This demonstrates starting replicas; it does not by itself guarantee that Nginx distributes requests across them.

## POC milestones and roadmap

These are project milestones, not Docker image tags or formal releases. Keep the status current as the POC evolves.

| Milestone | Status | Improvements |
|---|---|---|
| v0.1 — Containerized baseline | Complete | Static HTML frontend served by Nginx, Flask API, Redis counter, Compose networking, and persistent Redis volume. |
| v0.2 — React frontend | Current | Replaced the static page with React and Vite; added a multi-stage frontend image build, Nginx API proxy and SPA fallback, example security headers, and a Redis health check. |
| v0.3 — API reliability and tests | Planned | Add API/Redis error handling with consistent HTTP responses, health/readiness endpoints, and automated tests. |
| v0.4 — Deployment workflow | Planned | Add a CI build/test workflow, image tagging, and documented deployment configuration. |

When a planned milestone is implemented, update its status and improvements here, then add the next planned milestone.
