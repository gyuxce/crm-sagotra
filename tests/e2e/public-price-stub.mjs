import { createServer } from "node:http";

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200).end("ok");
    return;
  }

  if (request.method === "POST" && request.url === "/rest/v1/rpc/crm_public_experience_prices") {
    request.resume();
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify([
      { experience_id: "e2e-dalem-pakuningratan", experience_slug: "dalem-pakuningratan", sale_price: 123456 },
      { experience_id: "e2e-dalem-benawan", experience_slug: "dalem-benawan", sale_price: 0 },
    ]));
    return;
  }

  request.resume();
  response.writeHead(503, { "content-type": "application/json" }).end(JSON.stringify({ message: "Local smoke stub: no database writes" }));
});

server.listen(3217, "127.0.0.1");
