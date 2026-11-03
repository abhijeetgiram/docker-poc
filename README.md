# Docker POC

A small Docker Compose project for learning how a web frontend, API, and datastore work together in containers.

## Current stack

- **Frontend:** React 19 app built with Vite and served by Nginx.
- **Backend:** Flask API that increments a visit counter.
- **Datastore:** Redis, with its data stored in a named Docker volume.
- **Orchestration:** Docker Compose or Kubernetes runs the services with internal service discovery.

## Project structure

- `frontend/src/` — React app and styles
- `frontend/vite.config.js` — Vite development server and API proxy
- `frontend/Dockerfile` — multi-stage frontend build (Node.js build stage, Nginx runtime stage)
- `frontend/nginx.conf` — serves the built app, supports SPA routes, and proxies API requests
- `backend/` — Flask API service
- `docker-compose.yml` — service configuration, ports, Redis health check, and data volume
- `k8s/` — Kubernetes namespace, Redis, backend, and frontend resources
- `helm/docker-poc/` — Helm chart, default values, and an example production override
- `.github/workflows/images.yml` — builds app images and publishes them to GitHub Container Registry (GHCR)

## How it works

Use Docker Compose for local development and Helm to deploy to Kubernetes; the `k8s/` manifests remain available as a manual Kubernetes example. In each setup, Nginx serves the frontend and proxies API requests to Flask; Flask connects to Redis using the service name.

## Run the full stack with Docker Compose

Start the services:

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:8080
- Backend API (through the frontend proxy): http://localhost:8080/api/hello

Stop the foreground stack with `Ctrl+C`. To start it in the background, use `docker compose up --build -d`.

To call the backend directly at `http://localhost:5050/api/hello`, uncomment the backend `ports` mapping in `docker-compose.yml` and restart Compose. A fixed host port supports only one backend replica; leave the mapping commented out when scaling.

The request flow is:

1. Open the frontend at `http://localhost:8080`.
2. The React app requests `/api/hello` from the same origin.
3. Nginx forwards `/api/` requests to the `backend` service on the Compose network.
4. Flask increments the `visits` key in Redis and returns JSON, including the backend container name.
5. Redis stores its data in the `redis-data` volume so the counter survives container removal.

Compose waits for Redis's health check before starting the backend. The frontend is served on port 80 inside its container and published as port 8080 on the host. The backend listens on port 5000 inside its container and is reachable by other Compose services, but is not published on the host by default. This lets multiple backend replicas run without competing for one host port. Redis has no host-published port.

## Manually publish images to Docker Hub

Docker Hub is a public container registry. Both application images were manually pushed there successfully and can be found under your Docker Hub account's repositories. To repeat the process, replace `<username>` below with your Docker Hub username, then build, tag, and push each image:

```bash
docker login
docker build -t docker-poc-backend:1.0 ./backend
docker build -t docker-poc-frontend:1.0 ./frontend
docker tag docker-poc-backend:1.0 <username>/docker-poc-backend:1.0
docker tag docker-poc-frontend:1.0 <username>/docker-poc-frontend:1.0
docker push <username>/docker-poc-backend:1.0
docker push <username>/docker-poc-frontend:1.0
```

To verify either image can be pulled:

```bash
docker pull <username>/docker-poc-backend:1.0
docker pull <username>/docker-poc-frontend:1.0
```

Check your Docker Hub account to see the published images. You can also pull them from any machine with Docker installed, or use them in a Kubernetes cluster.
The local image must exist before `docker tag` can tag it, and the repository-qualified tag must exist before `docker push` can upload it. This manual Docker Hub workflow is separate from the GitHub Actions workflow below, which publishes to GHCR.

## Run the full stack with Kubernetes

This workflow uses Docker Desktop's local Kubernetes cluster and locally built images. Enable Kubernetes in Docker Desktop and make sure `kubectl config current-context` is `docker-desktop`. Stop the Compose stack first so it does not occupy port 8080:

```bash
docker compose down
docker build -t docker-poc-backend:1.0 ./backend
docker build -t docker-poc-frontend:1.0 ./frontend
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/10-redis.yaml
kubectl apply -f k8s/20-backend.yaml
kubectl apply -f k8s/30-frontend.yaml
kubectl get pods,services,pvc -n docker-poc
```

Wait for the pods to become ready, then open http://localhost:8080 and click **Call backend**. The Kubernetes frontend Service exposes port 8080 on the host; Nginx routes `/api/hello` to the backend Service, and Redis uses a PersistentVolumeClaim for its data.

To check rollout progress or view application logs:

```bash
kubectl rollout status deployment/redis -n docker-poc
kubectl rollout status deployment/backend -n docker-poc
kubectl rollout status deployment/frontend -n docker-poc
kubectl logs -n docker-poc deployment/backend
```

When finished, remove the Kubernetes resources with `kubectl delete namespace docker-poc`. This deletes the namespace and its resources, including the Redis claim; whether the underlying storage is retained depends on the cluster's storage class.

To return to Compose, start it again with `docker compose up --build`.

## Run the full stack with Helm

The Helm chart packages the same Redis, backend, and frontend resources as the Kubernetes manifests. It defaults to the locally built `docker-poc-backend:1.0` and `docker-poc-frontend:1.0` images with `imagePullPolicy: Never`, so build those images in Docker Desktop before installing. The Redis image is pulled from its configured registry.

With Docker Desktop Kubernetes enabled, select the `docker-desktop` context, stop any Compose stack using port 8080, and build the application images:

```bash
docker compose down
docker build -t docker-poc-backend:1.0 ./backend
docker build -t docker-poc-frontend:1.0 ./frontend
helm lint ./helm/docker-poc
helm template docker-poc ./helm/docker-poc --namespace docker-poc
helm upgrade --install docker-poc ./helm/docker-poc \
  --namespace docker-poc \
  --create-namespace
kubectl get pods,services,pvc -n docker-poc
```

Wait for the pods to become ready, then open http://localhost:8080. Helm prints the release notes after installation; you can also retrieve them with `helm get notes docker-poc -n docker-poc`.

The chart defaults are in `helm/docker-poc/values.yaml`. Override individual values with `--set`, or place overrides in a YAML file and pass it with `-f`:

```bash
helm upgrade --install docker-poc ./helm/docker-poc \
  --namespace docker-poc \
  --set backend.replicas=3
```

The Deployment keeps the requested replica count, so deleting a backend pod only causes Kubernetes to create a replacement. Change the count through Helm to scale the backend; for example, set it to one while preserving the release's other values:

```bash
helm upgrade docker-poc ./helm/docker-poc \
  --namespace docker-poc \
  --reuse-values \
  --set backend.replicas=1
```

The chart demonstrates a few Helm template features:

- `templates/_helpers.tpl` defines a backend image helper that combines its image name and tag. Helper files are not rendered as Kubernetes resources on their own.
- The backend Deployment uses `range` to turn the `backend.env` map in `values.yaml` into container environment variables.
- The frontend Service uses `if` to select `LoadBalancer` by default or `ClusterIP` when `ingress.enabled` is true.

Resource labels are currently written inline in the templates; there is not yet a shared labels helper.

`ingress.enabled` defaults to `false`. Setting `--set ingress.enabled=true` changes the frontend Service to `ClusterIP`; it does not create an Ingress resource, so the frontend will only be reachable through a separately configured ingress or another cluster access method.

`helm/docker-poc/values-prod.yaml` shows an example of overriding replica counts, image names and tags, pull policies, the backend environment, and resources. It uses the GHCR images published by the workflow below. Preview the merged production configuration without installing it:

```bash
helm lint ./helm/docker-poc -f ./helm/docker-poc/values-prod.yaml
helm template docker-poc ./helm/docker-poc \
  --namespace docker-poc \
  -f ./helm/docker-poc/values-prod.yaml
```

To remove the Helm release and its resources, including the Redis PersistentVolumeClaim, run:

```bash
helm uninstall docker-poc -n docker-poc
```

Whether the underlying storage is retained after the claim is deleted depends on the cluster's storage class.

Do not install the raw Kubernetes manifests and the Helm release together in the same namespace: they create resources with the same names.

## Build and publish images with GitHub Actions

GitHub Container Registry (GHCR) is GitHub's container image registry, integrated with GitHub Packages. Like Docker Hub, it stores and distributes container images; the difference here is which registry host and publishing workflow are used. The workflow builds both images on pull requests targeting `master`. On pushes to `master` and version tags matching `v*`, it also publishes them to GHCR. Published images receive a branch or version tag and a commit-SHA tag; pushes to the default branch also update the `latest` tag. Builds include both `linux/amd64` and `linux/arm64` platforms, so they can be pulled on common Intel/AMD and Apple Silicon machines. For example, pushing `v0.1.0` publishes:

- `ghcr.io/abhijeetgiram/docker-poc-backend:v0.1.0`
- `ghcr.io/abhijeetgiram/docker-poc-frontend:v0.1.0`

To view GHCR images, open the repository on GitHub and select its **Packages** section, or visit your GitHub profile and open **Packages**. GHCR is separate from Docker Hub, so images pushed manually to Docker Hub do not appear there. Packages will appear in GHCR after the workflow runs on a push to `master` or a `v*` tag and successfully publishes them. GitHub Actions runs on PRs too, but those runs only build and do not publish.

The workflow uses the automatically provided `GITHUB_TOKEN` with `packages: write`; no registry secret is needed. If repository or organization policy requires it, allow Actions to create packages. GHCR packages may be private by default. Make them public for unauthenticated cluster pulls, or configure Kubernetes image-pull credentials for private packages.

After a successful publishing run, pull the version-tagged images into Docker Desktop with Docker CLI:

```bash
docker pull ghcr.io/abhijeetgiram/docker-poc-backend:v0.1.0
docker pull ghcr.io/abhijeetgiram/docker-poc-frontend:v0.1.0
```

Pulled images appear in Docker Desktop's **Images** view. For private packages, authenticate first with `docker login ghcr.io` using a GitHub personal access token that has `read:packages`; public packages can be pulled without logging in.

You do not need to create a Git tag for everyday pushes to `master`: after the workflow succeeds, pull the moving `latest` tag:

```bash
docker pull ghcr.io/abhijeetgiram/docker-poc-backend:latest
docker pull ghcr.io/abhijeetgiram/docker-poc-frontend:latest
```

For a fixed version such as `v0.1.0`, create and push a Git tag. The version-tagged images above exist only after that tag is pushed and its Actions run succeeds:

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions only builds and publishes; it does not deploy to a cluster. Deploy a published version to Kubernetes with Helm after ensuring the cluster can pull the GHCR packages:

```bash
helm upgrade --install docker-poc ./helm/docker-poc \
  --namespace docker-poc \
  --create-namespace \
  -f ./helm/docker-poc/values-prod.yaml
```

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

The Vite proxy in `vite.config.js` forwards `/api` to `http://localhost:5000`. Make the Flask API available on that host port when using the Vite dev server. The Compose setup does not publish the backend port by default; the simplest way to test the complete stack is to use the Docker Compose instructions above.

## Useful Docker and Kubernetes commands

### Docker Compose

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

Remove unused Docker resources when you need to reclaim disk space:

```bash
docker container prune # Remove stopped containers
docker image prune     # Remove dangling images
docker builder prune   # Remove unused build cache
docker system prune    # Remove stopped containers, unused networks, dangling images, and build cache
```

Pruning volumes can delete persisted application data. Only do this when you no longer need it:

```bash
docker volume prune       # Remove volumes not used by any container
docker system prune --volumes # Also remove unused volumes during system prune
```

### Kubernetes

These commands assume Docker Desktop Kubernetes is enabled and the `docker-desktop` context is selected. The resources in this project are in the `docker-poc` namespace.

Docker Desktop offers **kubeadm** (a simple single-node cluster) and **kind** (Kubernetes nodes running as containers, including multi-node setups; requires the containerd image store). For this project, choose **kubeadm** unless you specifically want to experiment with multiple nodes.

```bash
kubectl config current-context                         # Show the active Kubernetes context
kubectl get pods,services,pvc -n docker-poc             # List project workloads and storage
kubectl rollout status deployment/frontend -n docker-poc # Wait for the frontend rollout
kubectl logs -n docker-poc deployment/backend          # View backend logs
kubectl delete namespace docker-poc                    # Remove all project resources in the namespace
```

Kubernetes removes namespaced resources when the namespace is deleted. This also deletes the project's PersistentVolumeClaim; whether the underlying storage is retained depends on the cluster's storage class.

### Helm

```bash
helm list -n docker-poc                                      # List Helm releases in the project namespace
helm status docker-poc -n docker-poc                         # Show release status
helm get values docker-poc -n docker-poc                     # Show release overrides
helm upgrade --install docker-poc ./helm/docker-poc -n docker-poc # Apply chart changes
helm uninstall docker-poc -n docker-poc                      # Remove the release and its resources
```

### Common Docker options

Short options (one hyphen) are often abbreviations for long options (two hyphens). Their meaning depends on the command:

| Option | Meaning | Example |
|---|---|---|
| `-t` | With `docker build`, set the image name and tag. With `docker run`, allocate a terminal (TTY). | `docker build -t hello-api .` |
| `--rm` | With `docker run`, automatically remove the container after it stops. It does not remove the image. | `docker run --rm hello-api` |
| `-f` | Specify a file with `docker compose` (for example, an alternate Compose file); with `docker compose logs`, follow the log output. | `docker compose -f docker-compose.yml up` |
| `-d` | Run containers in the background (detached mode). | `docker compose up -d` |
| `-v` | With `docker run`, mount a volume or host path into the container. With `docker compose down`, also remove named volumes and their data. | `docker run -v my-data:/data hello-api` |

Check `docker <command> --help` or `docker compose <command> --help` for the options supported by a specific command. For example, `-f` and `-v` do not have one universal meaning across Docker commands.

### Try scaling the backend

The backend is not published on a fixed host port, so Compose can start multiple replicas. The frontend proxy can still reach the backend using the Compose service name. Run:

```bash
docker compose up --build -d --scale backend=3 # Start three backend replicas
docker compose ps                              # Confirm the backend replicas are running
```

Open http://localhost:8080 and click the button (or visit http://localhost:8080/api/hello) to call the backend. The response includes the serving container's name, so you can make several requests to see which replica handles them. This demonstrates scaling; it does not guarantee even request distribution.

## POC milestones and roadmap

These are project milestones, not Docker image tags or formal releases. Keep the status current as the POC evolves.

| Milestone | Status | Improvements |
|---|---|---|
| v0.1 — Containerized baseline | Complete | Static HTML frontend served by Nginx, Flask API, Redis counter, Compose networking, and persistent Redis volume. |
| v0.2 — React frontend | Complete | Replaced the static page with React and Vite; added a multi-stage frontend image build, Nginx API proxy and SPA fallback, example security headers, and a Redis health check. |
| v0.3 — API reliability and tests | Planned | Add API/Redis error handling with consistent HTTP responses, health/readiness endpoints, and automated tests. |
| v0.4 — Image build and publish | Current | Build frontend and backend images in GitHub Actions; publish version- and commit-SHA-tagged images to GHCR and document Helm deployment. |
| v0.5 — API reliability and tests | Planned | Add API/Redis error handling with consistent HTTP responses, health/readiness endpoints, and automated tests. |

When a planned milestone is implemented, update its status and improvements here, then add the next planned milestone.
