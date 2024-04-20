import express from "express";
const app = express();
import routes from "./src/route/route.js";
console.log("ok");
app.use(express.json());
app.use("/", routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
