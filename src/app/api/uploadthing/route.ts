import { createRouteHandler } from "uploadthing/next";

import { candidateFileRouter } from "./core";

/**
 * uploadthing route handler — exposes `GET`/`POST /api/uploadthing`. The token
 * is read from `UPLOADTHING_TOKEN` (validated in `@/lib/env`).
 */
export const { GET, POST } = createRouteHandler({
  router: candidateFileRouter,
});
