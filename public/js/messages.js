/* =====================
   GLOBAL STATE
===================== */
const currentUserId = document.getElementById('app')?.dataset.userId || window.currentUserId;
let conversations = [];
let activeConversation = null;
let messages = [];

/* =====================
   HELPERS
===================== */
const normalize = id => id?.toString();

function getConversationIdFromPath() {
    const parts = window.location.pathname.split('/');
    return parts[2] || null;
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* =====================
   INIT
===================== */
async function init() {
    if (!currentUserId) {
        console.error('User ID not found');
        return;
    }

    await loadConversations();

    const conversationId = getConversationIdFromPath();
    if (!conversationId) return;

    const convo = conversations.find(c => normalize(c._id) === normalize(conversationId));
    if (convo) {
        await selectConversation(convo);
    }
}

document.addEventListener('DOMContentLoaded', init);

/* =====================
   LOAD CONVERSATIONS
===================== */
async function loadConversations() {
    try {
        const res = await fetch(`/api/users/${currentUserId}/conversations`);
        const data = await res.json();

        if (!data.success) return;

        conversations = data.conversations;
        renderConversations(conversations);
    } catch (err) {
        console.error(err);
    }
}

/* =====================
   RENDER CONVERSATION LIST
===================== */
function renderConversations(list) {
    const container = document.getElementById('conversationsList');

    if (!list.length) {
        container.innerHTML = '<div class="loading">No conversations yet</div>';
        return;
    }

    container.innerHTML = list.map(conv => {
        const otherUser = conv.type === 'direct'
            ? conv.participants.find(p => normalize(p._id) !== normalize(currentUserId))
            : null;

        const name = conv.type === 'group'
            ? conv.name
            : otherUser?.name || 'Unknown';

        const avatar = conv.type === 'group'
            ? name[0].toUpperCase()
            : otherUser?.pfp.fileId
                ? `<img src="/images/${otherUser.pfp.fileId}">`
                : name[0].toUpperCase();

        return `
            <div class="conversation-item ${activeConversation?._id === conv._id ? 'active' : ''}"
                 data-id="${conv._id}">
                <div class="conversation-avatar">${avatar}</div>
                <div class="conversation-info">
                    <div class="conversation-name">${name}</div>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.conversation-item').forEach(el => {
        el.onclick = () => {
            const convo = conversations.find(c => normalize(c._id) === normalize(el.dataset.id));
            selectConversation(convo);
        };
    });
}

/* =====================
   SELECT CONVERSATION
===================== */
async function selectConversation(conversation) {
    if (!conversation) return;

    activeConversation = conversation;
    history.pushState(null, '', `/conversations/${conversation._id}`);

    document.querySelectorAll('.conversation-item').forEach(el => {
        el.classList.toggle(
            'active',
            normalize(el.dataset.id) === normalize(conversation._id)
        );
    });

    await loadMessages(conversation._id);
    renderChat();
}

/* =====================
   LOAD MESSAGES
===================== */
async function loadMessages(conversationId) {
    try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`);
        const data = await res.json();

        if (data.success) {
            messages = data.messages;
        }
    } catch (err) {
        console.error(err);
    }
}

/* =====================
   RENDER CHAT
===================== */
function renderChat() {
    const chat = document.getElementById('chatContent');

    if (!activeConversation) {
        chat.innerHTML = '<div class="empty-state">Select a conversation</div>';
        return;
    }

    const otherUser = activeConversation.type === 'direct'
        ? activeConversation.participants.find(p => normalize(p._id) !== normalize(currentUserId))
        : null;

    const name = activeConversation.type === 'group'
        ? activeConversation.name
        : otherUser?.name || 'Unknown';

    chat.innerHTML = `
        <div class="chat-header">
            <div class="chat-header-name">${name}</div>
        </div>

        <div class="messages-container" id="messagesContainer">
            ${renderMessages()}
        </div>

        <div class="input-area">
            <textarea id="messageInput" placeholder="Type a message..."></textarea>
            <button class="send-button" onclick="sendMessage()">Send</button>
            <input type="file" id="fileInput" style="display:none;" accept="image/*,video/*,application/pdf">
            <button class="send-button" onclick="document.getElementById('fileInput').click()">📎 File</button>
        </div>
    `;

    const input = document.getElementById('messageInput');
    input.onkeydown = e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Set up file input handler
    const fileInput = document.getElementById('fileInput');
    fileInput.onchange = handleFileSelect;

    scrollToBottom();
}

/* =====================
   RENDER MESSAGES
===================== */
function renderMessages() {
    if (!messages.length) {
        return '<div class="empty-state">No messages yet</div>';
    }

    return messages.map((msg, index) => {
        const sent = normalize(msg.sender._id) === normalize(currentUserId);
        
        // Check if this message has attachments (it's an array)
        if (msg.attachments && msg.attachments.length > 0) {
            // Get the first attachment
            const attachment = msg.attachments[0];
            const fileExt = attachment.filename?.split('.').pop()?.toLowerCase();
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt);
            
            if (isImage) {
                return `
                    <div class="message ${sent ? 'sent' : 'received'}">
                        <div class="bubble">
                            <img src="/files/${escapeHtml(attachment.fileId)}" 
                                 alt="${escapeHtml(attachment.filename)}"
                                 style="max-width: 300px; max-height: 300px; border-radius: 8px; display: block;">
                            ${msg.content ? `<div style="margin-top: 8px;">${escapeHtml(msg.content)}</div>` : ''}
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="message ${sent ? 'sent' : 'received'}">
                        <div class="bubble">
                            <a href="/files/${escapeHtml(attachment.fileId)}" target="_blank">
                                📎 ${escapeHtml(attachment.filename)}
                            </a>
                            ${msg.content ? `<div style="margin-top: 8px;">${escapeHtml(msg.content)}</div>` : ''}
                        </div>
                    </div>
                `;
            }
        }
        
        // Regular text message
        return `
            <div class="message ${sent ? 'sent' : 'received'}">
                <div class="bubble">${escapeHtml(msg.content || '[No content]')}</div>
            </div>
        `;
    }).join('');
}

/* =====================
   SEND MESSAGE
===================== */
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || !activeConversation) return;

    try {
        const res = await fetch(`/api/conversations/${activeConversation._id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: currentUserId,
                content
            })
        });

        const data = await res.json();
        if (!data.success) return;

        messages.push(data.message);
        input.value = '';

        const container = document.getElementById('messagesContainer');
        container.innerHTML = renderMessages();
        scrollToBottom();

    } catch (err) {
        console.error(err);
    }
}

/* =====================
   HANDLE FILE SELECT
===================== */
async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file || !activeConversation) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        // First upload the file
        const uploadRes = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const uploadData = await uploadRes.json();

        if (!uploadData.success) {
            console.error('File upload failed:', uploadData.error);
            return;
        }

        // Then send message with attachment (as array to match schema)
        const messageRes = await fetch(`/api/conversations/${activeConversation._id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: currentUserId,
                content: '',
                attachments: [{
                    fileId: uploadData.fileId,
                    filename: uploadData.filename
                }]
            })
        });

        const messageData = await messageRes.json();
        
        if (messageData.success) {
            messages.push(messageData.message);
            
            const container = document.getElementById('messagesContainer');
            container.innerHTML = renderMessages();
            scrollToBottom();
            
            // Reset file input
            e.target.value = '';
        }

    } catch (error) {
        console.error('Upload error:', error);
    }
}

/* =====================
   MESSAGE POLLING
===================== */
setInterval(async () => {
    if (!activeConversation) return;

    const container = document.getElementById('messagesContainer');
    const atBottom =
        container &&
        container.scrollHeight - container.clientHeight <= container.scrollTop + 5;

    await loadMessages(activeConversation._id);

    if (container) {
        container.innerHTML = renderMessages();
        if (atBottom) scrollToBottom();
    }
}, 3000);