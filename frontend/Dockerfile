# --------------- Stage 1: Build the frontend ---------------
# We use a node image to build the frontend. The final image will be much smaller.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --------------- Stage 2: Serve the frontend ---------------
# A small nginx image. Only the build files are copied from the previous stage, Node.js and node_modules are left behind. The final image is very small.
# nginx is a small web server. We only add our page and its config.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
