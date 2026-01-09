function isAuthenticated(req, res, next) {
    if (req.session?.user) return next()
    res.redirect('/login')
}

function isAuthenticatedAPI(req, res, next) {
    if (req.session?.user) return next()
    res.status(401).json({ error: 'Not authenticated' })
}

module.exports = { isAuthenticated, isAuthenticatedAPI }