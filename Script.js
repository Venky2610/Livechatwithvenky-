document.addEventListener('DOMContentLoaded', () => {
    // --- Get all the elements we need from the HTML ---
    const messageInput = document.getElementById('anonymousMessage');
    const sendButton = document.getElementById('sendButton');
    const nameFieldContainer = document.getElementById('nameFieldContainer');
    const userNameInput = document.getElementById('userName');
    const emojis = document.querySelectorAll('.emoji');
    const liveChatButton = document.getElementById('liveChatButton');

    let selectedEmoji = null;

    // --- Logic for the main message box ---
    messageInput.addEventListener('input', () => {
        // Show the 'Send' button only when the user starts typing
        if (messageInput.value.trim() !== '') {
            sendButton.classList.remove('hidden');
        } else {
            sendButton.classList.add('hidden');
        }
    });

    // --- Logic for the emoji selection ---
    emojis.forEach(emoji => {
        emoji.addEventListener('click', () => {
            // Remove 'selected' from any previously selected emoji
            const currentlySelected = document.querySelector('.emoji.selected');
            if (currentlySelected) {
                currentlySelected.classList.remove('selected');
            }
            // Add 'selected' to the clicked emoji and store its value
            emoji.classList.add('selected');
            selectedEmoji = emoji.dataset.emoji;
        });
    });

    // --- Main Logic when the Send button is clicked ---
    sendButton.addEventListener('click', async () => {
        const message = messageInput.value.trim();
        const userName = userNameInput.value.trim();

        // First click: show name field if it's hidden
        if (nameFieldContainer.classList.contains('hidden')) {
            if (message === '') {
                // Shake animation if message is empty
                messageInput.style.animation = 'shake 0.5s';
                setTimeout(() => { messageInput.style.animation = '' }, 500);
                return;
            }
            nameFieldContainer.classList.remove('hidden');
            userNameInput.focus();
            return;
        }
        
        // Second click: Validate and send the data
        if (userName === '') {
             // Shake animation if name is empty
            userNameInput.style.animation = 'shake 0.5s';
            setTimeout(() => { userNameInput.style.animation = '' }, 500);
            return;
        }

        // --- HERE IS WHERE WE WILL ADD PERMISSION/DATA CAPTURE LOGIC LATER ---
        // For now, we focus on sending the message.
        
        sendButton.disabled = true;
        sendButton.textContent = 'Sending...';

        try {
            // Send all the data to our secure backend function
            const response = await fetch('/.netlify/functions/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    name: userName,
                    emoji: selectedEmoji
                })
            });

            if (response.ok) {
                // Success!
                document.querySelector('.content-card').innerHTML = `
                    <h1 class="main-title">Thank You!</h1>
                    <p class="sub-message">Your message has been sent to Venky anonymously.</p>
                `;
            } else {
                // Failure
                throw new Error('Failed to send message.');
            }
        } catch (error) {
            console.error(error);
            alert('Sorry, something went wrong. Please try again.');
            sendButton.disabled = false;
            sendButton.textContent = 'Send';
        }
    });
});

// We need to add the shake animation keyframes to our CSS.
// Let's add it dynamically with JavaScript.
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
@keyframes shake {
    10%, 90% { transform: translate3d(-1px, 0, 0); }
    20%, 80% { transform: translate3d(2px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
    40%, 60% { transform: translate3d(4px, 0, 0); }
}
`;
document.head.appendChild(styleSheet);
