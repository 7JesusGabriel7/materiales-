FROM node:20-alpine

WORKDIR /app

# Instalar tzdata para respetar la variable de entorno TZ (ej. America/Mexico_City)
RUN apk add --no-cache tzdata

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 3000

CMD ["node", "src/server.js"]

