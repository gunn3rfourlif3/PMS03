# Static marketing site served by Caddy.
FROM caddy:2-alpine
COPY web.Caddyfile /etc/caddy/Caddyfile
COPY index.html /srv/index.html
COPY privacy.html /srv/privacy.html
COPY terms.html /srv/terms.html
COPY robots.txt /srv/robots.txt
COPY sitemap.xml /srv/sitemap.xml
COPY locare-logo.png /srv/locare-logo.png
COPY brand /srv/brand
COPY tools /srv/tools
# Guides are drafted by the weekly content agent; the directory may be empty.
COPY guides /srv/guides
EXPOSE 80
