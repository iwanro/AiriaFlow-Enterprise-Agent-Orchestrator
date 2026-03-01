import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { TaskStatus } from "./src/types";

const db = new Database("tasks.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    priority TEXT,
    status TEXT,
    result TEXT,
    createdAt TEXT
  );
  CREATE TABLE IF NOT EXISTS steps (
    id TEXT PRIMARY KEY,
    taskId TEXT,
    agentName TEXT,
    action TEXT,
    status TEXT,
    timestamp TEXT,
    details TEXT,
    FOREIGN KEY(taskId) REFERENCES tasks(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/tasks", (req, res) => {
    const tasks = db.prepare("SELECT * FROM tasks ORDER BY createdAt DESC").all();
    const tasksWithSteps = tasks.map((task: any) => {
      const steps = db.prepare("SELECT * FROM steps WHERE taskId = ?").all(task.id);
      return { ...task, steps };
    });
    res.json(tasksWithSteps);
  });

  app.post("/api/tasks", (req, res) => {
    const { id, title, description, priority, status, createdAt } = req.body;
    db.prepare("INSERT INTO tasks (id, title, description, priority, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, title, description, priority, status, createdAt);
    res.json({ success: true });
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { status, result } = req.body;
    if (result !== undefined) {
      db.prepare("UPDATE tasks SET status = ?, result = ? WHERE id = ?").run(status, result, req.params.id);
    } else {
      db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, req.params.id);
    }
    res.json({ success: true });
  });

  app.post("/api/tasks/:id/steps", (req, res) => {
    const { id: stepId, agentName, action, status, timestamp } = req.body;
    db.prepare("INSERT INTO steps (id, taskId, agentName, action, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)")
      .run(stepId, req.params.id, agentName, action, status, timestamp);
    res.json({ success: true });
  });

  app.patch("/api/steps/:id", (req, res) => {
    const { status, details } = req.body;
    db.prepare("UPDATE steps SET status = ?, details = ? WHERE id = ?").run(status, details, req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
