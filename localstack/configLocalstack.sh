aws sqs create-queue --queue-name NotificationsQ-local --endpoint-url=http://localhost:4566 
aws sqs create-queue --queue-name NotificationsDLQ-local --endpoint-url=http://localhost:4566 
aws sqs create-queue --queue-name ImageQ-local --endpoint-url=http://localhost:4566 
aws s3 mb s3://laguna-docs-bucket-local --endpoint-url=http://localhost:4566
aws s3api put-bucket-notification-configuration --bucket laguna-docs-bucket-local --notification-configuration file://localstack/notificationConfig.json --endpoint-url=http://localhost:4566