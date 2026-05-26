const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");
const fileUpload = require("express-fileupload");
const router = require("./router");
const cookieParser = require("cookie-parser");
const { createTable } = require("./utils/createTable");
const { ErrorMiddleware } = require("./middlewares/errorMiddleware");
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLIENT_NAME,
  api_key: process.env.CLOUDINARY_CLIENT_API,
  api_secret: process.env.CLOUDINARY_CLIENT_SECRET,
});

app.use(
  cors({
    origin: [process.env.FRONTEND_URL, process.env.DASHBOARD_URL],
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(fileUpload({ tempFileDir: "./uploads", useTempFiles: true }));
//routers

router(app);
createTable();
app.use(ErrorMiddleware);
app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
