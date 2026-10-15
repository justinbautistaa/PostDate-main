const supertest = require("supertest");
module.exports = app => {
  const client = supertest(app);
  for (const method of ["post", "put", "patch", "delete"]) {
    const original = client[method].bind(client);
    client[method] = url => original(url).set("X-PostDate-Request", "1");
  }
  return client;
};
