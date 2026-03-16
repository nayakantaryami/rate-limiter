const express = require("express");
const { createClient } = require("redis");

const app = express();
const PORT = 3000;

const WINDOW_SIZE = 10; // seconds
const MAX_REQUESTS = 5;

const redisClient = createClient();

redisClient.on("error", (err) => console.log("Redis Error", err));

async function startServer() {
  await redisClient.connect();

  function rateLimiter(req, res, next) {
    const userId = req.headers["user-id"];

    if (!userId) {
      return res.status(400).json({ error: "user-id header required" });
    }

    const key = `rate_limit:${userId}`;

    redisClient
      .incr(key)
      .then(async (currentCount) => {
        if (currentCount === 1) {
          // First request → set expiry
          await redisClient.expire(key, WINDOW_SIZE);
        }

        if (currentCount > MAX_REQUESTS) {
          const ttl = await redisClient.ttl(key);
          return res.status(429).json({
            error: "Too many requests",
            retryAfter: ttl,
          });
        }

        next();
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: "Internal error" });
      });
  }

  app.get("/api/test", rateLimiter, (req, res) => {
    res.json({ message: "Request allowed" });
  });

  app.listen(PORT, () => {
    console.log(`Server running on port-- ${PORT}`);
  });
}

startServer();
