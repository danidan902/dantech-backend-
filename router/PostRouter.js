import express from "express";
import Post from "../models/Post.js";
import cloudinary from "../config/cloudinary.js";
import upload from "../middleware/upload.js";

const router = express.Router();

console.log("📦 routes/posts.js LOADED");

// Accept any 24-char hex string OR a mongoose ObjectId instance.
// This is the most permissive check that still works with Mongo.
const isValidId = (id) => {
  if (!id) return false;
  if (typeof id === "object" && typeof id.toString === "function") return true;
  if (typeof id !== "string") return false;
  return /^[a-fA-F0-9]{24}$/.test(id);
};

const toPlainPost = (p) => {
  const obj = p.toObject ? p.toObject() : { ...p };
  const idStr = String(obj._id || obj.id || "");
  obj._id = idStr;
  obj.id = idStr;
  delete obj.__v;
  return obj;
};

const uploadToCloudinary = (fileBuffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "posts", resource_type: "image" },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(fileBuffer);
  });

const safeDestroy = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary destroy failed:", publicId, err.message);
  }
};

const multerErrorMessage = (err) => {
  if (!err) return "File upload failed";
  switch (err.code) {
    case "LIMIT_FILE_SIZE":
      return "Image must be 5MB or smaller";
    case "LIMIT_UNEXPECTED_FILE":
      return `Unexpected field "${err.field}". Expected field name is "image".`;
    case "LIMIT_FILE_COUNT":
      return "Only one image can be uploaded";
    default:
      return err.message || "File upload failed";
  }
};

/* ============================================================
   GET ALL POSTS — defined FIRST so it can never fall through
   to /:id. Always returns 200, even when the DB is empty.
   ============================================================ */
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find().sort({ date: -1, createdAt: -1 });
    const data = posts.map(toPlainPost);
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("Get Posts Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch posts" });
  }
});

/* ============================================================
   CREATE POST
   ============================================================ */
router.post(
  "/",
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        console.error("Multer Error:", err);
        return res.status(400).json({ success: false, message: multerErrorMessage(err) });
      }
      next();
    });
  },
  async (req, res) => {
    let uploadedImage;
    try {
      const title = (req.body.title || "").trim();
      const description = (req.body.description || "").trim();

      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message: "Title and description are required",
        });
      }

      if (req.file) uploadedImage = await uploadToCloudinary(req.file.buffer);

      const created = await Post.create({
        title,
        description,
        image: uploadedImage?.secure_url || "",
        imagePublicId: uploadedImage?.public_id || "",
      });

      return res.status(201).json({
        success: true,
        message: "Post created successfully",
        data: toPlainPost(created),
      });
    } catch (error) {
      await safeDestroy(uploadedImage?.public_id);
      console.error("Create Post Error:", error);
      if (res.headersSent) return;
      return res.status(500).json({ success: false, message: "Failed to create post" });
    }
  }
);

/* ============================================================
   GET SINGLE POST — returns 404 for ANY bad id.
   NEVER returns "Invalid post ID" here.
   ============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    return res.status(200).json({ success: true, data: toPlainPost(post) });
  } catch (error) {
    console.error("Get Post Error:", error);
    return res.status(404).json({ success: false, message: "Post not found" });
  }
});

/* ============================================================
   UPDATE POST
   ============================================================ */
router.put(
  "/:id",
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        console.error("Multer Error:", err);
        return res.status(400).json({ success: false, message: multerErrorMessage(err) });
      }
      next();
    });
  },
  async (req, res) => {
    let uploadedImage;
    try {
      if (!isValidId(req.params.id)) {
        return res.status(404).json({ success: false, message: "Post not found" });
      }

      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ success: false, message: "Post not found" });

      const { title, description } = req.body;

      if (title !== undefined) {
        const t = String(title).trim();
        if (!t) return res.status(400).json({ success: false, message: "Title cannot be empty" });
        post.title = t;
      }
      if (description !== undefined) {
        const d = String(description).trim();
        if (!d) return res.status(400).json({ success: false, message: "Description cannot be empty" });
        post.description = d;
      }

      let oldPublicId = null;
      if (req.file) {
        uploadedImage = await uploadToCloudinary(req.file.buffer);
        oldPublicId = post.imagePublicId;
        post.image = uploadedImage.secure_url;
        post.imagePublicId = uploadedImage.public_id;
      }

      await post.save();
      if (oldPublicId) await safeDestroy(oldPublicId);

      return res.status(200).json({
        success: true,
        message: "Post updated successfully",
        data: toPlainPost(post),
      });
    } catch (error) {
      await safeDestroy(uploadedImage?.public_id);
      console.error("Update Post Error:", error);
      if (res.headersSent) return;
      return res.status(500).json({ success: false, message: "Failed to update post" });
    }
  }
);

/* ============================================================
   DELETE POST — the ONLY endpoint that returns "Invalid post ID",
   and only for a genuinely malformed id.
   ============================================================ */
router.delete("/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid post ID" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    if (post.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(post.imagePublicId);
      } catch (error) {
        console.error("Cloudinary image deletion failed:", error);
        return res.status(502).json({
          success: false,
          message: "Could not delete the post image. Post was not deleted.",
        });
      }
    }

    await Post.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Post and image deleted successfully",
    });
  } catch (error) {
    console.error("Delete Post Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete post" });
  }
});

export default router;