import mongoose from 'mongoose';

const oneDriveAuthTempSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    unique: true,
  },
  codeVerifier: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '10m' }, // অটো ডিলিট হয়ে যাবে ১০ মিনিট পর
  },
}, { timestamps: true });

export const OneDriveAuthTemp = mongoose.model('OneDriveAuthTemp', oneDriveAuthTempSchema);