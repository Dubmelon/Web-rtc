const socket = io('/')
const videoGrid = document.getElementById('video-grid')

// Initialize PeerJS with public server
const myPeer = new Peer(undefined, {
    host: '0.peerjs.com',
    secure: true,
    port: 443,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
        ]
    }
})

const myVideo = document.createElement('video')
myVideo.muted = true

const peers = {}
window.myStream = null

// PeerJS Event Handlers
myPeer.on('open', id => {
    console.log('✅ PeerJS connected. My peer ID:', id)
    socket.emit('join-room',ROOM_ID,id)
})

myPeer.on('error', err => {
    console.error('❌ PeerJS error:', err.type, err)
    
    // Display user-friendly error messages
    switch(err.type) {
        case 'peer-unavailable':
            console.warn('⚠️ Peer is unavailable, they may have disconnected')
            break
        case 'network':
            alert('Network error: Please check your internet connection')
            break
        case 'server-error':
            alert('PeerJS server error: Please try again later')
            break
        case 'browser-incompatible':
            alert('Your browser is not compatible with WebRTC')
            break
        default:
            console.error('Unknown PeerJS error:', err)
    }
})

myPeer.on('disconnected', () => {
    console.warn('⚠️ PeerJS disconnected. Attempting to reconnect...')
    
    // Attempt to reconnect
    setTimeout(() => {
        if (!myPeer.destroyed) {
            myPeer.reconnect()
        }
    }, 3000)
})

myPeer.on('close', () => {
    console.log('🔴 PeerJS connection closed')
})

// Socket.IO Event Handlers
socket.on('connect', () => {
    console.log('✅ Socket.IO connected')
})

socket.on('connect_error', (error) => {
    console.error('❌ Socket.IO connection error:', error)
    alert('Failed to connect to server. Please refresh the page.')
})

socket.on('disconnect', (reason) => {
    console.warn('⚠️ Socket.IO disconnected:', reason)
    
    if (reason === 'io server disconnect') {
        // Server disconnected, need to reconnect manually
        socket.connect()
    }
})

socket.on('reconnect', (attemptNumber) => {
    console.log('✅ Socket.IO reconnected after', attemptNumber, 'attempts')
})

// Get user media with error handling
navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    console.log('✅ Got user media stream')
    window.myStream = stream
    addVideoStream(myVideo, stream)

    // Handle incoming calls
    myPeer.on('call', call => {
        console.log('📞 Receiving call from:', call.peer)
        
        call.answer(stream)
        const video = document.createElement('video')

        call.on('stream', userVideoStream => {
            console.log('✅ Received stream from:', call.peer)
            addVideoStream(video, userVideoStream)
        })

        call.on('close', () => {
            console.log('📴 Call closed with:', call.peer)
            video.remove()
        })

        call.on('error', err => {
            console.error('❌ Call error with', call.peer, ':', err)
            video.remove()
        })
        call.on('enabled', ()=>{
            video.hidden = false
        })
    })

    // Handle new user connections
    socket.on('user-connected', userId => {
        console.log('👤 User connected:', userId)
        
        // Add small delay to ensure peer is ready
        setTimeout(() => {
            connectToNewUser(userId, stream)
        }, 1000)
    })
}).catch(err => {
    console.error('❌ Error accessing media devices:', err)
    
    // User-friendly error messages
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

// Handle user disconnections
socket.on('user-disconnected', userId => {
    console.log('👤 User disconnected:', userId)
    
    const video = document.querySelector(`video[data-user-id="${userId}"]`)
    if (video) {
        video.remove()
        console.log('🗑️ Removed video element for:', userId)
    }

    if (peers[userId]) {
        peers[userId].close()
        delete peers[userId]
        console.log('🔌 Closed peer connection for:', userId)
    }
})

function connectToNewUser(userId, stream) {
    console.log('📞 Calling user:', userId)
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
                console.log("Cam Enabled")
        })

        call.on('close', () => {
            console.log('📴 Call closed with:', userId)
            video.remove()
        })

        call.on('error', err => {
            console.error('❌ Call error with', userId, ':', err)
            video.remove()
        })

        peers[userId] = call
    } catch (err) {
        console.error('❌ Error connecting to user', userId, ':', err)
    }
}

function addVideoStream(video, stream) {
    video.srcObject = stream
    
    video.addEventListener('loadedmetadata', () => {
        video.play().catch(err => {
            console.error('❌ Error playing video:', err)
        })
    })
    
    video.addEventListener('error', (e) => {
        console.error('❌ Video element error:', e)
    })

    videoGrid.append(video)
    console.log('📹 Added video stream to grid')
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (myStream) {
        myStream.getTracks().forEach(track => track.stop())
    }
    if (myPeer) {
        myPeer.destroy()
    }
    socket.disconnect()
})
       // Display room ID
        if (typeof ROOM_ID !== 'undefined') {
            document.getElementById('room-id-display').textContent = ROOM_ID;
        }

        // Participant counter
        const updateParticipantCount =() => {
            const videos = document.querySelectorAll('#video-grid video');
            const count = videos.length;
            document.getElementById('participant-count').textContent = count;
            
            // Toggle empty state
            const emptyState = document.getElementById('empty-state');
            if (count === 0) {
                emptyState.style.display = 'block';
            } else {
                emptyState.style.display = 'none';
            }
        };

        // Observe video grid changes
        const observer = new MutationObserver(updateParticipantCount);
        observer.observe(document.getElementById('video-grid'), {
            childList: true,
            subtree: true
        });

        // Initial count
        updateParticipantCount();

        // Control state
        let isVideoEnabled = true;
        let isAudioEnabled = true;

        function getMyVideo() {
            const videos = document.querySelectorAll('#video-grid video');
            for (let video of videos) {
                if (video.muted) {
                    return video;
                }
            }
            return null;
        }

        // Toggle video
        document.getElementById('toggle-video').addEventListener('click', () => {
            console.log('Toggle video clicked');
            
            if (window.myStream) {
                const videoTrack = window.myStream.getVideoTracks()[0];
                const myVideoElement = getMyVideo();
                
                if (videoTrack) {
                    isVideoEnabled = !isVideoEnabled;
                    videoTrack.enabled = isVideoEnabled;
                    
                    const btn = document.getElementById('toggle-video');
                    const icon = document.getElementById('video-icon');
                    
                    // Toggle visual display
                    if (myVideoElement) {
                        if (isVideoEnabled) {
                            myVideoElement.classList.remove('video-off');
                            myVideoElement.style.visibility = 'visible';
                        } else {
                            myVideoElement.classList.add('video-off');
                        }
                    }
                    
                    if (isVideoEnabled) {
                        btn.classList.remove('off');
                        icon.textContent = '📹';
                        console.log('✅ Video enabled');
                    } else {
                        btn.classList.add('off');
                        icon.textContent = '🚫';
                        console.log('❌ Video disabled');
                    }
                } else {
                    console.error('No video track found');
                }
            } else {
                console.error('No stream found - waiting for media to load');
            }
        });

        // Toggle audio
        document.getElementById('toggle-audio').addEventListener('click', () => {
            if (window.myStream) {
                const audioTrack = window.myStream.getAudioTracks()[0];
                
                if (audioTrack) {
                    isAudioEnabled = !isAudioEnabled;
                    audioTrack.enabled = isAudioEnabled;
                    
                    const btn = document.getElementById('toggle-audio');
                    const icon = document.getElementById('audio-icon');
                    
                    if (isAudioEnabled) {
                        btn.classList.remove('off');
                        icon.textContent = '🎤';
                        console.log('✅ Audio enabled');
                    } else {
                        btn.classList.add('off');
                        icon.textContent = '🔇';
                        console.log('❌ Audio disabled');
                    }
                } else {
                    console.error('No audio track found');
                }
            } else {
                console.error('No stream found - waiting for media to load');
            }
        });

        // Leave call
        document.getElementById('leave-call').addEventListener('click', () => {
            if (confirm('Are you sure you want to leave the call?')) {
                // Stop all tracks
                if (window.myStream) {
                    window.myStream.getTracks().forEach(track => track.stop());
                }
                window.location.href = '/home';
            }
        });