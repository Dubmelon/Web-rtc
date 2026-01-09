const router = require('express').Router()
const mongoose = require('mongoose')
const multer = require('multer')
const { isAuthenticated } = require('../middleware/auth')

// Multer config
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
})

let gridfsBucket

router.setGridFSBucket = (bucket) => {
    gridfsBucket = bucket
}

// GET /images/:fileId
router.get('/images/:fileId', async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.fileId)) {
        return res.status(404).end()
    }
    const fileId = new mongoose.Types.ObjectId(req.params.fileId)
    gridfsBucket.openDownloadStream(fileId).pipe(res)
})

// GET /files (all user files)
router.get('/files', isAuthenticated, async (req, res) => {
    try {
        const files = await gridfsBucket.find({
            'metadata.uploadedBy': req.session.user.id
        }).toArray()
        res.json({ files })
    } catch (error) {
        console.error('Error fetching files:', error)
        res.status(500).json({ error: 'Error fetching files' })
    }
})

// GET /files/:id (single file)
router.get('/files/:id', isAuthenticated, async (req, res) => {
    try {
        const fileId = new mongoose.Types.ObjectId(req.params.id)
        const files = await gridfsBucket.find({ _id: fileId }).toArray()

        if (!files.length) {
            return res.status(404).json({ error: 'File not found' })
        }

        const file = files[0]
        res.set('Content-Type', file.metadata.contentType)
        res.set('Content-Disposition', `inline; filename="${file.filename}"`)
        gridfsBucket.openDownloadStream(fileId).pipe(res)
    } catch (error) {
        console.error('Download error:', error)
        res.status(500).json({ error: 'Error downloading file' })
    }
})

// POST /upload
router.post('/upload', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' })
        }

        const uploadStream = gridfsBucket.openUploadStream(req.file.originalname, {
            metadata: {
                uploadedBy: req.session.user.id,
                contentType: req.file.mimetype,
                uploadDate: new Date()
            }
        })

        uploadStream.end(req.file.buffer)

        uploadStream.on('finish', () => {
            res.json({ 
                success: true, 
                fileId: uploadStream.id, 
                filename: req.file.originalname 
            })
        })

        uploadStream.on('error', (error) => {
            console.error('Upload error:', error)
            res.status(500).json({ error: 'Error uploading file' })
        })
    } catch (error) {
        console.error('Upload error:', error)
        res.status(500).json({ error: 'Error uploading file' })
    }
})

// DELETE /files/:id
router.delete('/files/:id', isAuthenticated, async (req, res) => {
    try {
        await gridfsBucket.delete(new mongoose.Types.ObjectId(req.params.id))
        res.json({ success: true })
    } catch (error) {
        console.error('Delete error:', error)
        res.status(500).json({ error: 'Error deleting file' })
    }
})

module.exports = router