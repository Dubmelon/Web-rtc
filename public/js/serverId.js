const userId = document.body.dataset.userId || window.currentUserId;
const serverId = window.location.pathname.split('/')[2];
let server = null;
let channels = [];
let members = [];
let roles = [];
let activeChannel = null;
let selectedMemberId = null;
let messagePollingInterval = null;
let selectedMessageId = null;
let editingMessageId = null;
let replyingToMessage = null;

// ========================================
// VOICE CHAT VARIABLES
// ========================================
let socket = null;
let myPeer = null;
let myPeerId = null;
let isScreenSharing = false;
let isVoiceConnected = false;
let isMicMuted = false;
let isCameraStopped = false;
const peers = {};
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;

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
};

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
};

// ========================================
// INITIALIZATION
// ========================================
async function init() {
    await loadServer();
    await loadChannels();
    await loadMembers();
    await loadRoles();
    
    if (channels.length > 0) {
        const textChannel = channels.find(c => c.type === 'text');
        if (textChannel) {
            selectChannel(textChannel);
        }
    }
}

// ========================================
// SERVER & CHANNEL FUNCTIONS
// ========================================
async function loadServer() {
    try {
        const res = await fetch(`/api/serverId/${serverId}`);
        const data = await res.json();
        
        if (data.success) {
            server = data.server;
            document.getElementById('serverNameHeader').textContent = server.name;
            document.getElementById('serverTitle').textContent = server.name;
            
            if (server.owner._id === userId) {
                document.getElementById('editServerBtn').style.display = 'flex';
                document.getElementById('rolesBtn').style.display = 'flex';
                document.getElementById('addTextChannelBtn').style.display = 'block';
                document.getElementById('addVoiceChannelBtn').style.display = 'block';
            }
        }
    } catch (err) {
        console.error('Error loading server:', err);
    }
}

async function loadChannels() {
    try {
        const res = await fetch(`/api/serverId/${serverId}/channels`);
        const data = await res.json();
        
        if (data.success) {
            channels = data.channels;
            renderChannels();
        }
    } catch (err) {
        console.error('Error loading channels:', err);
    }
}

function renderChannels() {
    const textList = document.getElementById('textChannelsList');
    const voiceList = document.getElementById('voiceChannelsList');
    
    textList.innerHTML = '';
    voiceList.innerHTML = '';
    
    channels.forEach(channel => {
        const item = document.createElement('div');
        item.className = 'channel-item';
        if (activeChannel?._id === channel._id) item.classList.add('active');
        
        const icon = channel.type === 'text' ? '#' : '🔊';
        item.innerHTML = `
            <span class="channel-icon">${icon}</span>
            <span class="channel-name">${channel.name}</span>
        `;
        
        item.onclick = () => selectChannel(channel);
        
        if (channel.type === 'text') {
            textList.appendChild(item);
        } else {
            voiceList.appendChild(item);
        }
    });
}

function selectChannel(channel) {
    activeChannel = channel;
    document.getElementById('currentChannelIcon').textContent = channel.type === 'text' ? '#' : '🔊';
    document.getElementById('currentChannelName').textContent = channel.name;
    document.getElementById('messageInput').placeholder = `Message #${channel.name}`;
    
    renderChannels();
    
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
        messagePollingInterval = null;
    }
    
    if (channel.type === 'text') {
        // Disconnect from voice if connected

        if (isVoiceConnected) {
            disconnectVoice();
        }
        
        // Show text chat, hide voice chat
        document.getElementById('textChatContainer').style.display = 'block';
    document.getElementById('textChatContainer').classList.remove('hidden');
    document.getElementById('voiceChatContainer').classList.remove('active');
        
        loadMessages(channel._id);
        
        messagePollingInterval = setInterval(() => {
            loadMessages(channel._id, true);
        }, 2000);
    } else {
        // Hide text chat, show voice chat
    document.getElementById('textChatContainer').classList.add('hidden');
    document.getElementById('voiceChatContainer').classList.add('active');
        
        // Connect to voice channel
        connectToVoiceChannel();
    }
}

// ========================================
// VOICE CHAT FUNCTIONS
// ========================================
function connectToVoiceChannel() {
    if (isVoiceConnected) return;
    
    console.log('🔊 Connecting to voice channel...');
    
    // Initialize Socket.IO if not already
    if (!socket) {
        socket = io('/');
    }
    
    // Initialize PeerJS if not already
    if (!myPeer) {
        myPeer = new Peer(undefined, {
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
                    }
                ],
                iceTransportPolicy: 'all',
                iceCandidatePoolSize: 10,
                sdpSemantics: 'unified-plan'
            }
        });
        
        myPeer.on('open', id => {
            myPeerId = id;
            console.log('✅ My peer ID:', id);
            const ROOM_ID = `${serverId}-${activeChannel._id}`;
            socket.emit('join-room', ROOM_ID, id);
        });
        
        myPeer.on('error', err => {
            console.error('❌ PeerJS error:', err);
        });
    }
    
    // Get user media and start voice chat
    navigator.mediaDevices.getUserMedia(HIGH_QUALITY_CONSTRAINTS)
        .then(stream => {
            console.log('✅ Got HIGH QUALITY user media stream');
            window.myStream = stream;
            addVideoStream(myVideo, stream);
            setupCallHandlers(stream);
            
            isVoiceConnected = true;
            document.getElementById('voiceBottomControls').classList.add('active');
            document.getElementById('textChatContainer').classList.add('voice-active');
        })
        .catch(err => {
            console.error('❌ High quality failed, trying medium quality:', err);
            
            navigator.mediaDevices.getUserMedia(MEDIUM_QUALITY_CONSTRAINTS)
                .then(stream => {
                    console.log('✅ Got MEDIUM QUALITY user media stream');
                    window.myStream = stream;
                    addVideoStream(myVideo, stream);
                    setupCallHandlers(stream);
                    
                    isVoiceConnected = true;
                    document.getElementById('voiceBottomControls').classList.add('active');
                    document.getElementById('textChatContainer').classList.add('voice-active');
                })
                .catch(err => {
                    console.error('❌ Error accessing media devices:', err);
                    alert('Error accessing camera/microphone: ' + err.message);
                });
        });
}

function disconnectVoice() {
    console.log('📴 Disconnecting from voice...');
    
    // Stop all tracks
    if (window.myStream) {
        window.myStream.getTracks().forEach(track => track.stop());
    }
    
    if (window.screenStream) {
        window.screenStream.getTracks().forEach(track => track.stop());
    }
    
    // Close all peer connections
    for (let userId in peers) {
        if (peers[userId]) {
            peers[userId].close();
        }
    }
    
    // Clear peers object
    Object.keys(peers).forEach(key => delete peers[key]);
    
    // Clear video grid
    videoGrid.innerHTML = '';
    
    // Leave room
    if (socket && myPeerId) {
        const ROOM_ID = `${serverId}-${activeChannel._id}`;
        socket.emit('leave-room', ROOM_ID, myPeerId);
    }
    
    isVoiceConnected = false;
    isScreenSharing = false;
    document.getElementById('voiceBottomControls').classList.remove('active');
    document.getElementById('textChatContainer').classList.remove('voice-active');
    
    // Reset button states
    document.getElementById('toggleMicBtn').innerHTML = '🎤 Mute';
    document.getElementById('toggleCameraBtn').innerHTML = '📹 Stop Video';
    document.getElementById('toggleScreenShareBtn').innerHTML = '🖥️ Share Screen';
    isMicMuted = false;
    isCameraStopped = false;
}

function toggleMicrophone() {
    if (!window.myStream) return;
    
    const audioTrack = window.myStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        isMicMuted = !audioTrack.enabled;
        document.getElementById('toggleMicBtn').innerHTML = isMicMuted ? '🎤 Unmute' : '🎤 Mute';
        document.getElementById('toggleMicBtn').classList.toggle('active', isMicMuted);
    }
}

function toggleCamera() {
    if (!window.myStream) return;
    
    const videoTrack = window.myStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        isCameraStopped = !videoTrack.enabled;
        document.getElementById('toggleCameraBtn').innerHTML = isCameraStopped ? '📹 Start Video' : '📹 Stop Video';
        document.getElementById('toggleCameraBtn').classList.toggle('active', isCameraStopped);
    }
}

function addVideoStream(video, stream) {
    video.srcObject = stream;
    
    if (video.dataset.userId) {
        const existingContainer = document.querySelector(`.video-container[data-user-id="${video.dataset.userId}"]`);
        if (existingContainer) {
            existingContainer.remove();
        }
    }
    
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    if (video.dataset.userId) {
        videoContainer.dataset.userId = video.dataset.userId;
    }
    
    const controls = document.createElement('div');
    controls.className = 'video-controls';
    
    const volumeLabel = document.createElement('span');
    volumeLabel.className = 'volume-label';
    volumeLabel.textContent = '🔊 100%';
    
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '100';
    volumeSlider.value = '100';
    volumeSlider.className = 'volume-slider';
    volumeSlider.title = 'Adjust volume';
    
    volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value;
        video.volume = volume / 100;
        volumeLabel.textContent = `🔊 ${volume}%`;
    });
    
    const muteBtn = document.createElement('button');
    muteBtn.className = 'control-btn';
    muteBtn.innerHTML = '🔊';
    muteBtn.title = 'Mute this user';
    
    let isMutedLocal = false;
    muteBtn.addEventListener('click', () => {
        isMutedLocal = !isMutedLocal;
        video.muted = isMutedLocal;
        muteBtn.innerHTML = isMutedLocal ? '🔇' : '🔊';
        muteBtn.classList.toggle('muted', isMutedLocal);
    });
    
    const hideVideoBtn = document.createElement('button');
    hideVideoBtn.className = 'control-btn';
    hideVideoBtn.innerHTML = '👁️';
    hideVideoBtn.title = 'Hide video';
    
    let isHidden = false;
    hideVideoBtn.addEventListener('click', () => {
        isHidden = !isHidden;
        video.style.opacity = isHidden ? '0' : '1';
        hideVideoBtn.innerHTML = isHidden ? '🙈' : '👁️';
    });
    
    controls.appendChild(volumeLabel);
    controls.appendChild(volumeSlider);
    controls.appendChild(muteBtn);
    controls.appendChild(hideVideoBtn);
    
    video.addEventListener('loadedmetadata', () => {
        video.play().catch(err => {
            console.error('❌ Error playing video:', err);
        });
    });
    
    video.addEventListener('error', (e) => {
        console.error('❌ Video element error:', e);
    });
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(controls);
    videoGrid.appendChild(videoContainer);
    
    console.log('📹 Added video stream to grid with controls');
}

function connectToNewUser(userId, stream) {
    console.log('📞 Calling user:', userId);
    try {
        const call = myPeer.call(userId, stream);
        
        if (!call) {
            console.error('❌ Failed to create call to:', userId);
            return;
        }
        
        const video = document.createElement('video');
        video.dataset.userId = userId;

        call.on('stream', userVideoStream => {
            console.log('✅ Received stream from:', userId);
            addVideoStream(video, userVideoStream);
        });

        call.on('close', () => {
            console.log('📴 Call closed with:', userId);
            const videoContainer = document.querySelector(`.video-container[data-user-id="${userId}"]`);
            if (videoContainer) {
                videoContainer.remove();
            } else {
                video.remove();
            }
        });

        call.on('error', err => {
            console.error('❌ Call error with', userId, ':', err);
            const videoContainer = document.querySelector(`.video-container[data-user-id="${userId}"]`);
            if (videoContainer) {
                videoContainer.remove();
            } else {
                video.remove();
            }
        });

        peers[userId] = call;
        
    } catch (err) {
        console.error('❌ Error connecting to user', userId, ':', err);
    }
}

function setupCallHandlers(stream) {
    myPeer.on('call', call => {
        console.log('📞 Receiving call from:', call.peer);
        
        const currentStream = isScreenSharing ? window.screenStream : stream;
        call.answer(currentStream);
        
        const video = document.createElement('video');
        video.dataset.userId = call.peer;

        call.on('stream', userVideoStream => {
            console.log('✅ Received stream from:', call.peer);
            addVideoStream(video, userVideoStream);
        });

        call.on('close', () => {
            console.log('📴 Call closed with:', call.peer);
            const videoContainer = document.querySelector(`.video-container[data-user-id="${call.peer}"]`);
            if (videoContainer) {
                videoContainer.remove();
            } else {
                video.remove();
            }
        });

        call.on('error', err => {
            console.error('❌ Call error with', call.peer, ':', err);
            const videoContainer = document.querySelector(`.video-container[data-user-id="${call.peer}"]`);
            if (videoContainer) {
                videoContainer.remove();
            } else {
                video.remove();
            }
        });

        peers[call.peer] = call;
    });

    socket.on('user-connected', userId => {
        console.log('👤 User connected:', userId);
        setTimeout(() => {
            connectToNewUser(userId, isScreenSharing ? window.screenStream : stream);
        }, 1000);
    });
    
    socket.on('user-disconnected', userId => {
        console.log('👤 User disconnected:', userId);
        
        const videoContainer = document.querySelector(`.video-container[data-user-id="${userId}"]`);
        if (videoContainer) {
            videoContainer.remove();
        }
        
        const video = document.querySelector(`video[data-user-id="${userId}"]`);
        if (video) {
            video.remove();
        }

        if (peers[userId]) {
            peers[userId].close();
            delete peers[userId];
        }
    });
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
            });
            
            console.log('✅ Got screen share stream');
            window.screenStream = screenStream;
            
            if (window.myStream) {
                const audioTrack = window.myStream.getAudioTracks()[0];
                if (audioTrack) {
                    screenStream.addTrack(audioTrack);
                }
            }
            
            myVideo.srcObject = screenStream;
            
            const videoTrack = screenStream.getVideoTracks()[0];
            for (let userId in peers) {
                const sender = peers[userId].peerConnection
                    .getSenders()
                    .find(s => s.track && s.track.kind === 'video');
                
                if (sender) {
                    await sender.replaceTrack(videoTrack);
                    console.log('✅ Replaced track with screen share for user:', userId);
                }
            }
            
            isScreenSharing = true;
            document.getElementById('toggleScreenShareBtn').innerHTML = '🖥️ Stop Sharing';
            document.getElementById('toggleScreenShareBtn').classList.add('active');
            console.log('🖥️ Screen sharing started');
            
            screenStream.getVideoTracks()[0].onended = () => {
                stopScreenShare();
            };
            
        } catch (err) {
            console.error('❌ Error starting screen share:', err);
            alert('Error starting screen share: ' + err.message);
        }
    } else {
        stopScreenShare();
    }
}

function stopScreenShare() {
    if (!window.screenStream) return;
    
    window.screenStream.getTracks().forEach(track => track.stop());
    
    myVideo.srcObject = window.myStream;
    
    if (window.myStream) {
        const videoTrack = window.myStream.getVideoTracks()[0];
        for (let userId in peers) {
            const sender = peers[userId].peerConnection
                .getSenders()
                .find(s => s.track && s.track.kind === 'video');
            
            if (sender && videoTrack) {
                sender.replaceTrack(videoTrack)
                    .then(() => {
                        console.log('✅ Switched back to camera for user:', userId);
                    })
                    .catch(err => {
                        console.error('❌ Error switching back to camera:', err);
                    });
            }
        }
    }
    
    isScreenSharing = false;
    window.screenStream = null;
    document.getElementById('toggleScreenShareBtn').innerHTML = '🖥️ Share Screen';
    document.getElementById('toggleScreenShareBtn').classList.remove('active');
    console.log('📹 Stopped screen sharing');
}

// ========================================
// TEXT CHAT FUNCTIONS
// ========================================
let lastMessageId = null;
async function loadMessages(channelId, isPolling = false) {
    try {
        const res = await fetch(`/api/channels/${channelId}/messages?limit=50`);
        const data = await res.json();
        
        if (data.success) {
            const messagesArea = document.getElementById('messagesArea');
            
            if (data.messages.length === 0) {
                if (!isPolling) {
                    messagesArea.innerHTML = '<div class="empty-state">No messages yet. Start the conversation!</div>';
                }
                return;
            }
            
            const newestMessageId = data.messages[data.messages.length - 1]?._id;
            if (isPolling && newestMessageId === lastMessageId) {
                return;
            }
            
            lastMessageId = newestMessageId;
            
            const shouldScrollToBottom = messagesArea.scrollTop + messagesArea.clientHeight >= messagesArea.scrollHeight - 100;
            
            messagesArea.innerHTML = '';
            data.messages.forEach(msg => {
                const msgEl = createMessageElement(msg);
                messagesArea.appendChild(msgEl);
            });
            
            if (!isPolling || shouldScrollToBottom) {
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }
        }
    } catch (err) {
        console.error('Error loading messages:', err);
    }
}

function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = 'message';
    div.dataset.messageId = message._id;
    div.dataset.senderId = message.sender._id;
    
    const timestamp = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let attachmentsHtml = '';
    if (message.attachments && message.attachments.length > 0) {
        attachmentsHtml = '<div class="message-attachments">';
        message.attachments.forEach(att => {
            if (att.fileType.startsWith('image/')) {
                attachmentsHtml += `
                    <div class="message-attachment">
                        <img src="/images/${att.fileId}" alt="${escapeHtml(att.filename)}" 
                             style="max-width: 400px; max-height: 300px; border-radius: 4px; cursor: pointer;"
                             onclick="window.open('/images/${att.fileId}', '_blank')">
                    </div>
                `;
            } else if (att.fileType.startsWith('video/')) {
                attachmentsHtml += `
                    <div class="message-attachment">
                        <video controls style="max-width: 400px; max-height: 300px; border-radius: 4px;">
                            <source src="/images/${att.fileId}" type="${att.fileType}">
                        </video>
                    </div>
                `;
            } else {
                attachmentsHtml += `
                    <div class="message-attachment">
                        <a href="/images/${att.fileId}" target="_blank" class="file-link">
                            📎 ${escapeHtml(att.filename)}
                        </a>
                    </div>
                `;
            }
        });
        attachmentsHtml += '</div>';
    }
    
    let replyHtml = '';
    if (message.replyTo) {
        replyHtml = `
            <div class="message-reply-ref" onclick="scrollToMessage('${message.replyTo._id}')">
                ↩️ Replying to ${escapeHtml(message.replyTo.sender.name)}: ${escapeHtml(message.replyTo.content.substring(0, 50))}${message.replyTo.content.length > 50 ? '...' : ''}
            </div>
        `;
    }
    
    const editedBadge = message.isEdited ? '<span class="message-edited">(edited)</span>' : '';
    
    div.innerHTML = `
        <img class="message-avatar" src="/images/${message.sender.pfp.fileId}"></img>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${message.sender.name}</span>
                <span class="message-timestamp">${timestamp}</span>
                ${editedBadge}
            </div>
            ${replyHtml}
            ${message.content ? `<div class="message-text">${escapeHtml(message.content)}</div>` : ''}
            ${attachmentsHtml}
        </div>
    `;
    
    const isOwnMessage = String(message.sender._id) === String(userId);
    
    if (isOwnMessage) {
        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showMessageContextMenu(e, message);
        });
        
        div.addEventListener('click', (e) => {
            if (e.shiftKey) {
                startEditMessage(message);
            }
        });
        
        div.style.cursor = 'pointer';
    }
    
    return div;
}

function showMessageContextMenu(event, message) {
    selectedMessageId = message._id;
    
    const menu = document.getElementById('messageContextMenu');
    if (!menu) return;
    
    menu.style.display = 'block';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
}

function triggerFileInput() {
    document.getElementById('messageFileInput').click();
}

function updateFilePreview() {
    const fileInput = document.getElementById('messageFileInput');
    const preview = document.getElementById('filePreview');
    
    if (fileInput.files.length > 0) {
        preview.innerHTML = '';
        preview.style.display = 'flex';
        
        Array.from(fileInput.files).forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-preview-item';
            fileItem.innerHTML = `
                <span>${file.name}</span>
                <button onclick="removeFile(${index})" class="remove-file-btn">×</button>
            `;
            preview.appendChild(fileItem);
        });
    } else {
        preview.style.display = 'none';
    }
}

function removeFile(index) {
    const fileInput = document.getElementById('messageFileInput');
    const dt = new DataTransfer();
    const files = Array.from(fileInput.files);
    
    files.forEach((file, i) => {
        if (i !== index) dt.items.add(file);
    });
    
    fileInput.files = dt.files;
    updateFilePreview();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function handleMessageKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function deleteMessage() {
    if (!selectedMessageId) return;
    
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    try {
        const res = await fetch(`/api/messages/${selectedMessageId}`, {
            method: 'DELETE'
        });
        
        const data = await res.json();
        
        if (data.success) {
            loadMessages(activeChannel._id);
        } else {
            alert('Error deleting message: ' + data.message);
        }
    } catch (err) {
        console.error('Error deleting message:', err);
        alert('Error deleting message');
    }
    
    document.getElementById('messageContextMenu').style.display = 'none';
}

function editMessage() {
    if (!selectedMessageId) return;
    
    const messageEl = document.querySelector(`[data-message-id="${selectedMessageId}"]`);
    if (!messageEl) return;
    
    const messageText = messageEl.querySelector('.message-text');
    if (!messageText) return;
    
    const content = messageText.textContent;
    startEditMessage({ _id: selectedMessageId, content });
    
    document.getElementById('messageContextMenu').style.display = 'none';
}

// [Previous content continues...]

function startEditMessage(message) {
    editingMessageId = message._id;
    const input = document.getElementById('messageInput');
    input.value = message.content;
    input.focus();
    document.getElementById('editModeIndicator').style.display = 'block';
    document.querySelectorAll('.message').forEach(m => m.classList.remove('editing'));
    const messageEl = document.querySelector(`[data-message-id="${message._id}"]`);
    if (messageEl) messageEl.classList.add('editing');
}

function cancelEdit() {
    editingMessageId = null;
    document.getElementById('messageInput').value = '';
    document.getElementById('editModeIndicator').style.display = 'none';
    document.querySelectorAll('.message').forEach(m => m.classList.remove('editing'));
}

function replyToMessage() {
    if (!selectedMessageId) return;
    const messageEl = document.querySelector(`[data-message-id="${selectedMessageId}"]`);
    if (!messageEl) return;
    const messageText = messageEl.querySelector('.message-text');
    const authorName = messageEl.querySelector('.message-author').textContent;
    replyingToMessage = {_id: selectedMessageId, author: authorName, content: messageText ? messageText.textContent : '[Attachment]'};
    document.getElementById('replyToUser').textContent = authorName;
    document.getElementById('replyToContent').textContent = replyingToMessage.content;
    document.getElementById('replyPreview').style.display = 'block';
    document.getElementById('messageInput').focus();
    document.getElementById('messageContextMenu').style.display = 'none';
}

function cancelReply() {
    replyingToMessage = null;
    document.getElementById('replyPreview').style.display = 'none';
}

function scrollToMessage(messageId) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageEl.style.background = 'rgba(88, 101, 242, 0.3)';
        setTimeout(() => {messageEl.style.background = '';}, 2000);
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    const fileInput = document.getElementById('messageFileInput');
    if ((!content && !fileInput.files.length) || !activeChannel || activeChannel.type !== 'text') return;
    try {
        if (editingMessageId) {
            const res = await fetch(`/api/messages/${editingMessageId}`, {method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content })});
            const data = await res.json();
            if (data.success) {cancelEdit(); loadMessages(activeChannel._id);}
            return;
        }
        const formData = new FormData();
        formData.append('content', content);
        if (replyingToMessage) formData.append('replyTo', replyingToMessage._id);
        for (let i = 0; i < fileInput.files.length; i++) formData.append('attachments', fileInput.files[i]);
        const res = await fetch(`/api/channels/${activeChannel._id}/messages`, {method: 'POST', body: formData});
        const data = await res.json();
        if (data.success) {input.value = ''; fileInput.value = ''; updateFilePreview(); cancelReply(); loadMessages(activeChannel._id);}
    } catch (err) {console.error('Error sending message:', err);}
}

async function loadMembers() {
    try {
        const res = await fetch(`/api/serverId/${serverId}/members`);
        const data = await res.json();
        if (data.success) {members = data.members; renderMembers();}
    } catch (err) {console.error('Error loading members:', err);}
}

function renderMembers() {
    const list = document.getElementById('membersList');
    list.innerHTML = '';
    members.forEach(member => {
        const item = document.createElement('div');
        item.className = 'member-item';
        const isOwner = member.user._id === server.owner._id;
        item.innerHTML = `<img class="member-avatar" src="/images/${member.user.pfp.fileId}"></img><div class="member-name">${member.user.name}</div>${isOwner ? '<span class="owner-badge">Owner</span>' : ''}`;
        if (userId === server.owner._id && !isOwner) item.onclick = () => openMemberContext(member.user);
        list.appendChild(item);
    });
}

async function loadRoles() {
    try {
        const res = await fetch(`/api/serverId/${serverId}/roles`);
        const data = await res.json();
        if (data.success) roles = data.roles;
    } catch (err) {console.error('Error loading roles:', err);}
}

function renderRoles() {
    const list = document.getElementById('rolesList');
    list.innerHTML = '';
    if (roles.length === 0) {list.innerHTML = '<div class="empty-state">No roles yet</div>'; return;}
    roles.forEach(role => {
        const item = document.createElement('div');
        item.className = 'role-item';
        item.innerHTML = `<div><div class="role-name" style="color: ${role.color}">${role.name}</div></div><div class="role-actions"><button class="icon-btn" onclick="deleteRole('${role._id}')">🗑️</button></div>`;
        list.appendChild(item);
    });
}

function toggleServerMenu() {
    document.getElementById('serverMenu').classList.toggle('show');
}

document.addEventListener('click', (e) => {
    const serverMenu = document.getElementById('serverMenu');
    const header = document.querySelector('.server-header');
    if (!serverMenu.contains(e.target) && !header.contains(e.target)) serverMenu.classList.remove('show');
    const messageContextMenu = document.getElementById('messageContextMenu');
    if (messageContextMenu && !messageContextMenu.contains(e.target)) messageContextMenu.style.display = 'none';
});

document.addEventListener('DOMContentLoaded', () => {
    const messageContextMenu = document.getElementById('messageContextMenu');
    if (messageContextMenu) messageContextMenu.addEventListener('click', (e) => {e.stopPropagation();});
});

function openModal(modalId) {document.getElementById(modalId).classList.add('show');}
function closeModal(modalId) {document.getElementById(modalId).classList.remove('show');}

async function openInviteModal() {
    document.getElementById('serverMenu').classList.remove('show');
    openModal('inviteModal');
    try {
        const res = await fetch(`/api/serverId/${serverId}/invite`, {method: 'POST', headers: { 'Content-Type': 'application/json' }});
        const data = await res.json();
        if (data.success) {
            const inviteUrl = `${window.location.origin}/invite/${data.code}`;
            document.getElementById('inviteLink').textContent = inviteUrl;
        }
    } catch (err) {console.error('Error creating invite:', err); document.getElementById('inviteLink').textContent = 'Error generating invite';}
}

function copyInviteLink() {
    const link = document.getElementById('inviteLink').textContent;
    navigator.clipboard.writeText(link).then(() => {alert('Invite link copied!');});
}

function openCreateChannelModal(type) {
    document.getElementById('channelType').value = type;
    document.getElementById('createChannelTitle').textContent = `Create ${type === 'text' ? 'Text' : 'Voice'} Channel`;
    openModal('createChannelModal');
}

async function createChannel() {
    const name = document.getElementById('channelName').value.trim();
    const type = document.getElementById('channelType').value;
    if (!name) return;
    try {
        const res = await fetch(`/api/serverId/${serverId}/channels`, {method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type })});
        const data = await res.json();
        if (data.success) {closeModal('createChannelModal'); document.getElementById('channelName').value = ''; await loadChannels(); selectChannel(data.channel);} else {alert('Error creating channel: ' + data.message);}
    } catch (err) {console.error('Error creating channel:', err); alert('Error creating channel');}
}

function openEditServerModal() {
    document.getElementById('serverMenu').classList.remove('show');
    document.getElementById('editServerName').value = server.name;
    openModal('editServerModal');
}

async function updateServer() {
    const name = document.getElementById('editServerName').value.trim();
    if (!name) return;
    try {
        const res = await fetch(`/api/serverId/${serverId}`, {method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })});
        const data = await res.json();
        if (data.success) {closeModal('editServerModal'); await loadServer();} else {alert('Error updating server: ' + data.message);}
    } catch (err) {console.error('Error updating server:', err); alert('Error updating server');}
}

async function openRolesModal() {
    document.getElementById('serverMenu').classList.remove('show');
    await loadRoles();
    renderRoles();
    openModal('rolesModal');
}

function openCreateRoleModal() {openModal('createRoleModal');}

async function createRole() {
    const name = document.getElementById('roleName').value.trim();
    const color = document.getElementById('roleColor').value;
    if (!name) return;
    try {
        const res = await fetch(`/api/serverId/${serverId}/roles`, {method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color })});
        const data = await res.json();
        if (data.success) {closeModal('createRoleModal'); document.getElementById('roleName').value = ''; document.getElementById('roleColor').value = '#5865f2'; await loadRoles(); renderRoles();} else {alert('Error creating role: ' + data.message);}
    } catch (err) {console.error('Error creating role:', err); alert('Error creating role');}
}

async function deleteRole(roleId) {
    if (!confirm('Are you sure you want to delete this role?')) return;
    try {
        const res = await fetch(`/api/serverId/${serverId}/roles/${roleId}`, {method: 'DELETE'});
        const data = await res.json();
        if (data.success) {await loadRoles(); renderRoles();} else {alert('Error deleting role: ' + data.message);}
    } catch (err) {console.error('Error deleting role:', err); alert('Error deleting role');}
}

function openMemberContext(user) {
    selectedMemberId = user._id;
    document.getElementById('memberContextName').textContent = user.name;
    openModal('memberContextModal');
}

async function kickMember() {
    if (!selectedMemberId || !confirm('Are you sure you want to kick this member?')) return;
    try {
        const res = await fetch(`/api/serverId/${serverId}/kick/${selectedMemberId}`, {method: 'POST'});
        const data = await res.json();
        if (data.success) {closeModal('memberContextModal'); await loadMembers(); selectedMemberId = null;} else {alert('Error kicking member: ' + data.message);}
    } catch (err) {console.error('Error kicking member:', err); alert('Error kicking member');}
}

async function banMember() {
    if (!selectedMemberId || !confirm('Are you sure you want to ban this member?')) return;
    try {
        const res = await fetch(`/api/serverId/${serverId}/ban/${selectedMemberId}`, {method: 'POST'});
        const data = await res.json();
        if (data.success) {closeModal('memberContextModal'); await loadMembers(); selectedMemberId = null;} else {alert('Error banning member: ' + data.message);}
    } catch (err) {console.error('Error banning member:', err); alert('Error banning member');}
}

async function leaveServer() {
    if (server.owner._id === userId) {alert('You cannot leave a server you own. Transfer ownership or delete the server instead.'); return;}
    if (!confirm('Are you sure you want to leave this server?')) return;
    try {
        const res = await fetch(`/api/serverId/${serverId}/leave`, {method: 'POST'});
        const data = await res.json();
        if (data.success) window.location.href = '/'; else alert('Error leaving server: ' + data.message);
    } catch (err) {console.error('Error leaving server:', err); alert('Error leaving server');}
}

init();