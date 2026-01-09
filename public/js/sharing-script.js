
const videoGrid = document.getElementById('video-grid')
const myVideo = document.createElement('video')
myVideo.muted = true // Mute own video to prevent feedback

let myPeerId = null
let isScreenSharing = false
const peers = {}

// ========================================
// QUALITY CONSTRAINTS
// ========================================
const HIGH_QUALITY_CONSTRAINTS = {
    video: {
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
        facingMode: 'user'
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2,
    }
}

const MEDIUM_QUALITY_CONSTRAINTS = {
    video: {
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 },
        frameRate: { ideal: 30, max: 30 },
        facingMode: 'user'
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    }
}

// ========================================
// SOCKET.IO CONNECTION
// ========================================
const socket = io('/')

// ========================================
// PEERJS SETUP
// ========================================
const myPeer = new Peer(undefined, {
    host: '0.peerjs.com',
    secure: true,
    port: 443,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ],
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 10,
        sdpSemantics: 'unified-plan'
    }
})
const ROOM_ID = 'sharing'
// ========================================
// PEER EVENT HANDLERS
// ========================================
myPeer.on('open', id => {
    myPeerId = id
    console.log('✅ My peer ID:', id)
    socket.emit('join-room',ROOM_ID,id)
})

myPeer.on('error', err => {
    console.error('❌ PeerJS error:', err)
    if (err.type === 'peer-unavailable') {
        console.log('⚠️ Peer unavailable, they may have disconnected')
    }
})

// ========================================
// HELPER FUNCTIONS
// ========================================
function addVideoStream(video, stream) {
    video.srcObject = stream
    
    // Check if video already exists and remove old container
    if (video.dataset.userId) {
        const existingContainer = document.querySelector(`.video-container[data-user-id="${video.dataset.userId}"]`)
        if (existingContainer) {
            existingContainer.remove()
        }
    }
    
    // Create container wrapper
    const videoContainer = document.createElement('div')
    videoContainer.className = 'video-container'
    if (video.dataset.userId) {
        videoContainer.dataset.userId = video.dataset.userId
    }
    
    // Create controls overlay
    const controls = document.createElement('div')
    controls.className = 'video-controls'
    
    // Volume label
    const volumeLabel = document.createElement('span')
    volumeLabel.className = 'volume-label'
    volumeLabel.textContent = '🔊 100%'
    
    // Volume slider
    const volumeSlider = document.createElement('input')
    volumeSlider.type = 'range'
    volumeSlider.min = '0'
    volumeSlider.max = '100'
    volumeSlider.value = '100'
    volumeSlider.className = 'volume-slider'
    volumeSlider.title = 'Adjust volume'
    
    volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value
        video.volume = volume / 100
        volumeLabel.textContent = `🔊 ${volume}%`
    })
    
    // Mute/unmute button
    const muteBtn = document.createElement('button')
    muteBtn.className = 'control-btn'
    muteBtn.innerHTML = '🔊'
    muteBtn.title = 'Mute this user'
    
    let isMutedLocal = false
    muteBtn.addEventListener('click', () => {
        isMutedLocal = !isMutedLocal
        video.muted = isMutedLocal
        muteBtn.innerHTML = isMutedLocal ? '🔇' : '🔊'
        muteBtn.classList.toggle('muted', isMutedLocal)
    })
    
    // Hide video button
    const hideVideoBtn = document.createElement('button')
    hideVideoBtn.className = 'control-btn'
    hideVideoBtn.innerHTML = '👁️'
    hideVideoBtn.title = 'Hide video'
    
    let isHidden = false
    hideVideoBtn.addEventListener('click', () => {
        isHidden = !isHidden
        video.style.opacity = isHidden ? '0' : '1'
        hideVideoBtn.innerHTML = isHidden ? '🙈' : '👁️'
    })
    
    // Assemble controls
    controls.appendChild(volumeLabel)
    controls.appendChild(volumeSlider)
    controls.appendChild(muteBtn)
    controls.appendChild(hideVideoBtn)
    
    // Video element events
    video.addEventListener('loadedmetadata', () => {
        video.play().catch(err => {
            console.error('❌ Error playing video:', err)
        })
    })
    
    video.addEventListener('error', (e) => {
        console.error('❌ Video element error:', e)
    })
    
    // Assemble container
    videoContainer.appendChild(video)
    videoContainer.appendChild(controls)
    videoGrid.appendChild(videoContainer)
    
    console.log('📹 Added video stream to grid with controls')
}

function connectToNewUser(userId, stream) {
    console.log('📞 Calling user:', userId, 'with optimized settings')
    try {
        const call = myPeer.call(userId, stream)
        
        if (!call) {
            console.error('❌ Failed to create call to:', userId)
            return
        }
        
        const video = document.createElement('video')
        video.dataset.userId = userId

        call.on('stream', userVideoStream => {
            console.log('✅ Received stream from:', userId)
            addVideoStream(video, userVideoStream)
            
            // Monitor connection quality
            monitorConnectionQuality(call.peerConnection, userId)
        })

        call.on('close', () => {
            console.log('📴 Call closed with:', userId)
            const videoContainer = document.querySelector(`.video-container[data-user-id="${userId}"]`)
            if (videoContainer) {
                videoContainer.remove()
            } else {
                video.remove()
            }
        })

        call.on('error', err => {
            console.error('❌ Call error with', userId, ':', err)
            const videoContainer = document.querySelector(`.video-container[data-user-id="${userId}"]`)
            if (videoContainer) {
                videoContainer.remove()
            } else {
                video.remove()
            }
        })

        peers[userId] = call
        
        // Optimize bandwidth after connection is established
        setTimeout(() => {
            optimizeBandwidth(call.peerConnection, userId)
        }, 2000)
        
    } catch (err) {
        console.error('❌ Error connecting to user', userId, ':', err)
    }
}

function monitorConnectionQuality(peerConnection, userId) {
    if (!peerConnection) return
    
    const interval = setInterval(async () => {
        try {
            const stats = await peerConnection.getStats()
            stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                    const bytesReceived = report.bytesReceived
                    const packetsLost = report.packetsLost
                    const jitter = report.jitter
                    
                    console.log(`📊 ${userId} - Bytes: ${bytesReceived}, Lost: ${packetsLost}, Jitter: ${jitter}`)
                    
                    if (packetsLost > 100) {
                        console.warn(`⚠️ Poor connection quality with ${userId}`)
                    }
                }
            })
        } catch (err) {
            console.error('Error getting stats:', err)
            clearInterval(interval)
        }
    }, 5000)
    
    if (!window.qualityMonitors) window.qualityMonitors = {}
    window.qualityMonitors[userId] = interval
}

function optimizeBandwidth(peerConnection, userId) {
    if (!peerConnection) return
    
    const senders = peerConnection.getSenders()
    senders.forEach(sender => {
        if (sender.track && sender.track.kind === 'video') {
            const parameters = sender.getParameters()
            
            if (!parameters.encodings) {
                parameters.encodings = [{}]
            }
            
            parameters.encodings[0].maxBitrate = 40000000
            parameters.encodings[0].maxFramerate = 30
            
            sender.setParameters(parameters)
                .then(() => {
                    console.log(`✅ Optimized bandwidth for ${userId}`)
                })
                .catch(err => {
                    console.error('❌ Error setting bandwidth:', err)
                })
        }
        
        if (sender.track && sender.track.kind === 'audio') {
            const parameters = sender.getParameters()
            
            if (!parameters.encodings) {
                parameters.encodings = [{}]
            }
            
            parameters.encodings[0].maxBitrate = 256000
            
            sender.setParameters(parameters)
                .then(() => {
                    console.log(`✅ Optimized audio bandwidth for ${userId}`)
                })
                .catch(err => {
                    console.error('❌ Error setting audio bandwidth:', err)
                })
        }
    })
}

function stopScreenShare() {
    if (!window.screenStream) return
    
    // Stop all tracks
    window.screenStream.getTracks().forEach(track => track.stop())
    
    // Switch back to camera
    myVideo.srcObject = window.myStream
    
    // Replace video track with camera for all peers
    if (window.myStream) {
        const videoTrack = window.myStream.getVideoTracks()[0]
        for (let userId in peers) {
            const sender = peers[userId].peerConnection
                .getSenders()
                .find(s => s.track && s.track.kind === 'video')
            
            if (sender && videoTrack) {
                sender.replaceTrack(videoTrack)
                    .then(() => {
                        console.log('✅ Switched back to camera for user:', userId)
                    })
                    .catch(err => {
                        console.error('❌ Error switching back to camera:', err)
                    })
            }
        }
    }
    
    isScreenSharing = false
    window.screenStream = null
    socket.emit('stream-updated', myPeerId)
    console.log('📹 Stopped screen sharing, switched to camera')
}

async function toggleScreenShare() {
    if (!isScreenSharing) {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor',
                    width: { ideal: 1920, max: 3840 },
                    height: { ideal: 1080, max: 2160 },
                    frameRate: { ideal: 30, max: 60 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            })
            
            console.log('✅ Got HIGH QUALITY screen share stream')
            window.screenStream = screenStream
            
            // Add audio from original stream
            if (window.myStream) {
                const audioTrack = window.myStream.getAudioTracks()[0]
                if (audioTrack) {
                    screenStream.addTrack(audioTrack)

                }
            }
            
            myVideo.srcObject = screenStream
            
            const videoTrack = screenStream.getVideoTracks()[0]
            for (let userId in peers) {
                const sender = peers[userId].peerConnection
                    .getSenders()
                    .find(s => s.track && s.track.kind === 'video')
                
                if (sender) {
                    await sender.replaceTrack(videoTrack)
                    
                    const parameters = sender.getParameters()
                    if (!parameters.encodings) {
                        parameters.encodings = [{}]
                    }
                    parameters.encodings[0].maxBitrate = 40000000
                    
                    await sender.setParameters(parameters)
                    console.log('✅ Replaced track with HIGH QUALITY for user:', userId)
                }
            }
            
            isScreenSharing = true
            socket.emit('stream-updated', myPeerId)
            console.log('🖥️ HIGH QUALITY screen sharing started')
            
            screenStream.getVideoTracks()[0].onended = () => {
                stopScreenShare()
            }
            
        } catch (err) {
            console.error('❌ Error starting screen share:', err)
            if (err.name === 'NotAllowedError') {
                alert('Screen sharing permission denied')
            } else {
                alert('Error starting screen share: ' + err.message)
            }
        }
    } else {
        stopScreenShare()
    }
}

function setupCallHandlers(stream) {
    // Handle incoming calls
    myPeer.on('call', call => {
        console.log('📞 Receiving call from:', call.peer)
        
        const currentStream = isScreenSharing ? window.screenStream : stream
        call.answer(currentStream)
        
        const video = document.createElement('video')
        video.dataset.userId = call.peer

        call.on('stream', userVideoStream => {
            console.log('✅ Received stream from:', call.peer)
            addVideoStream(video, userVideoStream)
            monitorConnectionQuality(call.peerConnection, call.peer)
        })

        call.on('close', () => {
            console.log('📴 Call closed with:', call.peer)
            const videoContainer = document.querySelector(`.video-container[data-user-id="${call.peer}"]`)
            if (videoContainer) {
                videoContainer.remove()
            } else {
                video.remove()
            }
        })

        call.on('error', err => {
            console.error('❌ Call error with', call.peer, ':', err)
            const videoContainer = document.querySelector(`.video-container[data-user-id="${call.peer}"]`)
            if (videoContainer) {
                videoContainer.remove()
            } else {
                video.remove()
            }
        })

        peers[call.peer] = call
    })

    // Handle new user connections
    socket.on('user-connected', userId => {
        console.log('👤 User connected:', userId)
        setTimeout(() => {
            connectToNewUser(userId, isScreenSharing ? window.screenStream : stream)
        }, 1000)
    })
}

// ========================================
// INITIALIZE MEDIA
// ========================================
navigator.mediaDevices.getUserMedia(HIGH_QUALITY_CONSTRAINTS)
    .then(stream => {
        console.log('✅ Got HIGH QUALITY user media stream')
        window.myStream = stream
        addVideoStream(myVideo, stream)
        setupCallHandlers(stream)
    })
    .catch(err => {
        console.error('❌ High quality failed, trying medium quality:', err)
        
        navigator.mediaDevices.getUserMedia(MEDIUM_QUALITY_CONSTRAINTS)
            .then(stream => {
                console.log('✅ Got MEDIUM QUALITY user media stream')
                window.myStream = stream
                addVideoStream(myVideo, stream)
                setupCallHandlers(stream)
            })
            .catch(err => {
                console.error('❌ Error accessing media devices:', err)
                
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    alert('Camera/microphone access denied. Please allow access and refresh the page.')
                } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                    alert('No camera or microphone found. Please connect a device and refresh.')
                } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                    alert('Camera/microphone is already in use by another application.')
                } else {
                    alert('Error accessing camera/microphone: ' + err.message)
                }
            })
    })

// ========================================
// SOCKET EVENT HANDLERS
// ========================================
socket.on('user-disconnected', userId => {
    console.log('👤 User disconnected:', userId)
    
    if (window.qualityMonitors && window.qualityMonitors[userId]) {
        clearInterval(window.qualityMonitors[userId])
        delete window.qualityMonitors[userId]
    }
    
    const videoContainer = document.querySelector(`.video-container[data-user-id="${userId}"]`)
    if (videoContainer) {
        videoContainer.remove()
    }
    
    const video = document.querySelector(`video[data-user-id="${userId}"]`)
    if (video) {
        video.remove()
    }

    if (peers[userId]) {
        peers[userId].close()
        delete peers[userId]
    }
})

// ========================================
// EXPOSE FUNCTIONS GLOBALLY
// ========================================
window.toggleScreenShare = toggleScreenShare