# Built from the REPO ROOT, not from web-admin/.
#
# WHY: this app imports `@shared/i18n`, which resolves to ../shared — a sibling
# of this directory. A build context of web-admin/ cannot see it, and the build
# fails with "Module not found: Can't resolve '@shared/i18n'". The context is
# set in deploy/compose.prod.yml; the two must agree.
#
# Paths below are therefore relative to the repo root, and the layout under
# .next/standalone is fixed by `outputFileTracingRoot` in next.config.js. If you
# change that, change the runtime stage with it.

# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app/web-admin

# Dependencies first, so a source edit does not reinstall them.
COPY web-admin/package*.json ./
RUN npm ci

# The shared catalogue must sit at ../shared, exactly as it does in the repo.
COPY shared/ /app/shared/
COPY web-admin/ ./

# API base is baked into the client bundle at build time.
ARG NEXT_PUBLIC_API_BASE=http://localhost:3000/api
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN npm run build

# Fail the BUILD, not the container, if the entrypoint is not where the runtime
# stage expects it. A missing server.js otherwise surfaces as a crash loop after
# deploy, by which time the old image is already gone.
RUN test -f .next/standalone/web-admin/server.js \
 || (echo "standalone layout changed — see outputFileTracingRoot in next.config.js" \
     && find .next/standalone -maxdepth 2 && exit 1)

# ---- Runtime stage (Next.js standalone) ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY --from=build /app/web-admin/.next/standalone ./
COPY --from=build /app/web-admin/.next/static ./web-admin/.next/static
COPY --from=build /app/web-admin/public ./web-admin/public
EXPOSE 3001
CMD ["node", "web-admin/server.js"]
