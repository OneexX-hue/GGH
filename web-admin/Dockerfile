FROM node:22-alpine AS build
WORKDIR /app
# Next.js встраивает NEXT_PUBLIC_* в клиентский бандл на этапе сборки
# (не читает их в рантайме контейнера) — поэтому они должны прийти как
# build ARG, не просто environment: в docker-compose. См.
# docs/deploy/timeweb-ubuntu-guide.md.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_TURN_URL
ARG NEXT_PUBLIC_TURN_USERNAME
ARG NEXT_PUBLIC_TURN_CREDENTIAL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_TURN_URL=$NEXT_PUBLIC_TURN_URL \
    NEXT_PUBLIC_TURN_USERNAME=$NEXT_PUBLIC_TURN_USERNAME \
    NEXT_PUBLIC_TURN_CREDENTIAL=$NEXT_PUBLIC_TURN_CREDENTIAL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "run", "start"]
