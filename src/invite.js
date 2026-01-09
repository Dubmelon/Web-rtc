const mongoose = require("mongoose")

const InviteSchema = new mongoose.Schema({
    code:{
        type: String,
        required: true
    },
    server: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "server"
    },
    inviter:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    },
    uses:{
        type: Number,
        default: 0
    },
    maxUses:{
        type: Number,
        default: 100
    },
    expresAt:{
        type: Date
    }
})

module.exports = mongoose.model("invite",InviteSchema)