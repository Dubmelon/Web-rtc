const router = require('express').Router()
const { isAuthenticated } = require('../middleware/auth')
const userSchema = require('../src/config.js')

// GET /
router.get('/', (req, res) => {
    res.redirect('/login')
})

// GET /home
router.get('/home', isAuthenticated, async (req, res) => {
    try {
        const user = await userSchema.findById(req.session.user.id)
        res.render('home', {
            user,
            userId: user.id,
            hasPfp: !!(user.pfp?.fileId)
        })
    } catch (error) {
        console.error('Error loading home:', error)
        res.status(500).send('Error loading home')
    }
})

// GET /sharing
router.get('/sharing', isAuthenticated, (req, res) => {
    res.render('sharing')
})

// GET /servers
router.get('/servers', isAuthenticated, (req, res) => {
    res.render('servers')
})

module.exports = router