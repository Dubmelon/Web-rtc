const express = require('express');
const router = express.Router();
const Server = require('../src/servers'); // Adjust path
const User = require('../src/config'); // Adjust path
const Channel = require('../src/channel'); // Adjust path
const Role = require('../src/roles'); // Adjust path
const Invite = require('../src/invite'); // Adjust path
const ServerMessage = require('../src/serverMessage'); // Adjust path
const multer = require('multer');
const crypto = require('crypto');
const { isAuthenticated } = require('../middleware/auth')

router.get('/serverId/:serverId',isAuthenticated, async (req, res) => {
    try {
        const { serverId } = req.params;
        const userId = req.session.user.id; // Changed from req.session.user.id
        
        // Check if server exists
        const server = await Server.findById(serverId)
            .populate('owner', 'name id')
            .populate('members.user', 'name id');
        
        if (!server) {
            return res.status(404).send('Server not found');
        }
        
        // Check if user is a member of the server
        const isMember = server.members.some(m => m.user._id.toString() === userId);
        const isOwner = server.owner._id.toString() === userId;
        
        if (!isMember && !isOwner) {
            return res.status(403).send('You are not a member of this server');
        }
        
        // Render the server page with user data
        res.render('serverId', {
            userId: userId,
            serverId: serverId,
            serverName: server.name,
            serverIcon: server.icon
        });
        
    } catch (err) {
        console.error('Error loading server page:', err);
        res.status(500).send('Server error');
    }
});
// Get user's servers
router.get('/serverDiscover', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Find all servers where user is owner or member
        const servers = await Server.find({
            $or: [
                { owner: userId },
                { 'members.user': userId }
            ]
        })
        .populate('owner', 'name id')
        .populate('members.user', 'name id')
        .sort({ createdAt: -1 });
        
        res.render('serverDiscoverPage', {
            userId: userId,
            userName: req.session.user.name,
            servers: servers,
            owner: servers.owner
        });
        
    } catch (err) {
        console.error('Error loading servers:', err);
        res.status(500).send('Server error');
    }
});

// API endpoint to get user's servers (if you need it for frontend JS)
router.get('/api/serverDiscover', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        const servers = await Server.find({
            $or: [
                { owner: userId },
                { 'members.user': userId }
            ]
        })
        .populate('owner', 'name id')
        .select('name description icon owner members createdAt')
        .sort({ createdAt: -1 });
        
        res.json({ success: true, servers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// Get all servers (for discovery)
router.get('/api/all-servers', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Get all servers with proper population
        const servers = await Server.find({})
            .populate('owner', 'name id')
            .populate('members.user', 'name id')  // Add this line
            .select('name description icon owner members createdAt')
            .sort({ createdAt: -1 });
        
        console.log('First server data:', JSON.stringify(servers[0], null, 2)); // Debug log
        
        res.json({ success: true, servers });
    } catch (err) {
        console.error('Error in /api/all-servers:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/create-servers',isAuthenticated, async (req,res)=>{
        res.render('create-servers')
})
// Middleware to check if user is server owner
const isServerOwner = async (req, res, next) => {
    try {
        const server = await Server.findById(req.params.serverId);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        if (server.owner.toString() !== req.session.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        req.server = server;
        next();
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
// Add this line
let gridfsBucket;

// Add this function to set the bucket (just like in your file routes)
router.setGridFSBucket = (bucket) => {
    gridfsBucket = bucket;
};
// Get server details
router.get('/api/serverId/:serverId', isAuthenticated, async (req, res) => {
    try {
        const server = await Server.findById(req.params.serverId)
            .populate('owner', 'name id')
            .populate('members.user', 'name id');
        
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        res.json({ success: true, server });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get server channels
router.get('/api/serverId/:serverId/channels', isAuthenticated, async (req, res) => {
    try {
        const channels = await Channel.find({ server: req.params.serverId })
            .sort({ createdAt: 1 });
        
        res.json({ success: true, channels });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create channel
router.post('/api/serverId/:serverId/channels', isAuthenticated, isServerOwner, async (req, res) => {
    try {
        const { name, type } = req.body;
        
        const channel = new Channel({
            name,
            type: type || 'text',
            server: req.params.serverId
        });
        
        await channel.save();
        
        res.json({ success: true, channel });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get server members
router.get('/api/serverId/:serverId/members', isAuthenticated, async (req, res) => {
    try {
        const server = await Server.findById(req.params.serverId)
            .populate('members.user', 'name id pfp')
            .populate('owner', 'name id');
        
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        res.json({ success: true, members: server.members });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create invite
router.post('/api/serverId/:serverId/invite', isAuthenticated, async (req, res) => {
    try {
        const server = await Server.findById(req.params.serverId);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        // Check if user is a member
        const isMember = server.members.some(m => m.user.toString() === req.session.user.id);
        if (!isMember && server.owner.toString() !== req.session.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        
        // Generate unique invite code
        const code = crypto.randomBytes(8).toString('hex');
        
        const invite = new Invite({
            code,
            server: req.params.serverId,
            inviter: req.session.user.id
        });
        
        await invite.save();
        
        res.json({ success: true, code });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.post('/api/join/:serverId', isAuthenticated, async (req, res)=>{
        try {
        const server = await Server.findById(req.params.serverId);
        
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        // Check if already a member
        const isMember = server.members.some(m => m.user.toString() === req.session.user.id);
        if (isMember) {
            return res.json({ success: true, server, alreadyMember: true });
        }
        
        // Add user to server
        server.members.push({ user: req.session.user.id, roles: [] });
        await server.save();
        
        // Add server to user's servers
        await User.findByIdAndUpdate(req.session.user.id, {
            $addToSet: { servers: server._id }
        });
        
        res.json({ success: true, server });
        }catch(error){
            console.log("Error adding to server: ",error)
        }})
// Join server via invite
router.post('/api/invite/:code/join', isAuthenticated, async (req, res) => {
    try {
        const invite = await Server.findOne({ code: req.params.code })
            .populate('server');
        
        if (!invite) {
            return res.status(404).json({ success: false, message: 'Invalid invite' });
        }
        
        // Check if invite expired
        if (invite.expiresAt && invite.expiresAt < new Date()) {
            return res.status(400).json({ success: false, message: 'Invite expired' });
        }
        
        // Check if max uses reached
        if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
            return res.status(400).json({ success: false, message: 'Invite max uses reached' });
        }
        
        const server = await Server.findById(invite.server._id);
        
        // Check if already a member
        const isMember = server.members.some(m => m.user.toString() === req.session.user.id);
        if (isMember) {
            return res.json({ success: true, server, alreadyMember: true });
        }
        
        // Add user to server
        server.members.push({ user: req.session.user.id, roles: [] });
        await server.save();
        
        // Add server to user's servers
        await User.findByIdAndUpdate(req.session.user.id, {
            $addToSet: { servers: server._id }
        });
        
        // Increment invite uses
        invite.uses += 1;
        await invite.save();
        
        res.json({ success: true, server });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get invite details
router.get('/invite/:code',isAuthenticated, async (req, res) => {
    try {
        const invite = await Invite.findOne({ code: req.params.code })
            .populate('server', 'name icon')
            .populate('inviter', 'name');
        
        if (!invite) {
            return res.status(404).json({ success: false, message: 'Invalid invite' });
        }
        
        // Check if invite expired
        if (invite.expiresAt && invite.expiresAt < new Date()) {
            return res.status(400).json({ success: false, message: 'Invite expired' });
        }
        
        res.json({ success: true, invite });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update server
router.put('/api/serverId/:serverId', isAuthenticated, isServerOwner, upload.single('icon'), async (req, res) => {
    try {
        const { name } = req.body;
        const server = req.server;
        
        if (name) {
            server.name = name;
        }
        
        // Handle icon upload if provided
        if (req.file) {
            // You'll need to implement file storage logic here
            // This is a placeholder
            server.icon = {
                filename: req.file.originalname
            };
        }
        
        await server.save();
        
        res.json({ success: true, server });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get server roles
router.get('/api/serverId/:serverId/roles', isAuthenticated, async (req, res) => {
    try {
        const roles = await Role.find({ server: req.params.serverId })
            .sort({ createdAt: 1 });
        
        res.json({ success: true, roles });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create role
router.post('/api/serverId/:serverId/roles', isAuthenticated, isServerOwner, async (req, res) => {
    try {
        const { name, color } = req.body;
        
        const role = new Role({
            name,
            color: color || '#5865f2',
            server: req.params.serverId
        });
        
        await role.save();
        
        res.json({ success: true, role });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete role
router.delete('/api/serverId/:serverId/roles/:roleId', isAuthenticated, isServerOwner, async (req, res) => {
    try {
        await Role.findByIdAndDelete(req.params.roleId);
        
        // Remove role from all members
        const server = await Server.findById(req.params.serverId);
        server.members.forEach(member => {
            member.roles = member.roles.filter(r => r.toString() !== req.params.roleId);
        });
        await server.save();
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Kick member
router.post('/api/servers/:serverId/kick/:userId', isAuthenticated, isServerOwner, async (req, res) => {
    try {
        const server = req.server;
        
        // Remove member from server
        server.members = server.members.filter(m => m.user.toString() !== req.params.userId);
        await server.save();
        
        // Remove server from user's servers
        await User.findByIdAndUpdate(req.params.userId, {
            $pull: { servers: server._id }
        });
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Ban member (for now, same as kick - you can add a banned users list later)
router.post('/api/serverId/:serverId/ban/:userId', isAuthenticated, isServerOwner, async (req, res) => {
    try {
        const server = req.server;
        
        // Remove member from server
        server.members = server.members.filter(m => m.user.toString() !== req.params.userId);
        await server.save();
        
        // Remove server from user's servers
        await User.findByIdAndUpdate(req.params.userId, {
            $pull: { servers: server._id }
        });
        
        // TODO: Add to banned list to prevent rejoining
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Leave server
router.post('/api/serverId/:serverId/leave', isAuthenticated, async (req, res) => {
    try {
        const server = await Server.findById(req.params.serverId);
        
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        // Can't leave if you're the owner
        if (server.owner.toString() === req.session.user.id) {
            return res.status(400).json({ success: false, message: 'Owner cannot leave server' });
        }
        
        // Remove member from server
        server.members = server.members.filter(m => m.user.toString() !== req.session.user.id);
        await server.save();
        
        // Remove server from user's servers
        await User.findByIdAndUpdate(req.session.user.id, {
            $pull: { servers: server._id }
        });
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// Edit message
router.put('/api/messages/:messageId', isAuthenticated, async (req, res) => {
    try {
        const { content } = req.body;
        const message = await ServerMessage.findById(req.params.messageId);
        
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }
        
        // Check if user is the sender
        if (message.sender.toString() !== req.session.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        
        message.content = content;
        message.isEdited = true;
        message.editedAt = new Date();
        
        await message.save();
        await message.populate('sender', 'name pfp');
        
        res.json({ success: true, message });
    } catch (err) {
        console.error('Error editing message:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete message
router.delete('/api/messages/:messageId', isAuthenticated, async (req, res) => {
    try {
        const message = await ServerMessage.findById(req.params.messageId);
        
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }
        
        // Check if user is the sender
        if (message.sender.toString() !== req.session.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        
        message.isDeleted = true;
        await message.save();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting message:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});
// Get channel messages
router.get('/api/channels/:channelId/messages', isAuthenticated, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const before = req.query.before;
        
        const query = { 
            channel: req.params.channelId,
            isDeleted: false
        };
        
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }
        
        const messages = await ServerMessage.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('sender', 'name id pfp')
            .populate({
        path: 'replyTo',
        select: 'content sender',
        populate: { path: 'sender', select: 'name' }})
        
        res.json({ success: true, messages: messages.reverse() });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Send message
router.post('/api/channels/:channelId/messages', isAuthenticated, upload.array('attachments', 5), async (req, res) => {
    try {
        const { content } = req.body;
        const channelId = req.params.channelId;
        if (!content && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ success: false, message: 'Message must have content or attachments' });
        }
                const attachments = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const uploadStream = gridfsBucket.openUploadStream(file.originalname, {
                    metadata: {
                        uploadedBy: req.session.user.id,
                        contentType: file.mimetype,
                        uploadDate: new Date()
                    }
                });
                
                uploadStream.end(file.buffer);
                
                await new Promise((resolve, reject) => {
                    uploadStream.on('finish', () => {
                        attachments.push({
                            fileId: uploadStream.id,
                            filename: file.originalname,
                            fileType: file.mimetype
                        });
                        resolve();
                    });
                    uploadStream.on('error', reject);
                });
            }
        }
        
        const message = new ServerMessage({
            channel: channelId,
            sender: req.session.user.id,
            content: content || '',
            attachments: attachments
        });
        
        await message.save();
        await message.populate('sender', 'name pfp');
        
        res.json({ success: true, message });
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create server
router.post('/api/serverId/create', async (req, res) => {
    try {
          console.log('Request body:', req.body); 
          console.log('Icon ID:', req.body.iconId);
        const { name, iconId, descriptionT } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Server name required' });
        }
        
        const server = new Server({
            name: name.trim(),
            owner: req.session.user.id,
            members: [{ user: req.session.user.id, roles: [] }],
            icon: iconId,
            description: descriptionT
        });
         console.log('Server before save:', server);
        await server.save();
        console.log('Server after save:', server); 
        console.log('Server icon after save:', server.icon);
        // Add server to user's servers
        await User.findByIdAndUpdate(req.session.user.id, {
            $addToSet: { servers: server._id }
        });
        
        // Create default channels
        const generalChannel = new Channel({
            name: 'general',
            type: 'text',
            server: server._id
        });
        
        const voiceChannel = new Channel({
            name: 'General Voice',
            type: 'voice',
            server: server._id
        });
        
        await generalChannel.save();
        await voiceChannel.save();
        
        res.json({ success: true, server });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;