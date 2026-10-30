import express from "express";
import { PORT } from "./utils/env";

async function init() {
  try {
    const app = express();

    app.get("/", (req, res) => {
      res.send("Hello World");
    });
    app.listen(PORT, () => {
      console.log(`Server's running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(error);
  }
}

init();
