const router = require('express').Router()
const { isAuthenticated } = require('../middleware/auth')
const ConversationSchema = require('../src/conversations.js')
const userSchema = require('../src/config.js')

// GET /conversations/:id
router.get('/conversations/:id', isAuthenticated, (req, res) => {
    res.render('messages', {
        userId: req.session.user.id,
        conversation: req.params.id
    })
})
router.get('/users/:userId/conversations', isAuthenticated, async (req, res) => {
    try {
        // Populate participants to get names/avatars
        const conversations = await ConversationSchema.find({ 
            participants: req.params.userId 
        })
        .populate('participants', 'name pfp') 
        .sort({ updatedAt: -1 })

        res.json({ success: true, conversations })
    } catch (error) {
        console.error('Error fetching conversations:', error)
        res.status(500).json({ error: 'Error fetching conversations' })
    }
})
router.post('/conversations/:conversationId/messages', isAuthenticated, async (req, res) => {
    try {
        const { senderId, content, attachments} = req.body
        
        const newMessage = await MessageSchema.create({
            conversation: req.params.conversationId,
            sender: senderId,
            content: content,
            attachments: attachments
        })

        // Update the conversation's 'updatedAt' timestamp so it moves to the top of the list
        await ConversationSchema.findByIdAndUpdate(req.params.conversationId, {
            updatedAt: new Date()
        })

        // Populate sender before returning to match frontend expectations
        await newMessage.populate('sender', 'name pfp')

        res.json({ success: true, message: newMessage })
    } catch (error) {
        console.error('Error sending message:', error)
        res.status(500).json({ error: 'Error sending message' })
    }
})
router.get('/conversations/:conversationId/messages', isAuthenticated, async (req, res) => {
    try {
        const messages = await MessageSchema.find({ 
            conversation: req.params.conversationId 
        })
        .populate('sender', 'name pfp')
        .sort({ createdAt: 1 }) // Sort by date ascending

        res.json({ success: true, messages })
    } catch (error) {
        console.error('Error fetching messages:', error)
        res.status(500).json({ error: 'Error fetching messages' })
    }
})

// GET /start-conversation/:friendId
router.get('/start-conversation/:friendId', isAuthenticated, async (req, res) => {
       try {
        const userId = req.session.user.id
        const { friendId } = req.params

        let convo = await ConversationSchema.findOne({
            type: 'direct',
            participants: { $all: [userId, friendId], $size: 2 }
        })

        if (!convo) {
            convo = await ConversationSchema.create({
                type: 'direct',
                participants: [userId, friendId],
                createdBy: userId
            })

            await userSchema.updateMany(
                { _id: { $in: [userId, friendId] } },
                { $addToSet: { conversations: convo._id } }
            )
        }

        res.redirect(`/conversations/${convo._id}`)
    } catch (error) {
        console.error('Error starting conversation:', error)
        res.status(500).send('Error starting conversation')
    }
})



// POST /conversations/create
router.post('/conversations/create', isAuthenticated, async (req, res) => {
    try {
        const { participantId } = req.body
        const currentUserId = req.session.user.id

        let conversation = await ConversationSchema.findOne({
            type: 'direct',
            participants: { $all: [currentUserId, participantId] }
        })

        if (!conversation) {
            conversation = await ConversationSchema.create({
                participants: [currentUserId, participantId],
                type: 'direct'
            })
        }

        res.json({ success: true, conversationId: conversation._id })
    } catch (error) {
        console.error('Error creating conversation:', error)
        res.status(500).json({ error: 'Error creating conversation' })
    }
})

module.exports = router