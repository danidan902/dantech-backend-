import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    image: { type: String, default: "" },
    imagePublicId: { type: String, default: "" },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Post", postSchema);