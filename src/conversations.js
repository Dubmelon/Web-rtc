const mongoose = require('mongoose')

const ConversationSchema = new mongoose.Schema({
    // Participants in the conversation
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    }],
    // Type: 'direct' for 1-on-1, 'group' for group chats
    type: {
        type: String,
        enum: ["direct", "group"],
        default: "direct"
    },
    // For group chats
    name: {
        type: String,
        default: ""
    },
    groupIcon: {
        fileId: {type: mongoose.Schema.Types.ObjectId},
        filename: String
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message"
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    // Who created the conversation (for groups)
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    // For group admins
    admins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
})

// Index for finding conversations by participants
ConversationSchema.index({ participants: 1 })

module.exports = mongoose.model("Conversation", ConversationSchema)