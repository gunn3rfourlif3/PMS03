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

# The manuals are READ FROM DISK AT RENDER TIME by the /partner/manual route —
# `readManual()` looks for docs/manuals/ beside the working directory. They were
# never copied into the image, so that route has been failing in production
# while working locally, where the repo is simply there. Shipped here, and
# copied into the runtime stage below, because the standalone bundle traces
# imports and knows nothing about a file opened by name at request time.
COPY docs/manuals/ /app/docs/manuals/

# API base is baked into the client bundle at build time.
ARG NEXT_PUBLIC_API_BASE=http://localhost:3000/api
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN npm run build

# Fail the BUILD, not the container, if the entrypoint is not where the runtime
# stage expects it. A missing server.js otherwise surfaces as a crash loop after
# deploy, by which time the old image is already gone. This guard has earned its
# keep once already: it caught a nested layout before it reached production.
#
# The layout is flat because `experimental.outputFileTracingRoot` in
# next.config.js pins the tracing root to web-admin itself. Change that and this
# path changes with it.
RUN test -f .next/standalone/server.js \
 || (echo "standalone layout changed — see experimental.outputFileTracingRoot in next.config.js" \
     && find .next/standalone -maxdepth 2 && exit 1)

# ---- Runtime stage (Next.js standalone) ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY --from=build /app/web-admin/.next/standalone ./
COPY --from=build /app/web-admin/.next/static ./.next/static
COPY --from=build /app/web-admin/public ./public
COPY --from=build /app/docs/manuals/ ./docs/manuals/
EXPOSE 3001
CMD ["node", "server.js"]
