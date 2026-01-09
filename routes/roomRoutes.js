const router = require('express').Router()
const { v4: uuidV4 } = require('uuid')
const { isAuthenticated } = require('../middleware/auth')

// GET /room (create new room)
router.get('/room', isAuthenticated, (req, res) => {
    res.redirect(`/room/${uuidV4()}`)
})

// GET /room/:room (join room)
router.get('/room/:room', isAuthenticated, (req, res) => {
    res.render('room', { roomId: req.params.room })
})

module.exports = router