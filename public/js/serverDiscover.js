const userId = '<%= userId %>';
const serverFilter = document.getElementById('serverFilter');
const serversContainer = document.getElementById('serversContainer');



function viewProfile(serverId) {
    window.location.href = '/serverId/' + serverId;
}
        serverFilter.addEventListener('change', async (e) => {
            const filter = e.target.value;
            
            // Show loading state
            serversContainer.innerHTML = '<div class="loading">Loading servers...</div>';
            
            try {
                let endpoint = '/api/serverDiscover';
                if (filter === 'all-servers') {
                    endpoint = '/api/all-servers';
                }
                
                const response = await fetch(endpoint);
                const data = await response.json();
                
                if (data.success) {
                    displayServers(data.servers, filter === 'all-servers');
                } else {
                    serversContainer.innerHTML = `<div class="no-servers"><h2>Error</h2><p>${data.message}</p></div>`;
                }
            } catch (error) {
                console.error('Error fetching servers:', error);
                serversContainer.innerHTML = '<div class="no-servers"><h2>Error</h2><p>Failed to load servers. Please try again.</p></div>';
            }
        });

        function displayServers(servers, showAllServers) {
            if (servers.length === 0) {
                const message = showAllServers ? 'No servers available.' : 'You haven\'t joined or created any servers yet.';
                serversContainer.innerHTML = `
                    <div class="no-servers">
                        <h2>No Servers</h2>
                        <p>${message}</p>
                        <a href="/create-servers" class="create-server-btn">Create Your First Server</a>
                    </div>
                `;
                return;
            }

            let html = '<div class="servers-grid">';
            
            servers.forEach(server => {
                // Safely get owner ID
                const ownerId = server.owner?._id || server.owner;
                const isOwner = ownerId === userId;
                
                // Safely check if user is a member
                const isMember = server.members && server.members.some(m => {
                    const memberId = m.user?._id || m.user || m;
                    return memberId.toString() === userId;
                });
                
                // For "all servers" view, make cards not clickable if user isn't a member
                const cardLink = (showAllServers && !isMember && !isOwner) ? '#' : `/serverId/${server._id}`;
                const onclick = (showAllServers && !isMember && !isOwner) ? 'onclick="return false;"' : '';
                
                // Safely get owner name
                const ownerName = server.owner?.name || 'Unknown';
                
                html += `
                    <a href="${cardLink}" class="server-card" ${onclick}>
                        <div class="server-icon">
                            ${server.icon ? 
                                `<img src="/images/${server.icon}" alt="${server.name}">` :
                                server.name.charAt(0).toUpperCase()
                            }
                        </div>
                        <div class="server-name">${server.name}</div>
                        <div class="server-description">
                            ${server.description || 'No description'}
                        </div>
                        <div class="server-info">
                            <div class="info-item">
                                <div class="info-label">Members</div>
                                <div class="info-value">${server.members ? server.members.length : 0}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Owner</div>
                                <div class="info-value">${ownerName}</div>
                            </div>
                        </div>
                `;
                
                if (isOwner) {
                    html += '<div style="text-align: center;"><span class="owner-badge">👑 Owner</span></div>';
                } else if (isMember) {
                    html += '<div style="text-align: center;"><span class="joined-badge">✓ Joined</span></div>';
                } else if (showAllServers) {
                    html += `<div style="text-align: center;"><button class="join-server-btn" onclick="event.preventDefault(); joinServer('${server._id}')">Join Server</button></div>`;
                }
                
                html += '</a>';
            });
            
            html += '</div>';
            serversContainer.innerHTML = html;
        }

        async function joinServer(serverId) {
            try{
                const res = await fetch(`/api/join/${serverId}`,{
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
                const data = await res.json();
            }catch (error)
            {
                console.log("Error joining server: ", error)
            }
           
        }