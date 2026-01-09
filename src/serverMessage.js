const mongoose = require('mongoose')

const ServerMessageSchema = new mongoose.Schema({
    channel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "channel",
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
      replyTo: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServerMessage"
    },
    attachments: [{
        fileId: {type: mongoose.Schema.Types.ObjectId},
        filename: String,
        fileType: String 
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

ServerMessageSchema.index({ channel: 1, createdAt: -1 })

module.exports = mongoose.model("ServerMessage", ServerMessageSchema)