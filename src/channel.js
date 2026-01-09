const mongoose = require("mongoose")

const ChannelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['text', 'voice'],
        default: 'text'
    },
    server: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "server",
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model("channel", ChannelSchema)