import serverless from "serverless-http";
import { app } from "../../api";

const FN_PREFIX = "/.netlify/functions/api";

const wrapped = serverless(app);

// ponytail: Netlify may deliver either the rewritten /api/* path or the raw
// function path; normalize so Express sees its own routes either way.
export const handler = async (event: any, context: any) => {
  if (event.path?.startsWith(FN_PREFIX)) {
    event.path = "/api" + event.path.slice(FN_PREFIX.length);
    if (event.rawUrl) event.rawUrl = event.rawUrl.replace(FN_PREFIX, "/api");
  }
  return wrapped(event, context);
};
