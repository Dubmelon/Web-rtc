const viewSelect = document.getElementById('viewSelect');
const friendsSection = document.getElementById('friendsSection');
const usersSection = document.getElementById('usersSection');

// View switching
viewSelect.addEventListener('change', function(e) {
    if (e.target.value === 'friends') {
        friendsSection.classList.remove('hidden');
        usersSection.classList.add('hidden');
    } else {
        friendsSection.classList.add('hidden');
        usersSection.classList.remove('hidden');
    }
});

// Add friend functionality
async function addFriend(userId) {
    try {
        const res = await fetch('/add-friend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendId: userId })
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to send request');
        }

        alert(data.message || 'Friend request sent!');
        
        // Optionally reload page to update the UI
        // window.location.reload();
        
    } catch (err) {
        console.error(err);
        alert('Failed to add friend: ' + err.message);
    }
}

// View profile
function viewProfile(userId) {
    window.location.href = '/profile/' + userId;
}

// Send message - start conversation
function sendMessage(friendId) {
    window.location.href = '/start-conversation/' + friendId;
}