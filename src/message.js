const mongoose = require('mongoose')

const MessageSchema = new mongoose.Schema({
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    content: {
        type: String,
        required: false
    },
    attachments: [{
        fileId: {type: mongoose.Schema.Types.ObjectId},
        filename: String,
        fileType: String 
    }],
    readBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users"
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    reactions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users"
        },
        emoji: String
    }],
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: Date,
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

MessageSchema.index({ conversation: 1, createdAt: -1 })

module.exports = mongoose.model("Message", MessageSchema)