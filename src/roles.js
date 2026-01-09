const mongoose = require("mongoose")

const RoleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    color: {
        type: String,
        default: '#5865f2'
    },
    permissions: {
        type: [String],
        default: []
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

module.exports = mongoose.model("role", RoleSchema)