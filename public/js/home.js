        const userId = window.currentUserId;
        let notifications = { friendRequests: [], messages: [], total: 0 };
        let currentTab = 'all';

        // Toggle notification dropdown
        const bell = document.getElementById('notificationBell');
        const dropdown = document.getElementById('notificationDropdown');

        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !bell.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });

        // Tab switching
        document.querySelectorAll('.notification-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.notification-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTab = tab.dataset.tab;
                renderNotifications();
            });
        });

        // Load notifications
        async function loadNotifications() {
            try {
                const response = await fetch(`/api/notifications/${userId}`);
                const data = await response.json();

                if (data.success) {
                    notifications = data.notifications;
                    updateBadge();
                    renderNotifications();
                }
            } catch (error) {
                console.error('Error loading notifications:', error);
            }
        }

        // Update badge
        function updateBadge() {
            const badge = document.getElementById('notificationBadge');
            if (notifications.total > 0) {
                badge.textContent = notifications.total;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }

        // Render notifications
        function renderNotifications() {
            const list = document.getElementById('notificationList');
            let items = [];

            if (currentTab === 'all') {
                items = [...notifications.friendRequests, ...notifications.messages]
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            } else if (currentTab === 'friends') {
                items = notifications.friendRequests;
            } else if (currentTab === 'messages') {
                items = notifications.messages;
            }

            if (items.length === 0) {
                list.innerHTML = `
                    <div class="notification-empty">
                        <div class="notification-empty-icon">🔔</div>
                        <p>No notifications in this category</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = items.map(item => {
                const avatar = item.from.pfp?.fileId
                    ? `<img src="/images/${item.from.pfp.fileId}" alt="">`
                    : item.from.name[0].toUpperCase();

                if (item.type === 'friend_request') {
                    return `
                        <div class="notification-item">
                            <div class="notification-avatar">${avatar}</div>
                            <div class="notification-content">
                                <div class="notification-text">
                                    <strong>${item.from.name}</strong> sent you a friend request
                                </div>
                                <div class="notification-time">${formatTimeAgo(new Date(item.createdAt))}</div>
                                <div class="notification-actions">
                                    <button class="notification-btn accept" onclick="acceptFriendRequest('${item.data.requestId}')">
                                        Accept
                                    </button>
                                    <button class="notification-btn reject" onclick="rejectFriendRequest('${item.data.requestId}')">
                                        Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                } else if (item.type === 'message') {
                    return `
                        <div class="notification-item" onclick="goToConversation('${item.data.conversationId}')">
                            <div class="notification-avatar">${avatar}</div>
                            <div class="notification-content">
                                <div class="notification-text">
                                    <strong>${item.from.name}</strong>: ${item.message}
                                    ${item.unreadCount > 1 ? `<span class="notification-unread-badge">${item.unreadCount}</span>` : ''}
                                </div>
                                <div class="notification-time">${formatTimeAgo(new Date(item.createdAt))}</div>
                            </div>
                        </div>
                    `;
                }
            }).join('');
        }

        // Accept friend request
        async function acceptFriendRequest(requestId) {
            try {
                const response = await fetch('/api/accept-friend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestId, userId })
                });

                const data = await response.json();

                if (data.success) {
                    await loadNotifications();
                    alert('Friend request accepted!');
                }
            } catch (error) {
                console.error('Error accepting friend request:', error);
                alert('Failed to accept friend request');
            }
        }

        // Reject friend request
        async function rejectFriendRequest(requestId) {
            try {
                const response = await fetch('/api/reject-friend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestId, userId })
                });

                const data = await response.json();

                if (data.success) {
                    await loadNotifications();
                }
            } catch (error) {
                console.error('Error rejecting friend request:', error);
                alert('Failed to reject friend request');
            }
        }

        // Go to conversation
        async function goToConversation(conversationId) {
            // Mark messages as read
            try {
                await fetch(`/api/mark-read/${conversationId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
            } catch (error) {
                console.error('Error marking messages as read:', error);
            }

            // Navigate to messages page with conversation
            window.location.href = `/conversations/${conversationId}`;
        }

        // Format time ago
        function formatTimeAgo(date) {
            const seconds = Math.floor((new Date() - date) / 1000);
            
            if (seconds < 60) return 'just now';
            if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
            if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
            if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
            
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        // Initialize
        loadNotifications();

        // Poll for new notifications every 10 seconds
        setInterval(loadNotifications, 10000);
