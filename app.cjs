// Startup file for cPanel's Node.js hosting (Passenger).
// Passenger loads apps the older "require" way, so this file loads the
// modern-style server.js for it. Locally, "npm start" runs server.js directly.
import("./server.js").catch((error) => {
  console.error(error);
  process.exit(1);
});
