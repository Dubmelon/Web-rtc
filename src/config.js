const mongoose = require('mongoose')
const connect = mongoose.connect("mongodb://localhost:27017/Login")

connect.then(() => {
    console.log("db connected")
})
.catch(() => {
    console.log("database not connected")
})

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    password: { 
        type: String,
        required: true
    },
    id: {
        type: String,
        required: true
    },
    location:{
        type: String,
        required: false,
        default:""
    },
    occupation:{
        type: String,
        required: false,
        default:""
    },
    website:{
        type: String,
        required: false,
        default:""
    },
    pfp: {
        fileId: {type: mongoose.Schema.Types.ObjectId},
        filename: String,
        pfpId: String
    },
    bio: {
        type: String,
        default: ""
    },
    conversations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation"
    }],
    followers: [{  
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    }],
    following: [{  
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    }],
    friends: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    }],
    servers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "server"
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
})

const collection = new mongoose.model("users", UserSchema)

module.exports = collection