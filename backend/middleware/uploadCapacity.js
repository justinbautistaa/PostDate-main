// Shared across signup and profile uploads, before Multer buffers a batch.
function createUploadCapacity() {
  let active = false;
  return function withUploadCapacity(parse, handle, validate = (_req, _res, next) => next()) {
    return function uploadRequest(req, res, next) {
      const needsSlot = Boolean(req.is('multipart/form-data'));
      if (needsSlot && active) {
        res.set('Retry-After', '5');
        return res.status(503).json({ message: 'Photo uploads are busy. Please try again in a few seconds.' });
      }
      if (needsSlot) active = true;
      let released = false;
      let processing = false;
      const release = () => {
        if (released) return;
        released = true;
        if (needsSlot) active = false;
        res.off('finish', onEnd);
        res.off('close', onEnd);
      };
      // Disconnecting does not cancel an image conversion or provider call.
      // Keep its slot until the asynchronous handler actually settles.
      const onEnd = () => { if (!processing) release(); };
      const fail = error => { release(); next(error); };
      res.once('finish', onEnd);
      res.once('close', onEnd);
      try {
        parse(req, res, error => {
          if (error) return fail(error);
          if (res.destroyed) return release();
          try {
            validate(req, res, error => {
              if (error) return fail(error);
              processing = true;
              Promise.resolve().then(() => handle(req, res, next)).catch(next).finally(release);
            });
          } catch (error) { fail(error); }
        });
      } catch (error) { fail(error); }
    };
  };
}
const withUploadCapacity = createUploadCapacity();
module.exports = { withUploadCapacity, createUploadCapacity };
