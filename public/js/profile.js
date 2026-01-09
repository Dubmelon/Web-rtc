document.addEventListener('DOMContentLoaded', function() {
    let isEditMode = false;
    let originalValues = {};
    
    // Get elements
    const editBtn = document.getElementById('editBtn');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const profileForm = document.getElementById('profileForm');
    const pfpInput = document.getElementById('pfpInput');
    const uploadBtnWrapper = document.getElementById('uploadBtnWrapper');
    
    // Get all editable inputs
    const bioInput = document.getElementById('bioInput');
    const locationInput = document.getElementById('locationInput');
    const jobInput = document.getElementById('jobInput');
    const siteInput = document.getElementById('siteInput');
    
    const editableInputs = [bioInput, locationInput, jobInput, siteInput];
    
    // Edit button click
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            isEditMode = true;
            
            // Store original values
            originalValues = {
                bio: bioInput.value,
                location: locationInput.value,
                job: jobInput.value,
                site: siteInput.value
            };
            
            // Enable all inputs
            editableInputs.forEach(input => {
                if (input) {
                    input.removeAttribute('readonly');
                    input.classList.add('editable');
                }
            });
            
            // Show/hide buttons
            editBtn.style.display = 'none';
            saveBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block';
            
            // Show upload button
            if (uploadBtnWrapper) {
                uploadBtnWrapper.style.display = 'block';
            }
        });
    }
    
    // Cancel button click
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            isEditMode = false;
            
            // Restore original values
            bioInput.value = originalValues.bio;
            locationInput.value = originalValues.location;
            jobInput.value = originalValues.job;
            siteInput.value = originalValues.site;
            
            // Disable all inputs
            editableInputs.forEach(input => {
                if (input) {
                    input.setAttribute('readonly', true);
                    input.classList.remove('editable');
                }
            });
            
            // Show/hide buttons
            editBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
            
            // Hide upload button
            if (uploadBtnWrapper) {
                uploadBtnWrapper.style.display = 'none';
            }
        });
    }
    
    // Handle form submission
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!isEditMode) return;
            
            const formData = new FormData(profileForm);
            const data = {
                bio: formData.get('bio'),
                location: formData.get('location'),
                job: formData.get('job'),
                site: formData.get('site')
            };
            
            try {
                const response = await fetch('/profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Show success message
                    const statusDiv = document.getElementById('uploadStatus');
                    statusDiv.textContent = 'Profile updated successfully!';
                    statusDiv.style.color = 'green';
                    
                    // Exit edit mode
                    isEditMode = false;
                    
                    // Disable all inputs
                    editableInputs.forEach(input => {
                        if (input) {
                            input.setAttribute('readonly', true);
                            input.classList.remove('editable');
                        }
                    });
                    
                    // Show/hide buttons
                    editBtn.style.display = 'inline-block';
                    saveBtn.style.display = 'none';
                    cancelBtn.style.display = 'none';
                    
                    // Hide upload button
                    if (uploadBtnWrapper) {
                        uploadBtnWrapper.style.display = 'none';
                    }
                    
                    // Clear success message after 3 seconds
                    setTimeout(() => {
                        statusDiv.textContent = '';
                    }, 3000);
                } else {
                    alert('Error updating profile: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error updating profile: ' + error.message);
            }
        });
    }
    
    // Handle profile picture upload
    if (pfpInput) {
        pfpInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Show upload status
            const statusDiv = document.getElementById('uploadStatus');
            statusDiv.textContent = 'Uploading profile picture...';
            statusDiv.style.color = 'blue';

            const formData = new FormData();
            formData.append('profilePicture', file);

            try {
                const response = await fetch('/upload-pfp', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.success) {
                    statusDiv.textContent = 'Profile picture uploaded successfully!';
                    statusDiv.style.color = 'green';
                    
                    // Reload the page to show new profile picture
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                } else {
                    statusDiv.textContent = 'Upload failed: ' + (data.error || 'Unknown error');
                    statusDiv.style.color = 'red';
                }
            } catch (error) {
                console.error('Upload error:', error);
                statusDiv.textContent = 'Upload failed: ' + error.message;
                statusDiv.style.color = 'red';
            }
        });
    }
});