const express = require("express");
const app = express();
const PORT = 3000;

//for rate limiting config
const window_size = 10 * 1000; //10 seconds
const max_window_request = 1; //max 1 request in 10 seconds
// IN-MEMORY STORE
const rateLimitStore = {};

//middleware for rate limiting
function ratelimiter(req, res, next) {
  const userId = req.query.userId;
  //   console.log(req.query);

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }
  const currentTime = Date.now();
  if (!rateLimitStore[userId]) {
    rateLimitStore[userId] = {
      count: 1,
      startTime: currentTime,
    };
    return next();
  }

  const userData = rateLimitStore[userId];
  if (currentTime - userData.startTime > window_size) {
    rateLimitStore[userId] = {
      count: 1,
      startTime: currentTime,
    };
    return next();
  }
  if (userData.count < max_window_request) {
    userData.count += 1;
    //in javascript objects are passed by  reference (for objects and arrays).
    // rateLimitStore[userId] = userData;
    return next();
  } else {
    res.status(429).json({
      message: "Too many requests. Please try again later.",
      retryAfter: Math.ceil(
        (window_size - (currentTime - userData.startTime)) / 1000,
      ),
    });
    return next();
  }
}
app.get("/api/test", ratelimiter, (req, res) => {
  res.json({ message: "Request successful" });
});
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
