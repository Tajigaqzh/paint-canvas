import express from "express";

const PORT = 6174;
const IMAGE_ETAG = '"E9543AC4DD626AA9BA5AE1EDF652C1A4"';
const IMAGE_LAST_MODIFIED = "Tue, 22 Nov 2016 06:08:14 GMT";
const IMAGE_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAhElEQVR4nO3RQQ0AIBDAMMC/5+ONAvZoFSzZnUlz2Nt7BwAAAAAAAAAA4N07A9gBsgNkB8gOkB0gO0B2gOwA2QGyA2QHyA6QHSA7QHaA7ADZAbIDZAfIDpAdIDtAdoDsANkBsgNkB8gOkB0gO0B2gOwA2QGyA2QHyA6QHSA7QHaA7ADZAbIDZAfIblwCfNqgQQz+F+EAAAAASUVORK5CYII=",
  "base64",
);

const app = express();
let imageRequestCount = 0;
const imageRequests = [];

app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "http://localhost:5174");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,If-None-Match,If-Modified-Since",
  );
  response.setHeader(
    "Access-Control-Expose-Headers",
    "ETag,Last-Modified,X-Image-Test-Request-Count",
  );

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
});

app.get("/image.png", (request, response) => {
  imageRequestCount += 1;
  imageRequests.push({
    at: new Date().toISOString(),
    ifModifiedSince: request.header("if-modified-since") ?? null,
    ifNoneMatch: request.header("if-none-match") ?? null,
    requestNumber: imageRequestCount,
  });

  response.setHeader("Cache-Control", "public, max-age=2592000");
  response.setHeader("Content-Type", "image/png");
  response.setHeader("ETag", IMAGE_ETAG);
  response.setHeader("Last-Modified", IMAGE_LAST_MODIFIED);
  response.setHeader("X-Image-Test-Request-Count", String(imageRequestCount));

  if (
    request.header("if-none-match") === IMAGE_ETAG ||
    request.header("if-modified-since") === IMAGE_LAST_MODIFIED
  ) {
    response.status(304).end();
    return;
  }

  response.status(200).send(IMAGE_BYTES);
});

app.get("/stats", (_request, response) => {
  response.json({
    count: imageRequestCount,
    requests: imageRequests,
  });
});

app.post("/reset", (_request, response) => {
  imageRequestCount = 0;
  imageRequests.length = 0;
  response.json({ count: imageRequestCount });
});

app.listen(PORT, () => {
  console.log(`image cache test server listening on http://localhost:${PORT}`);
});
