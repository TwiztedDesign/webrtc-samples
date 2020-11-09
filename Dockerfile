FROM node:12.19.0-alpine3.10
WORKDIR '/app'
COPY package.json .
RUN npm install
COPY . .
CMD ["npm", "run", "start"]
EXPOSE 80
EXPOSE 443