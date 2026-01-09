const mongoose = require('mongoose');

const FriendRequestSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,  // This should be MongoDB _id
        ref: "users",
        required: true
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,  // This should be MongoDB _id
        ref: "users",
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

FriendRequestSchema.index({ from: 1, to: 1 }, { unique: true });

module.exports = mongoose.model("FriendRequest", FriendRequestSchema);