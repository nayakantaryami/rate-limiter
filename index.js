const express = require("express");
const app = express();
const PORT = 3000;

//for rate limiting config
const window_size = 10 * 1000; //10 seconds
const max_window_request = 1; //max 1 request in 10 seconds
//for global rate limit
const global_window_size = 20 * 1000; //20 seconds
const global_max_window_request = 5; //max 5 request in 20 seconds

// IN-MEMORY STORE
const rateLimitStore = {};
let globalRateLimitStore = {
  count: 1, // Start at 0 for accuracy
  startTime: Date.now(),
};

//middleware for rate
//  limiting
function ratelimiter(req, res, next) {
    ///headers are always in lowercase in nodejs
  const userId = req.headers["x-userid"];

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }
  const currentTime = Date.now();
  if (currentTime - globalRateLimitStore.startTime > global_window_size) {
    globalRateLimitStore = {
      count: 1,
      startTime: currentTime,
    };
  } else {
    if (globalRateLimitStore.count < global_max_window_request) {
      globalRateLimitStore.count += 1;
    } else {
      res.set("X-RateLimit-Remaining", 0);
      res.set("X-Global-RateLimit-Remaining", 0);
      return res.status(429).json({
        message: "Global rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil(
          (global_window_size -
            (currentTime - globalRateLimitStore.startTime)) /
            1000,
        ),
        remaining: 0,
        globalRemaining: 0,
      });
    }
  }
  if (!rateLimitStore[userId]) {
    rateLimitStore[userId] = {
      count: 1,
      startTime: currentTime,
    };
  } else {
    const userData = rateLimitStore[userId];
    if (currentTime - userData.startTime > window_size) {
      rateLimitStore[userId] = {
        count: 1,
        startTime: currentTime,
      };
    } else {
      if (userData.count < max_window_request) {
        userData.count += 1;
      } else {
        res.set("X-RateLimit-Remaining", 0);
        res.set(
          "X-Global-RateLimit-Remaining",
          global_max_window_request - globalRateLimitStore.count,
        );
        return res.status(429).json({
          message: "Too many requests. Please try again later.",
          retryAfter: Math.ceil(
            (window_size - (currentTime - userData.startTime)) / 1000,
          ),
          remaining: 0,
          globalRemaining:
            global_max_window_request - globalRateLimitStore.count,
        });
      }
    }
  }

  // Set headers for successful requests
  const userData = rateLimitStore[userId];
  const userRemaining = Math.max(0, max_window_request - userData.count);
  const globalRemaining = Math.max(
    0,
    global_max_window_request - globalRateLimitStore.count,
  );
  res.set("X-RateLimit-Remaining", userRemaining);
  res.set("X-Global-RateLimit-Remaining", globalRemaining);
  next();
}
app.get("/api/test", ratelimiter, (req, res) => {
  res.json({
    message: "Request successful",
    remaining: res.get("X-RateLimit-Remaining"),
    globalRemaining: res.get("X-Global-RateLimit-Remaining"),
  });
});
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
