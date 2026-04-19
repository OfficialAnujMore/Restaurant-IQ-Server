import mongoose from 'mongoose';

const savedLocationSchema = new mongoose.Schema({
  rank: Number,
  lat: Number,
  lng: Number,
  city: String,
  category: String,
  totalScore: Number,
  scores: {
    populationScore: Number,
    incomeScore: Number,
    anchorScore: Number,
    competitorScore: Number,
    footScore: Number,
    catchmentScore: Number,
  },
  population: Number,
  medianIncome: Number,
  nearestAnchor: String,
  competitorCount: Number,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  savedAt: { type: Date, default: Date.now },
});

export default mongoose.model('SavedLocation', savedLocationSchema);
