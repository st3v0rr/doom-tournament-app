function errorHandler(err, req, res, _next) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', err.message, err.stack);
  } else {
    console.error('[ERROR]', err.message);
  }
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
