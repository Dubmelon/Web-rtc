const mongoose = require("mongoose")

const ServerSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    members: [{
        user:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "users"
        },
        roles:[{
            type: mongoose.Schema.Types.ObjectId,
            ref: "role"
        }]
    }],
    createdAt:{
        type: Date,
        default: Date.now
    },
        icon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File' // or whatever your file/image model is called
    }
})

module.exports = mongoose.model("server",ServerSchema)



//server Db not server file