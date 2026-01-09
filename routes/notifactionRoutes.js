const express = require('express');
const router = express.Router();
const FriendRequestSchema = require('../src/friends');
const Conversation = require('../src/conversations');
const Message= require('../src/message');
const User = require('../src/config');
const { isAuthenticated } = require('../middleware/auth')
// GET all notifications for a user
router.get('/api/notifications/:userId',isAuthenticated, async (req, res) => {
    try {
        const { userId } = req.params;

        // Find user by custom id field
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get pending friend requests using MongoDB _id
        const friendRequests = await FriendRequestSchema.find({
            to: user._id,
            status: 'pending'
        })
        .populate('from', 'name pfp id')
        .sort({ createdAt: -1 });

        // Get unread message notifications
        const conversations = await Conversation.find({
            participants: user._id
        }).select('_id participants type name');

        // For each conversation, find messages not read by the user
        const unreadMessagesPromises = conversations.map(async (conv) => {
            const unreadMessages = await Message.find({
                conversation: conv._id,
                sender: { $ne: user._id },
                'readBy.user': { $ne: user._id }
            })
            .populate('sender', 'name pfp id')
            .sort({ createdAt: -1 })
            .limit(1);

            if (unreadMessages.length > 0) {
                const unreadCount = await Message.countDocuments({
                    conversation: conv._id,
                    sender: { $ne: user._id },
                    'readBy.user': { $ne: user._id }
                });

                return {
                    conversation: conv,
                    latestMessage: unreadMessages[0],
                    unreadCount
                };
            }
            return null;
        });

        const unreadMessageData = (await Promise.all(unreadMessagesPromises))
            .filter(item => item !== null);

        // Format notifications
        const notifications = {
            friendRequests: friendRequests.map(req => ({
                id: req._id,
                type: 'friend_request',
                from: {
                    _id: req.from._id,
                    id: req.from.id,
                    name: req.from.name,
                    pfp: req.from.pfp
                },
                message: `${req.from.name} sent you a friend request`,
                createdAt: req.createdAt,
                data: {
                    requestId: req._id
                }
            })),
            messages: unreadMessageData.map(item => {
                return {
                    id: item.latestMessage._id,
                    type: 'message',
                    from: {
                        _id: item.latestMessage.sender._id,
                        id: item.latestMessage.sender.id,
                        name: item.latestMessage.sender.name,
                        pfp: item.latestMessage.sender.pfp
                    },
                    message: item.latestMessage.content.substring(0, 50) + (item.latestMessage.content.length > 50 ? '...' : ''),
                    createdAt: item.latestMessage.createdAt,
                    unreadCount: item.unreadCount,
                    data: {
                        conversationId: item.conversation._id,
                        conversationType: item.conversation.type,
                        conversationName: item.conversation.name
                    }
                };
            }),
            total: friendRequests.length + unreadMessageData.length
        };

        res.json({ success: true, notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST accept friend request
router.post('/api/accept-friend', async (req, res) => {
    try {
        const { requestId, userId } = req.body;

        // Find current user by custom id
        const currentUser = await User.findOne({ id: userId });
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const friendRequest = await FriendRequestSchema.findById(requestId);

        if (!friendRequest) {
            return res.status(404).json({ error: 'Friend request not found' });
        }

        // Make sure this request is for the current user (compare MongoDB _id)
        if (friendRequest.to.toString() !== currentUser._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Update request status
        friendRequest.status = 'accepted';
        await friendRequest.save();

        // Add to both users' friend lists using MongoDB _id
        await User.findByIdAndUpdate(friendRequest.from, {
            $addToSet: { friends: friendRequest.to }
        });

        await User.findByIdAndUpdate(friendRequest.to, {
            $addToSet: { friends: friendRequest.from }
        });

        // Create a direct conversation between the two users if it doesn't exist
        let conversation = await Conversation.findOne({
            type: 'direct',
            participants: { $all: [friendRequest.from, friendRequest.to], $size: 2 }
        });

        if (!conversation) {
            conversation = new Conversation({
                participants: [friendRequest.from, friendRequest.to],
                type: 'direct',
                createdBy: friendRequest.to
            });
            await conversation.save();

            // Add conversation to both users
            await User.updateMany(
                { _id: { $in: [friendRequest.from, friendRequest.to] } },
                { $addToSet: { conversations: conversation._id } }
            );
        }

        res.json({ 
            success: true, 
            message: 'Friend request accepted',
            conversationId: conversation._id
        });

    } catch (error) {
        console.error('Error accepting friend request:', error);
        res.status(500).json({ error: 'Error accepting friend request' });
    }
});

// POST reject friend request
router.post('/api/reject-friend', async (req, res) => {
    try {
        const { requestId, userId } = req.body;

        // Find current user by custom id
        const currentUser = await User.findOne({ id: userId });
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const friendRequest = await FriendRequestSchema.findById(requestId);

        if (!friendRequest) {
            return res.status(404).json({ error: 'Friend request not found' });
        }

        if (friendRequest.to.toString() !== currentUser._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        friendRequest.status = 'rejected';
        await friendRequest.save();

        res.json({ success: true, message: 'Friend request rejected' });

    } catch (error) {
        console.error('Error rejecting friend request:', error);
        res.status(500).json({ error: 'Error rejecting friend request' });
    }
});

// POST mark conversation messages as read
router.post('/mark-read/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { userId } = req.body;

        // Find user by custom id field
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update all unread messages in this conversation using MongoDB _id
        await Message.updateMany(
            {
                conversation: conversationId,
                sender: { $ne: user._id },
                'readBy.user': { $ne: user._id }
            },
            {
                $push: {
                    readBy: {
                        user: user._id,
                        readAt: new Date()
                    }
                }
            }
        );

        res.json({ success: true, message: 'Messages marked as read' });

    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;