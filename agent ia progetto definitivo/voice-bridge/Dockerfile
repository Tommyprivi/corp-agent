# Il ponte vocale gira in un contenitore sempre acceso, non su Vercel.
# Il perché sta scritto in server.js, in cima.
FROM node:22-slim

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

# ⚠️ Il traffico audio non passa dalla porta HTTP: WebRTC apre le sue porte
# UDP. Su Fly.io e Railway questo funziona senza configurare niente perché
# l'indirizzo IP è pubblico; dietro un NAT casalingo no, e servirebbe un TURN.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
