const router = require('express').Router()
const bcrypt = require('bcrypt')
const userSchema = require('../src/config.js')

// GET /auth/login
router.get('/login', (req, res) => {
    res.render('login')
})

// GET /auth/signup
router.get('/signup', (req, res) => {
    res.render('signup')
})

// GET /auth/logout
router.get('/logout', (req, res) => {
    req.session.destroy()
    res.redirect('/login')
})

// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body

        if (!username || !password) {
            return res.send('Please provide username and password')
        }

        const user = await userSchema.findOne({ name: username })

        if (!user) return res.send('User not found')

        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            req.session.user = { id: user._id, name: user.name }
            res.redirect('/home')
        } else {
            res.send('Wrong password')
        }
    } catch (error) {
        console.error('Login error:', error)
        res.send('Error during login')
    }
})

// POST /auth/signup
router.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body

        if (!username || !password) {
            return res.send('Please provide username and password')
        }

        if (password.length < 6) {
            return res.send('Password must be at least 6 characters')
        }

        const existingUser = await userSchema.findOne({ name: username })

        if (existingUser) return res.send('User already exists!')

        const hashedPassword = await bcrypt.hash(password, 10)

        await userSchema.create({
            name: username,
            password: hashedPassword
        })

        res.redirect('/login')
    } catch (error) {
        console.error('Signup error:', error)
        res.send('Error during signup')
    }
})

module.exports = router