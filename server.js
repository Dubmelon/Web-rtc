const express = require('express')
const session = require('express-session')
const mongoose = require('mongoose')
const { GridFSBucket } = require('mongodb')

const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)

// GridFS bucket
let gridfsBucket

// Import routes
const authRoutes = require('./routes/authRoutes')
const viewRoutes = require('./routes/viewRoutes')
const profileRoutes = require('./routes/profileRoutes')
const fileRoutes = require('./routes/fileRoutes')
const friendRoutes = require('./routes/friendRoutes')
const serverRoutes = require('./routes/serverRoutes')
const messageRoutes = require('./routes/messageRoutes')
const conversationRoutes = require('./routes/conversationRoutes')
const roomRoutes = require('./routes/roomRoutes')
const notificationRoutes = require('./routes/notifactionRoutes')
// App setup
app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(session({
    secret: 'your-secret-key-here',
    resave: false,
    saveUninitialized: false
}))

// Initialize GridFS when MongoDB connects
mongoose.connection.once('open', () => {
    gridfsBucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
    })
    
    // Pass GridFS bucket to routes that need it
    profileRoutes.setGridFSBucket(gridfsBucket)
    fileRoutes.setGridFSBucket(gridfsBucket)
    serverRoutes.setGridFSBucket(gridfsBucket)
    console.log('GridFS initialized')
})

// Pass socket.io to routes that need it
friendRoutes.setIO(io)


// Use routes
app.use('/', viewRoutes)
app.use('/', authRoutes)
app.use('/', notificationRoutes)
app.use('/', profileRoutes)
app.use('/', fileRoutes)
app.use('/', serverRoutes)
app.use('/', friendRoutes)
app.use('/', messageRoutes)
app.use('/', conversationRoutes)
app.use('/', roomRoutes)

// Socket.io events
io.on('connection', socket => {
    socket.on('join-conversation', (conversationId) => {
        socket.join(conversationId)
    })

    socket.on('leave-conversation', (conversationId) => {
        socket.leave(conversationId)
    })

    socket.on('typing', (conversationId, userId) => {
        socket.to(conversationId).emit('user-typing', userId)
    })

    socket.on('stop-typing', (conversationId, userId) => {
        socket.to(conversationId).emit('user-stopped-typing', userId)
    })

    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId)
        socket.to(roomId).emit('user-connected', userId)

        socket.on('stream-updated', (streamUserId) => {
            socket.to(roomId).emit('user-stream-updated', streamUserId)
        })

        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId)
        })
    })
})

// Start server
server.listen(3000, () => {
    console.log('Server started on http://localhost:3000')
})