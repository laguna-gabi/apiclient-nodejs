FROM node:16 as builder
WORKDIR /hepius
COPY . /hepius
RUN yarn

FROM node:16.6.1-alpine3.14
WORKDIR /hepius
COPY --from=builder /hepius/ /hepius/
EXPOSE 3000
ENV NO_COLOR=true
CMD "npm" "start"
