# Docker POC

A small Docker Compose project that demonstrates three containers working together:

- Frontend: Nginx serving a static page
- Backend: Flask API that increments a Redis counter
- Redis: in-memory datastore for the counter

## Project structure

- `frontend/` — static web app and Nginx configuration
- `backend/` — Flask API service
- `docker-compose.yml` — container orchestration

## How it works

1. The browser loads the frontend from `http://localhost:8080`.
2. Clicking the button triggers a request to `/api/hello` on the frontend server.
3. Nginx forwards that request to the backend container.
4. The Flask app increments a Redis counter and returns JSON.
5. Redis stores the counter value in a named volume.

## Run locally

```bash
docker compose up --build
```

Then open:

- Frontend: http://localhost:8080
- Backend API: http://localhost:5050/api/hello

## Notes

- The frontend container listens on port 80 internally, which is exposed as `8080` on the host.
- The backend container listens on port 5000 internally, exposed as `5050` on the host.
- Redis is only reachable from the Docker network; it is not published to the host machine.

## Things to try with Docker and Docker Compose

```bash
docker --version                              # Show the installed Docker version
docker compose version                        # Show the installed Docker Compose version
docker compose build                          # Build the frontend and backend images
docker compose up -d                          # Start the services in the background
docker compose ps                             # Show the status of the Compose services
docker compose logs -f backend                # Follow the backend logs (Ctrl+C to stop following)
docker compose exec redis redis-cli GET visits # Read the visit counter from Redis
docker compose down                           # Stop and remove the containers and network; keep the Redis volume
docker compose down -v                        # Also remove the Redis volume and its stored counter
```

To try scaling the backend, first remove or comment out the backend `ports` mapping in `docker-compose.yml`. A fixed host port (`5050:5000`) cannot be shared by multiple backend replicas. Then run:

```bash
docker compose up --build -d --scale backend=3 # Start three backend replicas
docker compose ps                              # Confirm the backend replicas are running
```
