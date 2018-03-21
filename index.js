const redis = require('redis');
const { CronJob } = require('cron');
const { sample } = require('lodash');

const { generator } = require('./generator');
const { Tweeter } = require('./lib/tweeter');
const genderizer = require('./lib/genderizer');

const { twitterAPI, myself } = require('./config');
const t = new Tweeter(twitterAPI);

const client = redis.createClient({
  host: 'redis'
});

client.on('error', function(err) {
  process.stderr.write('Error ' + err);
});

function tweet(buffer, text) {
  buffer
    .then(b => {
      return t.tweetImageBuffer(b, text);
    })
    .then(id =>
      process.stdout.write(`
      done!
      Text: ${text}
      Link: https://twitter.com/insultomata/status/${id}\n
      `)
    )
    .catch(error => process.stderr.write(error));
}

function generateSingle() {
  process.stdout.write('Generating single tweet');

  const output = generator(sample(['f', 'm', 'n']));

  process.stdout.write(`
      Date: ${new Date()}
      posting tweet...\n
      `);

  tweet(output.buffer, output.text);
}

//generateSingle();

function followBack(user) {
  return new Promise((resolve, reject) => {
    t.get('followers/ids', { screen_name: myself }, function(err, data) {
      t.post(
        'friendships/create',
        {
          user
        },
        function(err, data, response) {}
      );
    });
  });
}

function generateReply() {
  client.lpop('queue', function(error, reply) {
    if (error) {
      process.stderr.write(`Error: ${error}\n`);
    }

    if (reply) {
      process.stdout.write('Generating reply');

      const user = JSON.parse(reply);

      process.stdout.write(`
      User: ${user.handle} 
      Date: ${new Date()}
      posting tweet...\n
      `);

      genderizer(user.name).then(g => {
        const output = generator(g);
        tweet(output.buffer, `@${user.handle} ${output.text}`);
      });
    }
  });
}

new CronJob('* */6 * * *', generateSingle, null, true, 'Europe/Madrid');
new CronJob('*/2 * * * *', generateReply, null, true, 'Europe/Madrid');
