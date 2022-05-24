<p align="center">
  <b>Total coverage:</b>
  <a href="" alt="lines">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/poseidon/badge-lines.svg?branch=develop&kill_cache=1" />
  </a>
  <b>Other coverage:</b>
  <a href="" alt="functions">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/poseidon/badge-functions.svg?branch=develop&kill_cache=1" />
  </a>
  <a href="" alt="statements">
    <img src="https://laguna-health-coverage.s3.amazonaws.com/poseidon/badge-statements.svg?branch=develop&kill_cache=1" />
  </a>
</p>

# 🔱 Poseidon

Poseidon is a microservice written in typescript using the [Nest](https://github.com/nestjs/nest) framework. <br/>
This microservice is in charge of creating transcripts for all the recordings.

## RevAI

[RevAI](https://www.rev.ai/jobs) is a HIPAA service providing speech to text transcripts. We are using the async speech to text service to transcribe our recordings.

## Communication

[Hepius](../../hepius/server) is communicating with Poseidon using TCP.

## Flow

- When a recording is uploaded to _S3_ an event is created that sends a message to _SQS_ transcript queue.

  > the message that is sent to the queue contains the key of the recording that was uploaded <br/>
  >
  > ```
  >  key: [bucket]/public/recordings/[memberId]/[recordingId]
  > ```

- Poseidon listens on the _SQS_ transcript queue, when Poseidon receives a new recording it sends the recording to **RevAI** for transcribing and saves a document in the database.
- When **RevAI** finishes transcribing or fails it sends a webhook back to Poseidon, <br />
  if it failed it does the following:

  - poseidon updates the document in the database with status: `error` and the `failureReason`

  if the transcribing was successful it does the following:

  - it calculates the conversation percentage (speakerA/speakerB/silence) and saves it to the database
  - it saves the transcript to _S3_ and creates a json of the transcript that is also saved to _S3_.
