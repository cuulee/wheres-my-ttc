const rb = require('restbus');
const app = require('express')();
const redis = require('redis');
const compression = require('compression');

const redisClient = redis.createClient({
  host: 'redis',
});

// Get data from redis given a key
const getKey = key =>
  new Promise((resolve, reject) => {
    redisClient.get(key, (error, result) => {
      if (!error && result) resolve(result);
      else reject(error);
    });
  });

// Set value for a key in redis with a given expiry
const setKey = (key, val, expiry = 5) => {
  const str = typeof val === 'string' ? val : JSON.stringify(val);
  redisClient.set(key, str, 'EX', expiry);
};
// Make the API callable from anywhere
const corsMiddleware = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
};

app.use(corsMiddleware);
app.use(compression());

// Middleware to check if a value was stored in redis
app.use((req, res, next) => {
  getKey(req.url)
    .then(val => {
      console.info('found in cache');
      // Return cached data

      res.json(JSON.parse(val));
    })
    .catch(error => {
      console.info('Not found in cache');
      const json = res.json;

      // Override the res.json function to do more than just return json
      res.json = function(...args) {
        if (typeof args[1] === 'object' && args[1].length) {
          // Remove all unnecessary data and only return some fields
          args[1] = args[1].map(item => {
            return {
              id: item.id,
              routeId: item.routeId,
              secsSinceReport: item.secsSinceReport,
              lat: item.lat,
              lon: item.lon,
            };
          });
        }
        // Also cache the response
        setKey(req.url, args[1]);
        json.call(this, ...args);
      };
      next();
    });
});

app.use('/', rb.middleware());
const PORT = 3000;
console.info(`Listening on port ${PORT}`);
app.listen(PORT);
