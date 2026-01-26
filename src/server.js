import dotenv from "dotenv";
dotenv.config(); // ✅ FIRST LINE

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import projectRoutes from "./routes/project.routes.js";
import overviewRoutes from "./routes/overview.routes.js";
import performanceRoutes from "./routes/performance.routes.js";
import integrationRoutes from "./routes/integration.routes.js";
import shopifyRoutes from "./routes/shopify.routes.js";
import webflowRoutes from "./routes/webflow.routes.js";
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "success", message: "Backend running 🚀" });
});

app.use("/auth", authRoutes);
app.use("/projects", projectRoutes);
app.use("/overview", overviewRoutes);
app.use("/performance", performanceRoutes);
app.use("/integrations", integrationRoutes);
app.use("/shopify", shopifyRoutes);
app.use("/webflow", webflowRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
