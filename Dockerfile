FROM node:lts-alpine3.13
WORKDIR /usr/src/app
COPY . /usr/src/app
RUN npm install
CMD "npm" "start"