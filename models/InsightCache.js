import mongoose from 'mongoose';

const insightCacheSchema = new mongoose.Schema(
  {
    locationId:    { type: Number, required: true },
    provider:      { type: String, enum: ['openai'], required: true },
    city:          { type: String, required: true },
    category:      { type: String, required: true },
    insights: {
      summary:            String,
      highlights:         [String],
      best_for:           [String],
      pros:               [String],
      cons:               [String],
      best_time_to_visit: String,
      things_to_verify:   [String],
      confidence_note:    String,
    },
    promptVersion: { type: String, required: true },
    createdAt:     { type: Date, default: Date.now, expires: 604800 }, // 7-day TTL
  },
  { timestamps: false }
);

insightCacheSchema.index(
  { locationId: 1, provider: 1, city: 1, category: 1 },
  { unique: true }
);

export default mongoose.model('InsightCache', insightCacheSchema);
