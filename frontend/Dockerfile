FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/build /usr/share/caddy
COPY public/errors /usr/share/caddy/errors
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
