const router = require('express').Router()
const mongoose = require('mongoose')
const multer = require('multer')
const { isAuthenticated } = require('../middleware/auth')
const userSchema = require('../src/config.js')

// Multer config
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
})

let gridfsBucket

router.setGridFSBucket = (bucket) => {
    gridfsBucket = bucket
}

// Helper function to handle profile logic
async function handleProfile(req, res, profileUserId) {
    try {
        const user = await userSchema.findById(profileUserId)

        if (!user) return res.status(404).send('User not found')

        res.render('profile', {
            user,
            hasPfp: !!(user.pfp?.fileId),
            isOwner: profileUserId === req.session.user.id
        })
    } catch (error) {
        console.error('Error loading profile:', error)
        res.status(500).send('Error loading profile')
    }
}

// GET /profile (own profile)
router.get('/profile', isAuthenticated, async (req, res) => {
    await handleProfile(req, res, req.session.user.id)
})

// GET /profile/:userId (other user's profile)
router.get('/profile/:userId', isAuthenticated, async (req, res) => {
    await handleProfile(req, res, req.params.userId)
})

// POST /profile (update profile)
router.post('/profile', isAuthenticated, async (req, res) => {
    try {
        const { bio, location, job, site } = req.body

        await userSchema.findByIdAndUpdate(req.session.user.id, {
            bio: bio || '',
            location: location || '',
            job: job || '',
            site: site || ''
        })

        res.json({ success: true, message: 'Profile updated successfully' })
    } catch (error) {
        console.error('Error updating profile:', error)
        res.status(500).json({ error: 'Error updating profile' })
    }
})

// POST /upload-pfp
router.post('/upload-pfp', isAuthenticated, upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' })
        }

        if (!req.file.mimetype.startsWith('image/')) {
            return res.status(400).json({ error: 'File must be an image' })
        }

        const user = await userSchema.findById(req.session.user.id)

        // Delete old pfp if exists
        if (user.pfp?.fileId) {
            try {
                await gridfsBucket.delete(new mongoose.Types.ObjectId(user.pfp.fileId))
            } catch (err) {
                console.log('Error deleting old pfp:', err)
            }
        }

        const uploadStream = gridfsBucket.openUploadStream(req.file.originalname, {
            metadata: {
                uploadedBy: req.session.user.id,
                contentType: req.file.mimetype,
                isProfilePicture: true
            }
        })

        uploadStream.end(req.file.buffer)

        uploadStream.on('finish', async () => {
            await userSchema.findByIdAndUpdate(req.session.user.id, {
                pfp: { fileId: uploadStream.id, filename: req.file.originalname }
            })
            res.json({ success: true, fileId: uploadStream.id })
        })

        uploadStream.on('error', (error) => {
            console.error('Upload error:', error)
            res.status(500).json({ error: 'Error uploading profile picture' })
        })
    } catch (error) {
        console.error('Upload error:', error)
        res.status(500).json({ error: 'Error uploading profile picture' })
    }
})

// GET /pfp/:userId
router.get('/pfp/:userId', isAuthenticated,async (req, res) => {
    try {
        const user = await userSchema.findById(req.params.userId)

        if (!user?.pfp?.fileId) {
            return res.status(404).json({ error: 'No profile picture found' })
        }

        const fileId = new mongoose.Types.ObjectId(user.pfp.fileId)
        const files = await gridfsBucket.find({ _id: fileId }).toArray()

        if (!files.length) {
            return res.status(404).json({ error: 'Profile picture file not found' })
        }

        res.set('Content-Type', files[0].metadata.contentType)
        res.set('Cache-Control', 'public, max-age=86400')
        gridfsBucket.openDownloadStream(fileId).pipe(res)
    } catch (error) {
        console.error('Error fetching profile picture:', error)
        res.status(500).json({ error: 'Error fetching profile picture' })
    }
})

module.exports = router