import mongoose from 'mongoose';

const searchSchema = new mongoose.Schema({
  city: { type: String, required: true },
  category: { type: String, required: true },
  menuItems: [String],
  strategy: { type: String, enum: ['gap', 'cluster', 'both'], default: 'gap' },
  results: { type: Array, default: [] },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Search', searchSchema);
