import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  googleId: String,
  password: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
},
{
  timestamps: true
});

export default mongoose.model("User", UserSchema);
