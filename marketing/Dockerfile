# Static marketing site served by Caddy.
FROM caddy:2-alpine
COPY web.Caddyfile /etc/caddy/Caddyfile
COPY index.html /srv/index.html
COPY privacy.html /srv/privacy.html
COPY terms.html /srv/terms.html
COPY brand /srv/brand
EXPOSE 80
