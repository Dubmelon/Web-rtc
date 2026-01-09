const router = require('express').Router()
const { isAuthenticated } = require('../middleware/auth.js')
const userSchema = require('../src/config.js')
const FriendRequestSchema = require('../src/friends.js')
const ConversationSchema = require('../src/conversations.js')

let io

router.setIO = (socketIO) => {
    io = socketIO
}

// GET /friends
router.get('/friends', isAuthenticated, async (req, res) => {
    try {
        const user = await userSchema
            .findById(req.session.user.id)
            .populate('friends', 'name pfp')

        const users = await userSchema.find({}, 'name pfp')

        res.render('friends', {
            user,
            currentUserId: user._id.toString(),
            hasPfp: !!(user.pfp?.fileId),
            friends: user.friends || [],
            users
        })
    } catch (err) {
        console.error(err)
        res.status(500).send('Error loading friends')
    }
})

// POST /add-friend
router.post('/add-friend', isAuthenticated, async (req, res) => {
    try {
        const { friendId } = req.body
        const currentUserId = req.session.user.id

        if (!friendId) {
            return res.status(400).json({ error: 'Friend ID required' })
        }

        if (friendId === currentUserId) {
            return res.status(400).json({ error: 'Cannot add yourself' })
        }

        const [friendUser, currentUserData] = await Promise.all([
            userSchema.findById(friendId),
            userSchema.findById(currentUserId)
        ])

        if (!friendUser) {
            return res.status(404).json({ error: 'User not found' })
        }

        if (currentUserData.friends.includes(friendId)) {
            return res.status(400).json({ error: 'Already friends' })
        }

        const existingRequest = await FriendRequestSchema.findOne({
            $or: [
                { from: currentUserId, to: friendId },
                { from: friendId, to: currentUserId }
            ],
            status: 'pending'
        })

        if (existingRequest) {
            return res.status(400).json({ error: 'Request already exists' })
        }

        await FriendRequestSchema.create({
            from: currentUserId,
            to: friendId,
            status: 'pending'
        })

        io.to(friendId).emit('friend-request-received', {
            from: currentUserData.name,
            fromId: currentUserId
        })

        res.json({ success: true, friendName: friendUser.name })
    } catch (error) {
        console.error('Error sending friend request:', error)
        res.status(500).json({ error: 'Error sending friend request' })
    }
})

// POST /accept-friend
router.post('/accept-friend', isAuthenticated, async (req, res) => {
    try {
        const { requestId } = req.body
        const currentUserId = req.session.user.id

        const friendRequest = await FriendRequestSchema.findById(requestId)

        if (!friendRequest) {
            return res.status(404).json({ error: 'Request not found' })
        }

        if (friendRequest.to.toString() !== currentUserId) {
            return res.status(403).json({ error: 'Not authorized' })
        }

        friendRequest.status = 'accepted'
        await friendRequest.save()

        const [userA, userB] = [friendRequest.from, friendRequest.to]

        await Promise.all([
            userSchema.findByIdAndUpdate(userA, { $addToSet: { friends: userB } }),
            userSchema.findByIdAndUpdate(userB, { $addToSet: { friends: userA } })
        ])

        let conversation = await ConversationSchema.findOne({
            type: 'direct',
            participants: { $all: [userA, userB], $size: 2 }
        })

        if (!conversation) {
            conversation = await ConversationSchema.create({
                type: 'direct',
                participants: [userA, userB],
                createdBy: userA
            })

            await userSchema.updateMany(
                { _id: { $in: [userA, userB] } },
                { $addToSet: { conversations: conversation._id } }
            )
        }

        res.json({ success: true, conversationId: conversation._id })
    } catch (error) {
        console.error('Error accepting friend request:', error)
        res.status(500).json({ error: 'Error accepting friend request' })
    }
})

module.exports = router