# Build the Expo tenant app as a static web bundle, then serve it with Caddy.
# The API base is baked into the client bundle at export time via EXPO_PUBLIC_API_BASE.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG EXPO_PUBLIC_API_BASE=http://localhost:3000/api
ENV EXPO_PUBLIC_API_BASE=$EXPO_PUBLIC_API_BASE
RUN npx expo export --platform web --output-dir dist

# ---- Runtime: tiny static server with SPA fallback ----
FROM caddy:2-alpine AS runtime
COPY web.Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
