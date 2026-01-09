const userId = document.body.dataset.userId || window.currentUserId;
        let uploadedIconId = null;

        // Character count tracking
        const nameInput = document.getElementById('serverName');
        const descInput = document.getElementById('serverDescription');
        const nameCount = document.getElementById('nameCount');
        const descCount = document.getElementById('descCount');

        nameInput.addEventListener('input', () => {
            nameCount.textContent = nameInput.value.length;
        });

        descInput.addEventListener('input', () => {
            descCount.textContent = descInput.value.length;
        });

        // Image preview
        const iconInput = document.getElementById('serverIcon');
        const previewImage = document.getElementById('previewImage');
        const previewPlaceholder = document.getElementById('previewPlaceholder');

        iconInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith('image/')) {
                showError('iconError', 'Please select a valid image file');
                return;
            }

            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                showError('iconError', 'Image must be smaller than 5MB');
                return;
            }

            // Show preview
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                previewImage.style.display = 'block';
                previewPlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);

            // Upload to server
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.success) {
                    uploadedIconId = data.fileId;
                    hideError('iconError');
                } else {
                    showError('iconError', 'Failed to upload icon');
                }
            } catch (error) {
                console.error('Upload error:', error);
                showError('iconError', 'Error uploading icon');
            }
        });

        // Form submission
        const form = document.getElementById('createServerForm');
        const submitBtn = document.getElementById('submitBtn');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Clear previous errors
            hideError('nameError');

            const name = nameInput.value.trim();

            // Validation
            if (!name) {
                showError('nameError', 'Server name is required');
                return;
            }

            if (name.length < 2) {
                showError('nameError', 'Server name must be at least 2 characters');
                return;
            }

            // Disable submit button
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';

            try {
                const response = await fetch('/api/serverId/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: name,
                        description: descInput.value.trim() || undefined,
                        iconId: uploadedIconId,
                        ownerId: userId
                    })
                });

                const data = await response.json();

                if (data.success) {
                    // Show success message
                    document.getElementById('successMessage').classList.add('show');
                    
                    // Redirect after 1.5 seconds
                    setTimeout(() => {
                        window.location.href = `/serverId/${data.server._id}`;
                    }, 1500);
                } else {
                    showError('nameError', data.error || 'Failed to create server');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Create Server';
                }
            } catch (error) {
                console.error('Error:', error);
                showError('nameError', 'An error occurred. Please try again.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Server';
            }
        });

        // Helper functions
        function showError(elementId, message) {
            const errorEl = document.getElementById(elementId);
            errorEl.textContent = message;
            errorEl.classList.add('show');
        }

        function hideError(elementId) {
            const errorEl = document.getElementById(elementId);
            errorEl.classList.remove('show');
        }