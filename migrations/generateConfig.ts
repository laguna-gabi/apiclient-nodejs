import { ConfigsService } from '../src/providers';
import * as fs from 'fs';

async function main() {
  const { uri } = await new ConfigsService().createMongooseOptions();

  fs.readFile(__dirname + '/migrate-mongo-config.template.js', 'utf8', function (err, data) {
    if (err) {
      return console.log(err);
    }

    console.log(
      `generating a migration config file for: ${uri}: ` + __dirname + '/migrate-mongo-config.js',
    );

    const result = data
      .replace(/{{MONGO_URI}}/g, uri.substring(0, uri.lastIndexOf('/')))
      .replace(
        /{{MONGO_DB_NAME}}/g,
        uri.substring(
          uri.lastIndexOf('/') + 1,
          uri.lastIndexOf('?') > 0 ? uri.lastIndexOf('?') : uri.length,
        ),
      );

    fs.writeFile(__dirname + '/migrate-mongo-config.js', result, 'utf8', function (err) {
      if (err) return console.log(err);
    });
  });
}
(async () => {
  await main();
})();
