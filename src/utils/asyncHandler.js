// Wraps an async route handler so thrown errors reach Express's error middleware
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
