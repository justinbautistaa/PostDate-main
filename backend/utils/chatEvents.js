const events = new (require("events").EventEmitter)();
events.setMaxListeners(0);
module.exports = events;
