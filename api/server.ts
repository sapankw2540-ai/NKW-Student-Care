import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { createContext } from "../server/_core/context";
import { appRouter } from "../server/routers/index";

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

app.use(
  "/api/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`❌ tRPC Error on ${path}:`, error);
    },
  })
);

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    env: {
      hasUrl: !!process.env.SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_ANON_KEY
    }
  });
});

export default app;
