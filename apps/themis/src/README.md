<p align="center">
  <a href="	https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Bacciarelli_Themis.jpg/440px-Bacciarelli_Themis.jpg" target="blank">
     <img src="	https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Bacciarelli_Themis.jpg/440px-Bacciarelli_Themis.jpg" 
     height="250" 
     alt="themis" />
  </a><br/>
  <b>Total coverage:</b>
  <a href="" alt="lines">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/themis/badge-lines.svg?branch=develop&kill_cache=1" />
  </a>
  <b>Other coverage:</b>
  <a href="" alt="functions">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/themis/badge-functions.svg?branch=develop&kill_cache=1" />
  </a>
  <a href="" alt="statements">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/themis/badge-statements.svg?branch=develop&kill_cache=1" />
  </a>
</p>

# 📨 Themis

Laguna health Clinical Rule Engine.
<br/>Written in typescript by using [Nest](https://github.com/nestjs/nest) framework.

- [📨 Themis](#-themis)
  - [💡 Project introduction](#-project-introduction)
  - [🚀 Running the app](#-running-the-app)
  - [Sending a Message](#sending-a-message)

## 💡 Project introduction

This project handles Member change event messages transmitted over SQS change event queue

## 🚀 Running the app

In order to work with _Themis_ simply start the service 
```
nx serve themis
```
  
## Sending a Message 
When running in localhost Use the following CLI command to send an event
```
aws sqs send-message --queue-url http://localhost:4566/000000000000/ChangeEventQ-local --message-body "{\"memberId\":\"<memberId>\"}" --endpoint-url=http://localhost:4566
